import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  adminAuth,
  adminDb,
} from "../../../../../lib/firebase-admin";

/*
 * =========================================================
 * IRL Retail Media — Load Existing Direct Retail Asset
 * =========================================================
 *
 * Reconstructs an existing Product 2 Retail Asset for the
 * Brand-facing Direct Retail Media page.
 *
 * This route is READ-ONLY.
 *
 * It does NOT:
 *
 * - create a Retail Asset
 * - modify a Retail Asset
 * - create an AR Entry
 * - publish content
 * - consume activation credits
 * - determine authoritative payment state
 *
 * Payment / credit authority remains:
 *
 * /api/brand/retail-media/activation-status
 */

function cleanString(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

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

export async function GET(
  request: NextRequest
) {
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

    const brandId =
      decodedToken.uid;

    /*
     * =====================================================
     * 2. Read Retail Asset ID
     * =====================================================
     */

    const retailAssetId =
      cleanString(
        request.nextUrl
          .searchParams
          .get(
            "retailAssetId"
          )
      );

    if (!retailAssetId) {
      return NextResponse.json(
        {
          error:
            "retailAssetId is required.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * 3. Load Retail Asset
     * =====================================================
     */

    const assetRef =
      adminDb
        .collection(
          "retailAssets"
        )
        .doc(
          retailAssetId
        );

    const assetSnapshot =
      await assetRef.get();

    if (
      !assetSnapshot.exists
    ) {
      return NextResponse.json(
        {
          error:
            "Retail Media item not found.",
        },
        {
          status: 404,
        }
      );
    }

    const asset =
      assetSnapshot.data() as Record<
        string,
        any
      >;

    /*
     * =====================================================
     * 4. Verify Brand ownership
     * =====================================================
     */

    if (
      cleanString(
        asset.brandId
      ) !== brandId
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to view this Retail Media item.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * =====================================================
     * 5. Verify Product 2
     * =====================================================
     */

    const commercialProduct =
      cleanString(
        asset
          .commercialSource
          ?.product ||
        asset
          .monetization
          ?.product ||
        asset
          .audit
          ?.sourceProduct
      );

    const isProduct2 =
      commercialProduct ===
        "product_2" ||
      (
        asset.campaignId ==
          null &&
        asset.sourceProduct ===
          "retail_media"
      );

    if (!isProduct2) {
      return NextResponse.json(
        {
          error:
            "This Retail Asset is not an IRL Retail Media direct activation.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * =====================================================
     * 6. Reconstruct DirectDraftResponse
     * =====================================================
     *
     * This intentionally mirrors the shape returned by
     * create-direct-draft so the existing Direct page can
     * reuse its current state model.
     */

    const published =
      asset.distribution
        ?.publishedToPlaylist ===
      true;

    const activationStarted =
      Boolean(
        asset.activation
          ?.startsAt
      );

    const licenseStarted =
      Boolean(
        asset.license
          ?.startsAt
      );

    const productResolution =
      asset.recognition ||
      {
        collectionId:
          cleanString(
            asset.collectionId
          ),

        masterId:
          cleanString(
            asset.collectionId
          ),

        canonicalName:
          cleanString(
            asset.productName
          ),

        canonicalSlug:
          cleanString(
            asset.collectionId
          ),

        aliasId:
          "",

        rawOcr:
          "",

        normalizedOcr:
          "",

        tokens:
          [],

        brandTokens:
          [],

        resolution:
          "existing_collection",

        collectionExisted:
          true,

        aliasExisted:
          true,

        matcherVersion:
          "",
      };

    return NextResponse.json({
      ok: true,

      loadedExistingDraft:
        true,

      retailAsset: {
        retailAssetId,

        campaignId:
          null,

        creatorId:
          cleanString(
            asset.creatorId
          ) ||
          null,

        brandId,

        collectionId:
          cleanString(
            asset.collectionId
          ),

        entryId:
          cleanString(
            asset.entryId
          ),

        status:
          cleanString(
            asset.status
          ) ||
          "draft",

        sourceProduct:
          "retail_media",

        productResolution,
      },

      /*
       * Brand-facing fields used to repopulate the page.
       */
      form: {
        brandName:
          cleanString(
            asset.brandName
          ),

        productName:
          cleanString(
            asset.productName ||
            asset.recognition
              ?.productName
          ),

        linkUrl:
          cleanString(
            asset.media
              ?.publicPostUrl
          ),

        rawOcr:
          cleanString(
            asset.recognition
              ?.rawOcr
          ),

        recognitionConfidence:
          asset.recognition
            ?.confidence ??
          null,

        contentOwnershipType:
          cleanString(
            asset.ownership
              ?.contentOwnershipType
          ) ||
          "brand_owned",

        externalCreatorName:
          cleanString(
            asset.ownership
              ?.externalCreatorName
          ),

        rights: {
          contentRightsConfirmed:
            asset.rights
              ?.contentRightsConfirmed ===
            true,

          audioRightsConfirmed:
            asset.rights
              ?.audioRightsConfirmed ===
            true,

          appearanceRightsConfirmed:
            asset.rights
              ?.appearanceRightsConfirmed ===
            true,

          brandUsageApproved:
            asset.rights
              ?.brandUsageApproved ===
            true,

          goshshaDistributionLicenseGranted:
            asset.rights
              ?.goshshaDistributionLicenseGranted ===
            true,
        },
      },

      media: {
        url:
          cleanString(
            asset.media
              ?.url
          ),

        storagePath:
          cleanString(
            asset.media
              ?.storagePath
          ),

        contentType:
          cleanString(
            asset.media
              ?.contentType
          ) ||
          "video/mp4",

        originalName:
          cleanString(
            asset.media
              ?.originalName
          ),

        sizeBytes:
          Number(
            asset.media
              ?.sizeBytes ||
            0
          ),
      },

      targetImage: {
        url:
          cleanString(
            asset.targetImage
              ?.url
          ),

        storagePath:
          cleanString(
            asset.targetImage
              ?.storagePath
          ),

        contentType:
          cleanString(
            asset.targetImage
              ?.contentType
          ),

        originalName:
          cleanString(
            asset.targetImage
              ?.originalName
          ) ||
          null,

        sizeBytes:
          Number(
            asset.targetImage
              ?.sizeBytes ||
            0
          ),
      },

      /*
       * This is only the Retail Asset snapshot.
       *
       * activation-status remains authoritative for current
       * Stripe payment + activation credit state.
       */
      commerce: {
        product:
          "product_2",

        purchaseDefinitionKey:
          cleanString(
            asset.monetization
              ?.purchaseDefinitionKey
          ) ||
          "product_2_single_activation",

        paymentStatus:
          cleanString(
            asset.monetization
              ?.paymentStatus
          ) ||
          "pending",

        activationCreditId:
          cleanString(
            asset.monetization
              ?.activationCreditId
          ) ||
          null,

        priceUsd:
          Number(
            asset.monetization
              ?.activationPriceUsd ??
            99
          ),

        includedQualifiedViews:
          Number(
            asset.monetization
              ?.includedQualifiedViews ??
            1000
          ),
      },

      publication: {
        status:
          published
            ? "published"
            : "draft",

        arEntryCreated:
          published,

        masterPlaylistUpdated:
          published,

        licenseStarted,

        activationStarted,

        scanReady:
          published &&
          cleanString(
            asset.activation
              ?.status
          ) ===
            "active",
      },
    });
  } catch (
    error: any
  ) {
    console.error(
      "Load IRL Retail Media item error:",
      error
    );

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
              "Failed to load this Retail Media item.",
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