import {
  createHash,
  randomUUID,
} from "crypto";

import { NextResponse } from "next/server";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
  adminStorage,
} from "../../../../../lib/firebase-admin";

/*
 * =========================================================
 * Product 2 — Direct Retail Media Draft Creation
 * =========================================================
 *
 * This route is intentionally independent from Product 1.
 *
 * Product 1:
 * Approved Goshsha Creator campaign
 *        ↓
 * create-draft
 *
 * Product 2:
 * Brand's existing content
 *        ↓
 * create-direct-draft
 *
 * Both ultimately create:
 *
 * retailAssets/{retailAssetId}
 *
 * and later use the SAME:
 *
 * - Product Collections
 * - Publisher
 * - Master Playlist
 * - iOS playback
 * - Qualified Views
 * - Activation lifecycle
 *
 * Nothing becomes scan-ready here.
 * Nothing starts the 90-day activation here.
 * No payment is processed here.
 */

const MAX_TARGET_IMAGE_BYTES =
  25 * 1024 * 1024;

const MAX_MEDIA_BYTES =
  250 * 1024 * 1024;

const ALLOWED_TARGET_IMAGE_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ]);

const PRODUCT_IDENTITY_VERSION =
  5;

const PRODUCT_2_SCHEMA_VERSION =
  1;

const STOPWORDS =
  new Set([
    "the",
    "and",
    "for",
    "with",
    "a",
    "an",
    "or",
    "of",
    "to",
    "in",
    "on",
    "at",
    "by",
    "is",
    "it",
    "new",
    "reviews",
    "review",
    "net",
    "no",
    "number",
    "ml",
    "oz",
    "fl",
    "floz",
    "g",
    "kg",
    "lb",
    "lbs",
  ]);

const OCR_FIXES:
  Record<string, string> = {
  shampoc:
    "shampoo",

  shamp00:
    "shampoo",

  shamppo:
    "shampoo",

  conditoner:
    "conditioner",

  condtioner:
    "conditioner",

  frize:
    "frizz",
};

type ContentOwnershipType =
  | "brand_owned"
  | "external_creator";

type ProductResolutionResult = {
  collectionId: string;

  masterId: string;

  canonicalName: string;
  canonicalSlug: string;

  aliasId: string;

  rawOcr: string;
  normalizedOcr: string;

  tokens: string[];

  brandTokens: string[];

  resolution:
    | "exact_alias"
    | "existing_collection"
    | "created_collection";

  collectionExisted: boolean;
  aliasExisted: boolean;

  matcherVersion: string;
};

function getBearerToken(
  request: Request
): string {
  const authorization =
    request.headers.get(
      "authorization"
    ) || "";

  if (
    !authorization.startsWith(
      "Bearer "
    )
  ) {
    return "";
  }

  return authorization
    .slice(
      "Bearer ".length
    )
    .trim();
}

function cleanString(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function cleanRequiredString(
  value: unknown,
  fieldName: string
): string {
  const cleaned =
    cleanString(value);

  if (!cleaned) {
    throw new Error(
      `${fieldName} is required.`
    );
  }

  return cleaned;
}

function cleanOptionalNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}

function isValidHttpUrl(
  value: string
): boolean {
  try {
    const parsed =
      new URL(value);

    return (
      parsed.protocol ===
        "https:" ||
      parsed.protocol ===
        "http:"
    );
  } catch {
    return false;
  }
}

function parseBoolean(
  value: FormDataEntryValue | null
): boolean {
  return (
    String(
      value || ""
    )
      .trim()
      .toLowerCase() ===
    "true"
  );
}

function normalizeIdentityText(
  raw: string
): string {
  const cleaned =
    raw
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .toLowerCase()
      .replace(
        /[^a-z0-9 ]/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  const seen =
    new Set<string>();

  return cleaned
    .split(" ")
    .map(
      (token) =>
        OCR_FIXES[token] ||
        token
    )
    .filter(
      (token) =>
        token.length >= 2
    )
    .filter(
      (token) =>
        !STOPWORDS.has(
          token
        )
    )
    .filter((token) => {
      if (
        seen.has(token)
      ) {
        return false;
      }

      seen.add(token);

      return true;
    })
    .join(" ");
}

function identityTokens(
  raw: string,
  limit = 32
): string[] {
  return normalizeIdentityText(
    raw
  )
    .split(" ")
    .filter(Boolean)
    .slice(
      0,
      limit
    );
}

function canonicalTokens(
  raw: string
): string[] {
  return Array.from(
    new Set(
      identityTokens(raw)
    )
  ).sort();
}

function shortHash(
  value: string,
  length = 12
): string {
  return createHash(
    "sha256"
  )
    .update(value)
    .digest("hex")
    .slice(
      0,
      length
    );
}

function createAliasId(
  raw: string
): string {
  const normalized =
    normalizeIdentityText(
      raw
    );

  const readable =
    normalized
      .split(" ")
      .slice(
        0,
        12
      )
      .join("-")
      .slice(
        0,
        72
      )
      .replace(
        /^-+|-+$/g,
        ""
      );

  const digest =
    shortHash(
      normalized,
      12
    );

  return readable
    ? `${readable}-${digest}`
    : `alias-${digest}`;
}

function legacyMasterId(
  storageCollection: string
): string {
  return (
    "prd_legacy_" +
    shortHash(
      storageCollection
        .toLowerCase(),
      24
    )
  );
}

function newMasterId(): string {
  return (
    "prd_" +
    randomUUID()
      .replace(
        /-/g,
        ""
      )
      .toLowerCase()
  );
}

function getBrandTokens(
  brandName: string
): string[] {
  return identityTokens(
    brandName,
    8
  );
}

function getLegacyAliasTokens(
  aliasId: string
): string[] {
  return aliasId
    .replace(
      /-[a-f0-9]{12}$/i,
      ""
    )
    .split("-")
    .map(
      (token) =>
        token.trim()
    )
    .filter(
      (token) =>
        token.length >= 2
    );
}

function calculateMatch(
  scanTokens: string[],
  aliasTokens: string[]
): {
  score: number;
  matches: number;
  coverage: number;
  matched: string[];
} {
  const usedAliasIndexes =
    new Set<number>();

  const matched:
    string[] = [];

  let score = 0;
  let matches = 0;

  for (
    const scanToken of
    scanTokens
  ) {
    let bestIndex =
      -1;

    let bestValue =
      0;

    for (
      let index = 0;
      index <
      aliasTokens.length;
      index += 1
    ) {
      if (
        usedAliasIndexes.has(
          index
        )
      ) {
        continue;
      }

      const aliasToken =
        aliasTokens[index];

      let value = 0;

      if (
        scanToken ===
        aliasToken
      ) {
        value = 1;
      } else if (
        scanToken.length >= 5 &&
        aliasToken.length >= 5 &&
        (
          scanToken.startsWith(
            aliasToken
          ) ||
          aliasToken.startsWith(
            scanToken
          )
        )
      ) {
        value = 0.65;
      }

      if (
        value >
        bestValue
      ) {
        bestValue =
          value;

        bestIndex =
          index;
      }
    }

    if (
      bestIndex >= 0 &&
      bestValue > 0
    ) {
      usedAliasIndexes.add(
        bestIndex
      );

      score +=
        bestValue;

      matches +=
        1;

      matched.push(
        scanToken
      );
    }
  }

  const coverage =
    matches /
    Math.max(
      1,
      new Set(
        aliasTokens
      ).size
    );

  return {
    score,
    matches,
    coverage,
    matched,
  };
}

async function resolveProduct(
  params: {
    rawOcr: string;
    brandName: string;
    productName: string;
  }
): Promise<ProductResolutionResult> {
  const {
    rawOcr,
    brandName,
    productName,
  } = params;

  const normalizedOcr =
    normalizeIdentityText(
      rawOcr
    );

  const tokens =
    identityTokens(
      rawOcr
    );

  if (
    tokens.length < 2
  ) {
    throw new Error(
      "Enter at least two meaningful words visible on the product packaging."
    );
  }

  const brandTokens =
    getBrandTokens(
      brandName
    );

  const scanSet =
    new Set(
      tokens
    );

  const brandSet =
    new Set(
      brandTokens
    );

  const aliasId =
    createAliasId(
      rawOcr
    );

  const aliasRef =
    adminDb
      .collection(
        "aliases"
      )
      .doc(
        aliasId
      );

  /*
   * Exact alias fast path.
   */
  const exactAlias =
    await aliasRef.get();

  if (
    exactAlias.exists
  ) {
    const alias =
      exactAlias.data() as Record<
        string,
        any
      >;

    const collectionId =
      cleanString(
        alias.storage_collection ||
        alias.canonical_collection
      );

    if (
      collectionId
    ) {
      const masterId =
        cleanString(
          alias.master_id
        ) ||
        legacyMasterId(
          collectionId
        );

      return {
        collectionId,

        masterId,

        canonicalName:
          productName ||
          cleanString(
            alias.canonical_name
          ) ||
          rawOcr,

        canonicalSlug:
          collectionId,

        aliasId,

        rawOcr,
        normalizedOcr,

        tokens,

        brandTokens,

        resolution:
          "exact_alias",

        collectionExisted:
          true,

        aliasExisted:
          true,

        matcherVersion:
          `web-product-identity-v${PRODUCT_IDENTITY_VERSION}`,
      };
    }
  }

  /*
   * Conservative existing-product resolution.
   *
   * Product 2 MUST NOT weaken the matching safeguards
   * already used by the app.
   */
  const aliasesSnapshot =
    await adminDb
      .collection(
        "aliases"
      )
      .get();

  type Candidate = {
    masterId: string;
    collectionId: string;

    score: number;
    matches: number;
    coverage: number;

    distinguishingMatches:
      number;
  };

  const bestByMaster =
    new Map<
      string,
      Candidate
    >();

  for (
    const aliasDocument of
    aliasesSnapshot.docs
  ) {
    const alias =
      aliasDocument.data() as Record<
        string,
        any
      >;

    const collectionId =
      cleanString(
        alias.storage_collection ||
        alias.canonical_collection
      );

    if (
      !collectionId
    ) {
      continue;
    }

    const masterId =
      cleanString(
        alias.master_id
      ) ||
      legacyMasterId(
        collectionId
      );

    const storedTokens =
      Array.isArray(
        alias.identity_tokens
      ) &&
      alias.identity_tokens
        .length > 0
        ? alias.identity_tokens
            .map(cleanString)
            .filter(Boolean)
        : getLegacyAliasTokens(
            aliasDocument.id
          );

    if (
      storedTokens.length <
      3
    ) {
      continue;
    }

    const storedBrandTokens =
      Array.isArray(
        alias.brand_tokens
      )
        ? alias.brand_tokens
            .map(cleanString)
            .filter(Boolean)
        : [];

    const storedBrandSet =
      new Set(
        storedBrandTokens
      );

    /*
     * When both records have explicit Brand evidence,
     * the Brand must agree.
     */
    if (
      brandSet.size > 0 &&
      storedBrandSet.size >
        0 &&
      !Array.from(
        brandSet
      ).some(
        (token) =>
          storedBrandSet.has(
            token
          )
      )
    ) {
      continue;
    }

    /*
     * Existing Brand metadata must also be visible in
     * the current OCR.
     */
    if (
      storedBrandSet.size >
        0 &&
      !Array.from(
        storedBrandSet
      ).some(
        (token) =>
          scanSet.has(
            token
          )
      )
    ) {
      continue;
    }

    const match =
      calculateMatch(
        tokens,
        storedTokens
      );

    if (
      match.matches <= 0
    ) {
      continue;
    }

    const brandEvidence =
      storedBrandSet.size >
      0
        ? storedBrandSet
        : brandSet;

    const distinguishingMatches =
      new Set(
        match.matched.filter(
          (token) =>
            !brandEvidence.has(
              token
            )
        )
      ).size;

    const finalScore =
      match.score +
      match.coverage *
        2 +
      distinguishingMatches *
        0.15;

    const candidate: Candidate =
      {
        masterId,
        collectionId,

        score:
          finalScore,

        matches:
          match.matches,

        coverage:
          match.coverage,

        distinguishingMatches,
      };

    const currentBest =
      bestByMaster.get(
        masterId
      );

    if (
      !currentBest ||
      candidate.score >
        currentBest.score
    ) {
      bestByMaster.set(
        masterId,
        candidate
      );
    }
  }

  const ranked =
    Array.from(
      bestByMaster.values()
    ).sort(
      (
        first,
        second
      ) => {
        if (
          Math.abs(
            second.score -
              first.score
          ) >
          0.001
        ) {
          return (
            second.score -
            first.score
          );
        }

        if (
          first.matches !==
          second.matches
        ) {
          return (
            second.matches -
            first.matches
          );
        }

        return (
          second.coverage -
          first.coverage
        );
      }
    );

  const best =
    ranked[0];

  const runnerUp =
    ranked[1];

  if (best) {
    const margin =
      runnerUp
        ? best.score -
          runnerUp.score
        : Number
            .POSITIVE_INFINITY;

    const accepted =
      best.matches >= 5 &&
      best.coverage >=
        0.6 &&
      best
        .distinguishingMatches >=
        3 &&
      margin >=
        1.25;

    if (accepted) {
      return {
        collectionId:
          best.collectionId,

        masterId:
          best.masterId,

        canonicalName:
          productName ||
          rawOcr,

        canonicalSlug:
          best.collectionId,

        aliasId,

        rawOcr,
        normalizedOcr,

        tokens,

        brandTokens,

        resolution:
          "existing_collection",

        collectionExisted:
          true,

        aliasExisted:
          false,

        matcherVersion:
          `web-product-identity-v${PRODUCT_IDENTITY_VERSION}`,
      };
    }
  }

  /*
   * New product.
   *
   * The permanent product ID is intentionally independent
   * of OCR wording.
   */
  const masterId =
    newMasterId();

  return {
    collectionId:
      masterId,

    masterId,

    canonicalName:
      productName ||
      rawOcr,

    canonicalSlug:
      masterId,

    aliasId,

    rawOcr,
    normalizedOcr,

    tokens,

    brandTokens,

    resolution:
      "created_collection",

    collectionExisted:
      false,

    aliasExisted:
      false,

    matcherVersion:
      `web-product-identity-v${PRODUCT_IDENTITY_VERSION}`,
  };
}

function getTargetExtension(
  contentType: string
): string {
  switch (
    contentType
  ) {
    case "image/jpeg":
      return "jpg";

    case "image/png":
      return "png";

    case "image/webp":
      return "webp";

    case "image/heic":
      return "heic";

    case "image/heif":
      return "heif";

    default:
      return "bin";
  }
}

function getFirebaseDownloadUrl(
  params: {
    bucketName: string;
    objectName: string;
    downloadToken: string;
  }
): string {
  return (
    "https://firebasestorage.googleapis.com/v0/b/" +
    `${encodeURIComponent(
      params.bucketName
    )}/o/` +
    `${encodeURIComponent(
      params.objectName
    )}` +
    `?alt=media&token=${encodeURIComponent(
      params.downloadToken
    )}`
  );
}

async function uploadFile(
  params: {
    file: File;

    storagePath: string;

    contentType: string;

    metadata:
      Record<
        string,
        string
      >;
  }
): Promise<{
  url: string;
  storagePath: string;
}> {
  const bucket =
    adminStorage.bucket();

  const storageFile =
    bucket.file(
      params.storagePath
    );

  const downloadToken =
    randomUUID();

  const buffer =
    Buffer.from(
      await params.file.arrayBuffer()
    );

  await storageFile.save(
    buffer,
    {
      resumable:
        false,

      validation:
        "crc32c",

      metadata: {
        contentType:
          params.contentType,

        cacheControl:
          "public,max-age=3600",

        metadata: {
          firebaseStorageDownloadTokens:
            downloadToken,

          ...params.metadata,
        },
      },
    }
  );

  return {
    url:
      getFirebaseDownloadUrl({
        bucketName:
          bucket.name,

        objectName:
          params.storagePath,

        downloadToken,
      }),

    storagePath:
      params.storagePath,
  };
}

async function deleteStorageObject(
  path: string | null
) {
  if (!path) {
    return;
  }

  try {
    await adminStorage
      .bucket()
      .file(path)
      .delete({
        ignoreNotFound:
          true,
      });
  } catch (
    cleanupError
  ) {
    console.error(
      "Product 2 orphan cleanup failed:",
      cleanupError
    );
  }
}

export async function POST(
  request: Request
) {
  let uploadedMediaPath:
    string | null =
    null;

  let uploadedTargetPath:
    string | null =
    null;

  try {
    /*
     * =====================================================
     * 1. Authenticate Brand
     * =====================================================
     */

    const idToken =
      getBearerToken(
        request
      );

    if (!idToken) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    const decodedToken =
      await adminAuth.verifyIdToken(
        idToken
      );

    const brandUserId =
      decodedToken.uid;

    const [
      userSnapshot,
      brandSnapshot,
    ] =
      await Promise.all([
        adminDb
          .collection(
            "users"
          )
          .doc(
            brandUserId
          )
          .get(),

        adminDb
          .collection(
            "brands"
          )
          .doc(
            brandUserId
          )
          .get(),
      ]);

    const userData =
      userSnapshot.exists
        ? userSnapshot.data()
        : null;

    const brandData =
      brandSnapshot.exists
        ? brandSnapshot.data()
        : null;

    if (
      !userSnapshot.exists &&
      !brandSnapshot.exists
    ) {
      return NextResponse.json(
        {
          error:
            "Brand account not found.",
        },
        {
          status: 404,
        }
      );
    }

    const role =
      cleanString(
        userData?.role ||
        brandData?.role ||
        decodedToken.role
      );

    if (
      role &&
      role !== "brand"
    ) {
      return NextResponse.json(
        {
          error:
            "Brand authorization required.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * =====================================================
     * 2. Read Product 2 draft
     * =====================================================
     */

    const formData =
      await request.formData();

    const brandName =
      cleanRequiredString(
        formData.get(
          "brandName"
        ) ||
        brandData?.brandName ||
        brandData?.displayName ||
        userData?.brandName ||
        userData?.displayName,
        "Brand name"
      );

    const productName =
      cleanRequiredString(
        formData.get(
        "productName"
        ),
        "Product name"
    );

    const linkUrl =
      cleanRequiredString(
        formData.get(
        "linkUrl"
        ),
        "Link URL"
    );

    if (
      !isValidHttpUrl(
        linkUrl
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Link URL must be a valid HTTP or HTTPS URL.",
        },
        {
          status: 400,
        }
      );
    }

    const rawOcr =
      cleanRequiredString(
        formData.get(
        "rawOcr"
        ),
        "Product packaging text"
    );

    const recognitionConfidence =
      cleanOptionalNumber(
        formData.get(
          "recognitionConfidence"
        )
      );

    const contentOwnershipType =
      cleanString(
        formData.get(
          "contentOwnershipType"
        )
      ) as ContentOwnershipType;

    if (
      contentOwnershipType !==
        "brand_owned" &&
      contentOwnershipType !==
        "external_creator"
    ) {
      return NextResponse.json(
        {
          error:
            "Select who owns or controls this content.",
        },
        {
          status: 400,
        }
      );
    }

    const externalCreatorName =
      cleanString(
        formData.get(
          "externalCreatorName"
        )
      );

    if (
      contentOwnershipType ===
        "external_creator" &&
      !externalCreatorName
    ) {
      return NextResponse.json(
        {
          error:
            "Enter the external Creator's name.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * 3. Rights certification
     * =====================================================
     */

    const contentRightsConfirmed =
      parseBoolean(
        formData.get(
          "contentRightsConfirmed"
        )
      );

    const audioRightsConfirmed =
      parseBoolean(
        formData.get(
          "audioRightsConfirmed"
        )
      );

    const appearanceRightsConfirmed =
      parseBoolean(
        formData.get(
          "appearanceRightsConfirmed"
        )
      );

    const brandUsageApproved =
      parseBoolean(
        formData.get(
          "brandUsageApproved"
        )
      );

    const goshshaDistributionLicenseGranted =
      parseBoolean(
        formData.get(
          "goshshaDistributionLicenseGranted"
        )
      );

    if (
      !contentRightsConfirmed ||
      !appearanceRightsConfirmed ||
      !brandUsageApproved ||
      !goshshaDistributionLicenseGranted
    ) {
      return NextResponse.json(
        {
          error:
            "Complete all required rights and distribution certifications before creating the Retail Media draft.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Audio is intentionally separate.
     *
     * A Brand may certify the visual content but not have
     * sufficient audio rights. That content can still be
     * distributed muted.
     */

    /*
     * =====================================================
     * 4. Validate original media
     * =====================================================
     */

    const mediaValue =
      formData.get(
        "originalMedia"
      );

    if (
      !mediaValue ||
      typeof mediaValue ===
        "string"
    ) {
      return NextResponse.json(
        {
          error:
            "Upload the video you want to activate.",
        },
        {
          status: 400,
        }
      );
    }

    const originalMedia =
      mediaValue as File;

    const mediaFileName =
      cleanRequiredString(
        originalMedia.name,
        "Media filename"
      );

    const mediaContentType =
      cleanString(
        originalMedia.type
      );

    /*
     * Product 2 uses the same current playback limitation
     * as Product 1.
     *
     * .mp4 and .MP4 both pass because the comparison is
     * case-insensitive.
     */
    if (
      !mediaFileName
        .toLowerCase()
        .endsWith(
          ".mp4"
        ) ||
      (
        mediaContentType &&
        mediaContentType !==
          "video/mp4" &&
        mediaContentType !==
          "application/octet-stream"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Please upload your video as an MP4 (.mp4 or .MP4). MOV and other video formats are not yet supported by Goshsha Retail Media.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(
        originalMedia.size
      ) ||
      originalMedia.size <=
        0
    ) {
      return NextResponse.json(
        {
          error:
            "The uploaded video appears to be empty.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      originalMedia.size >
      MAX_MEDIA_BYTES
    ) {
      return NextResponse.json(
        {
          error:
            "The video must be 250 MB or smaller.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * 5. Validate target product image
     * =====================================================
     */

    const targetImageValue =
      formData.get(
        "targetImage"
      );

    if (
      !targetImageValue ||
      typeof targetImageValue ===
        "string"
    ) {
      return NextResponse.json(
        {
          error:
            "Upload the exact product image shoppers will scan.",
        },
        {
          status: 400,
        }
      );
    }

    const targetImage =
      targetImageValue as File;

    const targetContentType =
      cleanRequiredString(
        targetImage.type,
        "Target image content type"
      );

    if (
      !ALLOWED_TARGET_IMAGE_TYPES.has(
        targetContentType
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Target image must be JPEG, PNG, WebP, HEIC, or HEIF.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(
        targetImage.size
      ) ||
      targetImage.size <=
        0
    ) {
      return NextResponse.json(
        {
          error:
            "The target image appears to be empty.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      targetImage.size >
      MAX_TARGET_IMAGE_BYTES
    ) {
      return NextResponse.json(
        {
          error:
            "The target image must be 25 MB or smaller.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * 6. Resolve product identity
     * =====================================================
     */

    const productResolution =
      await resolveProduct({
        rawOcr,
        brandName,
        productName,
      });

    /*
     * =====================================================
     * 7. Determine Retail Asset identity
     * =====================================================
     */

    /*
     * Identical content + product + packaging intentionally
     * resolves back to the same draft asset.
     *
     * Retail Assets are permanent business objects.
     */
    const directDraftFingerprint =
      shortHash(
        [
          brandUserId,
          productResolution
            .collectionId,
          mediaFileName
            .toLowerCase(),
          String(
            originalMedia.size
          ),
          targetImage.name
            .toLowerCase(),
          String(
            targetImage.size
          ),
        ].join("|"),
        32
      );

    const retailAssetId =
      `rm2_${directDraftFingerprint}`;

    const retailAssetRef =
      adminDb
        .collection(
          "retailAssets"
        )
        .doc(
          retailAssetId
        );

    const existingAssetSnapshot =
      await retailAssetRef.get();

    if (
      existingAssetSnapshot.exists
    ) {
      const existingAsset =
        existingAssetSnapshot.data() as Record<
          string,
          any
        >;

      if (
        cleanString(
          existingAsset.brandId
        ) !==
        brandUserId
      ) {
        return NextResponse.json(
          {
            error:
              "A conflicting Retail Asset already exists.",
          },
          {
            status: 409,
          }
        );
      }

      return NextResponse.json({
        ok: true,

        reusedExistingDraft:
          true,

        retailAsset: {
          retailAssetId,

          campaignId:
            null,

          creatorId:
            cleanString(
              existingAsset
                .creatorId
            ) ||
            null,

          brandId:
            brandUserId,

          collectionId:
            existingAsset
              .collectionId,

          entryId:
            existingAsset
              .entryId,

          status:
            existingAsset
              .status ||
            "draft",

          sourceProduct:
            "retail_media",

          productResolution:
            existingAsset
              .recognition ||
            productResolution,
        },

        publication: {
          status:
            existingAsset
              .distribution
              ?.publishedToPlaylist
              ? "published"
              : "draft",

          arEntryCreated:
            Boolean(
              existingAsset
                .distribution
                ?.publishedToPlaylist
            ),

          masterPlaylistUpdated:
            Boolean(
              existingAsset
                .distribution
                ?.publishedToPlaylist
            ),

          licenseStarted:
            Boolean(
              existingAsset
                .license
                ?.startsAt
            ),

          activationStarted:
            Boolean(
              existingAsset
                .activation
                ?.startsAt
            ),
        },
      });
    }

    /*
     * =====================================================
     * 8. Upload media + target
     * =====================================================
     */

    const mediaStoragePath =
      [
        "retail-media-source",
        brandUserId,
        retailAssetId,
        `${randomUUID()}.mp4`,
      ].join("/");

    uploadedMediaPath =
      mediaStoragePath;

    const uploadedMedia =
      await uploadFile({
        file:
          originalMedia,

        storagePath:
          mediaStoragePath,

        contentType:
          "video/mp4",

        metadata: {
          retailAssetId,

          brandId:
            brandUserId,

          sourceProduct:
            "product_2",

          uploadPurpose:
            "retail_media_source",
        },
      });

    const targetExtension =
      getTargetExtension(
        targetContentType
      );

    const targetStoragePath =
      [
        "retail-media-targets",
        brandUserId,
        retailAssetId,
        `${randomUUID()}.${targetExtension}`,
      ].join("/");

    uploadedTargetPath =
      targetStoragePath;

    const uploadedTarget =
      await uploadFile({
        file:
          targetImage,

        storagePath:
          targetStoragePath,

        contentType:
          targetContentType,

        metadata: {
          retailAssetId,

          brandId:
            brandUserId,

          sourceProduct:
            "product_2",

          uploadPurpose:
            "retail_media_target",
        },
      });

    /*
     * =====================================================
     * 9. Create shared Retail Asset
     * =====================================================
     */

    const entryId =
      `direct-${retailAssetId}-v1`;

    const creatorRetainsCopyright =
      contentOwnershipType ===
      "external_creator";

    const ownerId =
      contentOwnershipType ===
      "brand_owned"
        ? brandUserId
        : `external_creator:${shortHash(
            externalCreatorName,
            20
          )}`;

    const assetData =
      {
        retailAssetId,

        retailAssetSchemaVersion:
          2,

        directDraftSchemaVersion:
          PRODUCT_2_SCHEMA_VERSION,

        /*
         * Product 2 identity
         */
        sourceProduct:
          "retail_media",

        commercialSource: {
          product:
            "product_2",

          acquisitionType:
            "pay_as_you_go",

          purchaseDefinitionKey:
            "product_2_single_activation",
        },

        campaignId:
          null,

        creatorId:
          null,

        brandId:
          brandUserId,

        collectionId:
          productResolution
            .collectionId,

        entryId,

        masterPlaylistId:
          productResolution
            .collectionId,

        status:
          "draft",

        directDraftKey:
          directDraftFingerprint,

        brandName,

        productName,

        /*
         * Original Product 2 video.
         *
         * Playback-copy normalization occurs later during
         * publication through the shared publisher.
         */
        media: {
          url:
            uploadedMedia.url,

          storagePath:
            uploadedMedia
              .storagePath,

          originalName:
            mediaFileName,

          contentType:
            "video/mp4",

          sizeBytes:
            originalMedia.size,

          publicPostUrl:
            linkUrl,

          uploadedBy:
            brandUserId,

          source:
            "brand_direct_upload",

          uploadedAt:
            FieldValue.serverTimestamp(),
        },

        targetImage: {
          url:
            uploadedTarget.url,

          storagePath:
            uploadedTarget
              .storagePath,

          originalName:
            targetImage.name ||
            null,

          contentType:
            targetContentType,

          sizeBytes:
            targetImage.size,

          uploadedBy:
            brandUserId,

          uploadedAt:
            FieldValue.serverTimestamp(),
        },

        ownership: {
          ownerType:
            contentOwnershipType ===
            "brand_owned"
              ? "brand"
              : "creator",

          ownerId,

          creatorId:
            null,

          brandId:
            brandUserId,

          creatorRetainsCopyright,

          contentOwnershipType,

          externalCreatorName:
            externalCreatorName ||
            null,

          certifiedAt:
            FieldValue.serverTimestamp(),
        },

        rights: {
          status:
            "certified",

          contentRightsConfirmed,

          audioRightsConfirmed,

          appearanceRightsConfirmed,

          brandUsageApproved,

          goshshaDistributionLicenseGranted,

          certificationVersion:
            "product2-1.0",

          certifiedByUserId:
            brandUserId,

          certifiedByRole:
            "brand",

          certifiedAt:
            FieldValue.serverTimestamp(),

          revokedAt:
            null,

          revokedReason:
            null,
        },

        /*
         * The license clock does NOT start here.
         */
        license: {
          type:
            "fixed_term",

          status:
            "pending",

          startsAt:
            null,

          expiresAt:
            null,

          durationDays:
            90,

          renewalAllowed:
            true,

          qualifiedViewRate:
            null,

          currency:
            "USD",

          gracePeriodEndsAt:
            null,

          terminatedAt:
            null,

          terminationReason:
            null,
        },

        /*
         * Full visual video is allowed.
         *
         * Audio depends on Brand certification.
         */
        playback: {
          mode:
            "full_video",

          fullVideoAllowed:
            true,

          audioAllowed:
            audioRightsConfirmed,

          defaultMuted:
            true,

          autoplay:
            true,

          previewDurationSeconds:
            null,
        },

        /*
         * Draft only.
         *
         * Payment + activation credit must be satisfied
         * before publication is permitted.
         */
        activation: {
          status:
            "draft",

          startsAt:
            null,

          endsAt:
            null,

          publishedAt:
            null,

          pausedAt:
            null,

          expiredAt:
            null,

          archivedAt:
            null,

          distributionScope:
            "global",

          retailerIds:
            [],

          storeIds:
            [],

          distributionTargets: {
            countryCodes:
              [],

            regionIds:
              [],

            retailerIds:
              [],

            storeIds:
              [],

            eventIds:
              [],
          },
        },

        distribution: {
          status:
            "draft",

          publishedToPlaylist:
            false,

          masterPlaylistId:
            productResolution
              .collectionId,

          publishedAt:
            null,

          lastPublishAttemptAt:
            null,

          lastPublishError:
            null,
        },

        recognition: {
          collectionId:
            productResolution
              .collectionId,

          masterId:
            productResolution
              .masterId,

          canonicalName:
            productResolution
              .canonicalName,

          canonicalSlug:
            productResolution
              .canonicalSlug,

          aliasId:
            productResolution
              .aliasId,

          rawOcr:
            productResolution
              .rawOcr,

          normalizedOcr:
            productResolution
              .normalizedOcr,

          tokens:
            productResolution
              .tokens,

          brandTokens:
            productResolution
              .brandTokens,

          detectedBrand:
            brandName,

          productName,

          confidence:
            recognitionConfidence,

          resolution:
            productResolution
              .resolution,

          collectionExisted:
            productResolution
              .collectionExisted,

          aliasExisted:
            productResolution
              .aliasExisted,

          matcherVersion:
            productResolution
              .matcherVersion,
        },

        metrics: {
          views:
            0,

          qualifiedViews:
            0,

          votesUp:
            0,

          votesDown:
            0,

          shares:
            0,

          lastViewedAt:
            null,

          lastQualifiedViewAt:
            null,
        },

        /*
         * Product 2 commercial state.
         */
        monetization: {
          product:
            "product_2",

          purchaseDefinitionKey:
            "product_2_single_activation",

          commerceStatus:
            "unpaid",

          paymentStatus:
            "pending",

          activationCreditId:
            null,

          commerceId:
            null,

          activationPriceUsd:
            99,

          currency:
            "USD",

          includedQualifiedViews:
            1000,

          qualifiedViewsUsed:
            0,

          overageQualifiedViews:
            0,

          overageStatus:
            "not_started",
        },

        audit: {
          createdBy:
            brandUserId,

          createdByRole:
            "brand",

          schemaVersion:
            2,

          assetVersion:
            1,

          sourceProduct:
            "product_2",

          createdAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        },

        createdAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      };

    /*
     * =====================================================
     * 10. Persist Product identity + Retail Asset
     * =====================================================
     */

    await adminDb.runTransaction(
      async (
        transaction
      ) => {
        const productRef =
          adminDb
            .collection(
              "products"
            )
            .doc(
              productResolution
                .masterId
            );

        const aliasRef =
          adminDb
            .collection(
              "aliases"
            )
            .doc(
              productResolution
                .aliasId
            );

        const collectionMetaRef =
          adminDb
            .collection(
              productResolution
                .collectionId
            )
            .doc(
              "_meta"
            );

        transaction.set(
          productRef,
          {
            master_id:
              productResolution
                .masterId,

            storage_collection:
              productResolution
                .collectionId,

            canonical_name:
              productResolution
                .canonicalName,

            normalized_ocr:
              productResolution
                .normalizedOcr,

            identity_tokens:
              productResolution
                .tokens,

            canonical_tokens:
              canonicalTokens(
                rawOcr
              ),

            canonical_fingerprint:
              canonicalTokens(
                rawOcr
              ).join("|"),

            brand_tokens:
              productResolution
                .brandTokens,

            identity_version:
              PRODUCT_IDENTITY_VERSION,

            status:
              "active",

            updated_at:
              FieldValue.serverTimestamp(),

            created_at:
              FieldValue.serverTimestamp(),
          },
          {
            merge:
              true,
          }
        );

        /*
         * Preserve canonical_collection because existing
         * iOS readers still use this field.
         */
        transaction.set(
          aliasRef,
          {
            master_id:
              productResolution
                .masterId,

            canonical_collection:
              productResolution
                .collectionId,

            storage_collection:
              productResolution
                .collectionId,

            canonical_name:
              productResolution
                .canonicalName,

            normalized_ocr:
              productResolution
                .normalizedOcr,

            identity_tokens:
              productResolution
                .tokens,

            canonical_tokens:
              canonicalTokens(
                rawOcr
              ),

            canonical_fingerprint:
              canonicalTokens(
                rawOcr
              ).join("|"),

            brand_tokens:
              productResolution
                .brandTokens,

            token_count:
              productResolution
                .tokens.length,

            identity_version:
              PRODUCT_IDENTITY_VERSION,

            updated_at:
              FieldValue.serverTimestamp(),
          },
          {
            merge:
              true,
          }
        );

        transaction.set(
          collectionMetaRef,
          {
            master_id:
              productResolution
                .masterId,

            storage_collection:
              productResolution
                .collectionId,

            canonical_name:
              productResolution
                .canonicalName,

            normalized_ocr:
              productResolution
                .normalizedOcr,

            source:
              "product_2_web",

            updated_at:
              FieldValue.serverTimestamp(),

            created_at:
              FieldValue.serverTimestamp(),
          },
          {
            merge:
              true,
          }
        );

        transaction.create(
          retailAssetRef,
          assetData
        );
      }
    );

    /*
     * =====================================================
     * 11. Success
     * =====================================================
     */

    return NextResponse.json(
      {
        ok:
          true,

        reusedExistingDraft:
          false,

        retailAsset: {
          retailAssetId,

          campaignId:
            null,

          creatorId:
            null,

          brandId:
            brandUserId,

          collectionId:
            productResolution
              .collectionId,

          entryId,

          status:
            "draft",

          sourceProduct:
            "retail_media",

          productResolution,
        },

        media: {
          url:
            uploadedMedia.url,

          storagePath:
            uploadedMedia
              .storagePath,

          contentType:
            "video/mp4",

          originalName:
            mediaFileName,

          sizeBytes:
            originalMedia.size,
        },

        targetImage: {
          url:
            uploadedTarget.url,

          storagePath:
            uploadedTarget
              .storagePath,

          contentType:
            targetContentType,

          originalName:
            targetImage.name ||
            null,

          sizeBytes:
            targetImage.size,
        },

        commerce: {
          product:
            "product_2",

          purchaseDefinitionKey:
            "product_2_single_activation",

          paymentStatus:
            "pending",

          activationCreditId:
            null,

          priceUsd:
            99,

          includedQualifiedViews:
            1000,
        },

        publication: {
          status:
            "draft",

          arEntryCreated:
            false,

          masterPlaylistUpdated:
            false,

          licenseStarted:
            false,

          activationStarted:
            false,

          scanReady:
            false,
        },
      },
      {
        status:
          201,
      }
    );
  } catch (error: any) {
    console.error(
      "Create Product 2 direct Retail Media draft error:",
      error
    );

    /*
     * A Retail Asset is permanent once created.
     *
     * These deletions only remove orphaned uploads when
     * draft creation itself failed before the authoritative
     * Retail Asset was successfully committed.
     */

    await Promise.all([
      deleteStorageObject(
        uploadedMediaPath
      ),

      deleteStorageObject(
        uploadedTargetPath
      ),
    ]);

    const authenticationError =
      error?.code ===
        "auth/id-token-expired" ||
      error?.code ===
        "auth/invalid-id-token" ||
      error?.code ===
        "auth/argument-error";

    return NextResponse.json(
      {
        error:
          authenticationError
            ? "Your login session expired. Please log in again."
            : error?.message ||
              "Failed to create the Product 2 Retail Media draft.",
      },
      {
        status:
          authenticationError
            ? 401
            : 500,
      }
    );
  }
}