import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

import {
  adminDb,
} from "../firebase-admin";

/*
 * =========================================================
 * Product Resolution
 * =========================================================
 *
 * This service reproduces the current iOS product-collection
 * creation contract.
 *
 * It does NOT:
 *
 * - create a Retail Asset
 * - create an AR Entry
 * - activate a license
 * - publish to a master playlist
 * - modify an existing AR playlist
 *
 * It only resolves or creates the Product Collection that a
 * later Retail Asset will belong to.
 */

/*
 * Keep this version explicit so future matching improvements
 * do not silently change previously resolved products.
 */
export const PRODUCT_RESOLUTION_VERSION =
  "web-product-resolution-v1";

/*
 * This mirrors the OCR correction dictionary currently used
 * by the iOS creation flow.
 */
const OCR_FIXES: Readonly<
  Record<string, string>
> = {
  shampoc: "shampoo",
  shamp00: "shampoo",
  shamppo: "shampoo",
  ihamfocing: "shampoo",

  conditoner: "conditioner",
  condtioner: "conditioner",

  frize: "frizz",
  fulli: "full",
};

/*
 * This mirrors the broader normalization stopword list used
 * by the app when creating normalized OCR and alias IDs.
 */
const NORMALIZATION_STOPWORDS =
  new Set<string>([
    // English
    "the",
    "for",
    "and",
    "or",
    "with",
    "a",
    "an",
    "to",
    "of",
    "by",
    "in",
    "on",
    "at",
    "is",

    // French and Spanish packaging
    "pour",
    "les",
    "des",
    "cheveux",
    "fins",
    "plats",
    "peu",
    "fournis",
    "para",
    "cabello",

    // Packaging and OCR noise
    "reviews",
    "review",
    "new",
    "net",
    "ml",
    "oz",
  ]);

/*
 * This mirrors the slightly narrower stopword set used by
 * the current iOS collection-slug function.
 */
const COLLECTION_SLUG_STOPWORDS =
  new Set<string>([
    "the",
    "and",
    "for",
    "a",
    "an",
    "or",
    "of",
    "to",
    "in",
    "on",
    "at",
    "by",
    "with",
    "is",
    "it",

    "new",
    "reviews",
    "review",
    "oz",
    "ml",
    "net",
  ]);

export type ProductResolutionSource =
  | "web_ocr"
  | "ios_vision"
  | "manual"
  | "imported";

export type ProductResolutionInput = {
  rawOcr: string;

  /*
   * Optional authoritative Brand and product values from the
   * campaign. These are stored as metadata but do not replace
   * OCR-derived collection compatibility.
   */
  brandName?: string | null;
  productName?: string | null;

  source?: ProductResolutionSource;

  createdBy: string;

  /*
   * When false, the function only resolves and reports what
   * would be created.
   */
  createIfMissing?: boolean;
};

export type ProductResolutionResult = {
  collectionId: string;

  canonicalName: string;
  canonicalSlug: string;

  aliasId: string;

  rawOcr: string;
  normalizedOcr: string;

  tokens: string[];

  brandName: string | null;
  productName: string | null;

  resolution:
    | "exact_alias"
    | "existing_collection"
    | "created_collection"
    | "proposed_collection";

  collectionExisted: boolean;
  aliasExisted: boolean;

  matcherVersion: string;
  source: ProductResolutionSource;
};

function cleanRequiredString(
  value: unknown,
  fieldName: string
): string {
  const cleaned =
    typeof value === "string"
      ? value.trim()
      : "";

  if (!cleaned) {
    throw new Error(
      `${fieldName} is required.`
    );
  }

  return cleaned;
}

function cleanOptionalString(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned || null;
}

/*
 * JavaScript's NFD normalization plus combining-mark removal
 * reproduces Swift's diacritic-insensitive folding closely.
 */
function removeDiacritics(
  value: string
): string {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );
}

/*
 * Mirrors LoadImageController.normalizeOCR().
 */
export function normalizeProductOcr(
  rawOcrInput: string
): string {
  const rawOcr =
    cleanRequiredString(
      rawOcrInput,
      "rawOcr"
    );

  const alphanumericText =
    removeDiacritics(
      rawOcr.toLowerCase()
    )
      .replace(
        /[^a-z0-9 ]/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  const tokens =
    alphanumericText
      .split(" ")
      .filter(Boolean)
      .map(
        (token) =>
          OCR_FIXES[token] ||
          token
      )
      .filter(
        (token) =>
          !NORMALIZATION_STOPWORDS.has(
            token
          )
      );

  return tokens.join(" ");
}

/*
 * Mirrors the app's slugify(normalizeOCR(rawOCR)) path used
 * for aliases/{aliasId}.
 */
export function createProductAliasId(
  normalizedOcrInput: string
): string {
  const normalizedOcr =
    cleanRequiredString(
      normalizedOcrInput,
      "normalizedOcr"
    );

  const slug =
    removeDiacritics(
      normalizedOcr.toLowerCase()
    )
      .replace(
        /[^a-z0-9 ]/g,
        " "
      )
      .replace(
        /\s+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      )
      .split("-")
      .filter(Boolean)
      .slice(0, 7)
      .join("-");

  if (!slug) {
    throw new Error(
      "Unable to create an alias ID from OCR."
    );
  }

  /*
   * The current iOS code includes an 80-character protection.
   * Seven normalized tokens generally remain below it. We use
   * a deterministic truncation rather than Swift hashValue,
   * because Swift hashValue is intentionally process-dependent.
   */
  return slug.length <= 80
    ? slug
    : slug.slice(0, 80).replace(
        /-+$/g,
        ""
      );
}

function deduplicateAdjacentTokens(
  tokens: string[]
): string[] {
  const result: string[] = [];

  for (const token of tokens) {
    if (
      result[result.length - 1] !==
      token
    ) {
      result.push(token);
    }
  }

  return result;
}

/*
 * Produces the collection slug used by the current iOS
 * creation code.
 *
 * The Swift implementation can move parsed Brand tokens
 * forward. The web does not yet contain Apple's Natural
 * Language parser, so an explicit campaign Brand can be used
 * as the safe Brand source.
 *
 * Internal Brand-token order is preserved.
 */
export function createCompatibleCollectionSlug(
  params: {
    rawOcr: string;
    brandName?: string | null;
  }
): string {
  const rawOcr =
    cleanRequiredString(
      params.rawOcr,
      "rawOcr"
    );

  const normalizedForSlug =
    removeDiacritics(
      rawOcr.toLowerCase()
    )
      .replace(
        /[^a-z0-9- ]/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  let tokens =
    normalizedForSlug
      .split(" ")
      .filter(Boolean)
      .map(
        (token) =>
          OCR_FIXES[token] ||
          token
      )
      .filter(
        (token) =>
          !COLLECTION_SLUG_STOPWORDS.has(
            token
          )
      );

  tokens =
    deduplicateAdjacentTokens(
      tokens
    );

  const brandName =
    cleanOptionalString(
      params.brandName
    );

  const brandTokens =
    brandName
      ? removeDiacritics(
          brandName.toLowerCase()
        )
          .split(
            /[^a-z0-9]+/
          )
          .filter(Boolean)
      : [];

  /*
   * Preserve the original relative order of Brand tokens and
   * non-Brand tokens while moving the Brand group first.
   *
   * This avoids relying on Array.sort stability for identity.
   */
  if (brandTokens.length > 0) {
    const brandTokenSet =
      new Set(brandTokens);

    const detectedBrandTokens =
      tokens.filter((token) =>
        brandTokenSet.has(token)
      );

    const remainingTokens =
      tokens.filter(
        (token) =>
          !brandTokenSet.has(token)
      );

    tokens = [
      ...detectedBrandTokens,
      ...remainingTokens,
    ];
  }

  const slug =
    tokens
      .slice(0, 7)
      .join("-");

  if (!slug) {
    throw new Error(
      "Unable to create a Product Collection slug from OCR."
    );
  }

  return slug;
}

/*
 * Until a shared cross-platform parser replaces the iOS
 * Natural Language logic, this readable canonical name uses
 * authoritative campaign fields when supplied and otherwise
 * falls back to normalized OCR.
 */
export function createCanonicalProductName(
  params: {
    rawOcr: string;
    normalizedOcr: string;
    brandName?: string | null;
    productName?: string | null;
  }
): string {
  const brandName =
    cleanOptionalString(
      params.brandName
    );

  const productName =
    cleanOptionalString(
      params.productName
    );

  const explicitParts = [
    brandName,
    productName,
  ].filter(
    (
      value
    ): value is string =>
      Boolean(value)
  );

  if (
    explicitParts.length > 0
  ) {
    return explicitParts.join(
      " · "
    );
  }

  return cleanRequiredString(
    params.normalizedOcr,
    "normalizedOcr"
  );
}

function createRecognitionTokens(
  normalizedOcr: string
): string[] {
  return Array.from(
    new Set(
      normalizedOcr
        .split(" ")
        .map((token) =>
          token.trim()
        )
        .filter(Boolean)
    )
  );
}

/*
 * Resolve the Product Collection but do not create an entry.
 */
export async function resolveProductCollection(
  input: ProductResolutionInput
): Promise<ProductResolutionResult> {
  const rawOcr =
    cleanRequiredString(
      input.rawOcr,
      "rawOcr"
    );

  const createdBy =
    cleanRequiredString(
      input.createdBy,
      "createdBy"
    );

  const brandName =
    cleanOptionalString(
      input.brandName
    );

  const productName =
    cleanOptionalString(
      input.productName
    );

  const source =
    input.source ||
    "web_ocr";

  const createIfMissing =
    input.createIfMissing !==
    false;

  const normalizedOcr =
    normalizeProductOcr(rawOcr);

  if (
    normalizedOcr.split(" ")
      .filter(Boolean).length <
      2 ||
    normalizedOcr.length < 6
  ) {
    throw new Error(
      "OCR did not contain enough meaningful product text."
    );
  }

  const aliasId =
    createProductAliasId(
      normalizedOcr
    );

  const canonicalName =
    createCanonicalProductName({
      rawOcr,
      normalizedOcr,
      brandName,
      productName,
    });

  const proposedCollectionId =
    createCompatibleCollectionSlug({
      rawOcr,
      brandName,
    });

  const tokens =
    createRecognitionTokens(
      normalizedOcr
    );

  const aliasRef =
    adminDb
      .collection("aliases")
      .doc(aliasId);

  const aliasSnapshot =
    await aliasRef.get();

  /*
   * Exact alias resolution is always preferred. This is what
   * protects existing iOS-created collections from being
   * replaced by a newly calculated web slug.
   */
  if (aliasSnapshot.exists) {
    const aliasData =
      aliasSnapshot.data() || {};

    const aliasedCollectionId =
      cleanOptionalString(
        aliasData
          .canonical_collection
      );

    if (aliasedCollectionId) {
      const aliasedMetaRef =
        adminDb
          .collection(
            aliasedCollectionId
          )
          .doc("_meta");

      const aliasedMetaSnapshot =
        await aliasedMetaRef.get();

      if (
        aliasedMetaSnapshot.exists
      ) {
        return {
          collectionId:
            aliasedCollectionId,

          canonicalName:
            cleanOptionalString(
              aliasedMetaSnapshot.data()
                ?.canonical_name
            ) || canonicalName,

          canonicalSlug:
            aliasedCollectionId,

          aliasId,

          rawOcr,
          normalizedOcr,

          tokens,

          brandName,
          productName,

          resolution:
            "exact_alias",

          collectionExisted:
            true,

          aliasExisted:
            true,

          matcherVersion:
            PRODUCT_RESOLUTION_VERSION,

          source,
        };
      }
    }
  }

  const proposedMetaRef =
    adminDb
      .collection(
        proposedCollectionId
      )
      .doc("_meta");

  const proposedMetaSnapshot =
    await proposedMetaRef.get();

  /*
   * A collection can predate its alias document. Preserve it
   * and repair the alias rather than creating another product.
   */
  if (proposedMetaSnapshot.exists) {
    if (createIfMissing) {
      await adminDb.runTransaction(
        async (transaction) => {
          transaction.set(
            proposedMetaRef,
            {
              aliases:
                FieldValue.arrayUnion(
                  rawOcr
                ),

              updated_at:
                FieldValue.serverTimestamp(),

              product_resolution: {
                matcherVersion:
                  PRODUCT_RESOLUTION_VERSION,

                lastResolvedSource:
                  source,

                lastResolvedBy:
                  createdBy,

                lastNormalizedOcr:
                  normalizedOcr,

                lastAliasId:
                  aliasId,

                updatedAt:
                  FieldValue.serverTimestamp(),
              },
            },
            {
              merge: true,
            }
          );

          transaction.set(
            aliasRef,
            {
              canonical_collection:
                proposedCollectionId,

              normalized_ocr:
                normalizedOcr,

              matcher_version:
                PRODUCT_RESOLUTION_VERSION,

              source,

              updated_at:
                FieldValue.serverTimestamp(),
            },
            {
              merge: true,
            }
          );
        }
      );
    }

    return {
      collectionId:
        proposedCollectionId,

      canonicalName:
        cleanOptionalString(
          proposedMetaSnapshot.data()
            ?.canonical_name
        ) || canonicalName,

      canonicalSlug:
        proposedCollectionId,

      aliasId,

      rawOcr,
      normalizedOcr,

      tokens,

      brandName,
      productName,

      resolution:
        "existing_collection",

      collectionExisted:
        true,

      aliasExisted:
        aliasSnapshot.exists,

      matcherVersion:
        PRODUCT_RESOLUTION_VERSION,

      source,
    };
  }

  if (!createIfMissing) {
    return {
      collectionId:
        proposedCollectionId,

      canonicalName,

      canonicalSlug:
        proposedCollectionId,

      aliasId,

      rawOcr,
      normalizedOcr,

      tokens,

      brandName,
      productName,

      resolution:
        "proposed_collection",

      collectionExisted:
        false,

      aliasExisted:
        aliasSnapshot.exists,

      matcherVersion:
        PRODUCT_RESOLUTION_VERSION,

      source,
    };
  }

  /*
   * Create the collection metadata and its exact alias in one
   * transaction. No AR Entry is created here.
   */
  await adminDb.runTransaction(
    async (transaction) => {
      const [
        freshAliasSnapshot,
        freshMetaSnapshot,
      ] = await Promise.all([
        transaction.get(
          aliasRef
        ),

        transaction.get(
          proposedMetaRef
        ),
      ]);

      /*
       * Another request may have created the alias after our
       * initial read. Never overwrite an established mapping.
       */
      if (
        freshAliasSnapshot.exists
      ) {
        const freshAliasCollection =
          cleanOptionalString(
            freshAliasSnapshot.data()
              ?.canonical_collection
          );

        if (
          freshAliasCollection &&
          freshAliasCollection !==
            proposedCollectionId
        ) {
          throw new Error(
            `Product alias was concurrently resolved to ${freshAliasCollection}. Please retry resolution.`
          );
        }
      }

      if (
        freshMetaSnapshot.exists
      ) {
        transaction.set(
          proposedMetaRef,
          {
            aliases:
              FieldValue.arrayUnion(
                rawOcr
              ),

            updated_at:
              FieldValue.serverTimestamp(),
          },
          {
            merge: true,
          }
        );
      } else {
        transaction.set(
          proposedMetaRef,
          {
            /*
             * Existing iOS-compatible metadata.
             */
            canonical_name:
              canonicalName,

            "TryOn URL":
              "https://goshsha.com",

            aliases: [
              rawOcr,
            ],

            created_at:
              FieldValue.serverTimestamp(),

            updated_at:
              FieldValue.serverTimestamp(),

            /*
             * New resolution provenance. Older iOS clients
             * safely ignore these fields.
             */
            canonical_slug:
              proposedCollectionId,

            normalized_ocr:
              normalizedOcr,

            recognition_tokens:
              tokens,

            brand:
              brandName,

            product_name:
              productName,

            product_resolution: {
              matcherVersion:
                PRODUCT_RESOLUTION_VERSION,

              source,

              createdBy,

              createdAt:
                FieldValue.serverTimestamp(),
            },
          }
        );
      }

      transaction.set(
        aliasRef,
        {
          canonical_collection:
            proposedCollectionId,

          normalized_ocr:
            normalizedOcr,

          raw_ocr:
            rawOcr,

          matcher_version:
            PRODUCT_RESOLUTION_VERSION,

          source,

          created_by:
            createdBy,

          created_at:
            freshAliasSnapshot.exists
              ? freshAliasSnapshot.data()
                  ?.created_at ||
                Timestamp.now()
              : FieldValue.serverTimestamp(),

          updated_at:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        }
      );
    }
  );

  return {
    collectionId:
      proposedCollectionId,

    canonicalName,

    canonicalSlug:
      proposedCollectionId,

    aliasId,

    rawOcr,
    normalizedOcr,

    tokens,

    brandName,
    productName,

    resolution:
      "created_collection",

    collectionExisted:
      false,

    aliasExisted:
      aliasSnapshot.exists,

    matcherVersion:
      PRODUCT_RESOLUTION_VERSION,

    source,
  };
}