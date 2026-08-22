import { NextResponse } from "next/server";

import {
  adminAuth,
  adminDb,
} from "../../../../../lib/firebase-admin";

import {
  publishRetailAsset,
  type PublishRetailAssetInput,
} from "../../../../../lib/retail-media/publish-retail-asset";

type PublishRetailAssetRequest = {
  retailAssetId?: string;

  distributionScope?:
    | "global"
    | "country"
    | "region"
    | "retailer"
    | "store"
    | "event";

  countryCodes?: string[];
  regionIds?: string[];
  retailerIds?: string[];
  storeIds?: string[];
  eventIds?: string[];
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
    .slice("Bearer ".length)
    .trim();
}

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
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const cleaned =
    value.trim();

  return cleaned || null;
}

function cleanOptionalStringArray(
  value: unknown
): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return Array.from(
    new Set(
      value
        .map((item) =>
          typeof item === "string"
            ? item.trim()
            : ""
        )
        .filter(Boolean)
    )
  );
}

function isAdminRole(
  params: {
    decodedToken: Record<
      string,
      any
    >;

    userRole: string | null;
  }
): boolean {
  const {
    decodedToken,
    userRole,
  } = params;

  return (
    decodedToken.admin ===
      true ||
    decodedToken.role ===
      "admin" ||
    decodedToken.userRole ===
      "admin" ||
    userRole ===
      "admin"
  );
}

function isBrandRole(
  params: {
    decodedToken: Record<
      string,
      any
    >;

    userRole: string | null;
    brandExists: boolean;
  }
): boolean {
  const {
    decodedToken,
    userRole,
    brandExists,
  } = params;

  return (
    userRole === "brand" ||
    decodedToken.role ===
      "brand" ||
    decodedToken.userRole ===
      "brand" ||
    brandExists
  );
}

function mapKnownError(
  errorMessage: string
): {
  status: number;
  message: string;
} | null {
  /*
   * -----------------------------------------------------
   * Errors with additional details appended
   * -----------------------------------------------------
   */

  if (
    errorMessage.startsWith(
      "RETAIL_ASSET_NOT_PLAYLIST_ELIGIBLE:"
    )
  ) {
    return {
      status: 409,
      message:
        "This Retail Asset is not eligible for publication. Review its rights, license, activation, and playback settings.",
    };
  }

  if (
    errorMessage.startsWith(
      "MASTER_PLAYLIST_BUILD_FAILED:"
    )
  ) {
    return {
      status: 500,
      message:
        "The AR Entry was created, but the Goshsha Master playlist could not be updated. The asset was saved for recovery and was not marked live.",
    };
  }

  /*
   * -----------------------------------------------------
   * Exact known errors
   * -----------------------------------------------------
   */

  switch (errorMessage) {
    /*
     * =====================================================
     * Shared Retail Media errors
     * =====================================================
     */

    case "RETAIL_ASSET_NOT_FOUND":
      return {
        status: 404,
        message:
          "Retail Asset not found.",
      };

    case "NOT_AUTHORIZED_TO_PUBLISH":
      return {
        status: 403,
        message:
          "You do not have permission to publish this Retail Asset.",
      };

    /*
     * =====================================================
     * Product 1 — Campaign source validation
     * =====================================================
     */

    case "SOURCE_CAMPAIGN_NOT_FOUND":
      return {
        status: 404,
        message:
          "The source campaign could not be found.",
      };

    case "SOURCE_CAMPAIGN_NOT_APPROVED":
      return {
        status: 409,
        message:
          "The source Creator submission must be approved before Retail Media can be published.",
      };

    /*
     * =====================================================
     * Shared publication readiness
     * =====================================================
     */

    case "RETAIL_ASSET_RIGHTS_NOT_READY":
      return {
        status: 409,
        message:
          "The Retail Asset rights package is not ready for publication.",
      };

    case "RETAIL_ASSET_LICENSE_NOT_PUBLISHABLE":
      return {
        status: 409,
        message:
          "The Retail Asset license is not in a publishable state.",
      };

    case "RETAIL_ASSET_ACTIVATION_NOT_PUBLISHABLE":
      return {
        status: 409,
        message:
          "The Retail Asset activation is not in a publishable state.",
      };

    case "RETAIL_ASSET_PLAYBACK_NOT_READY":
      return {
        status: 409,
        message:
          "The Retail Asset playback configuration is not ready.",
      };

    case "RETAIL_ASSET_ALREADY_PUBLISHED":
      return {
        status: 409,
        message:
          "This Retail Asset is already published.",
      };

    /*
     * =====================================================
     * Product 2 — Payment + Activation Credit enforcement
     * =====================================================
     */

    case "PRODUCT_2_ACTIVATION_PAYMENT_REQUIRED":
      return {
        status: 402,
        message:
          "A paid Product 2 Retail Media activation is required before this asset can be published.",
      };

    case "PRODUCT_2_ACTIVATION_CREDIT_NOT_AVAILABLE":
      return {
        status: 409,
        message:
          "This Retail Media activation credit is no longer available. Purchase or apply another activation credit.",
      };

    case "PRODUCT_2_ACTIVATION_CREDIT_NOT_FOUND":
      return {
        status: 409,
        message:
          "The Retail Media activation credit could not be found. Refresh the activation status and try again.",
      };

    case "PRODUCT_2_PAYMENT_NOT_CONFIRMED":
      return {
        status: 409,
        message:
          "Your Retail Media payment has not finished processing yet. Wait a moment and refresh the activation status.",
      };

    case "PRODUCT_2_COMMERCE_RECORD_MISSING":
    case "PRODUCT_2_COMMERCE_RECORD_NOT_FOUND":
      return {
        status: 409,
        message:
          "The Retail Media purchase record could not be verified. Please contact Goshsha support before publishing.",
      };

    case "PRODUCT_2_BRAND_ID_MISSING":
      return {
        status: 409,
        message:
          "The Brand associated with this Product 2 Retail Asset could not be verified.",
      };

    case "PRODUCT_2_CREDIT_BRAND_MISMATCH":
    case "PRODUCT_2_COMMERCE_BRAND_MISMATCH":
      return {
        status: 403,
        message:
          "This Retail Media activation does not belong to the current Brand account.",
      };

    case "PRODUCT_2_VOLUME_PACK_EMPTY":
      return {
        status: 409,
        message:
          "This Retail Media volume pack has no remaining activation credits.",
      };

    /*
     * =====================================================
     * Unknown
     * =====================================================
     */

    default:
      return null;
  }
}

export async function POST(
  request: Request
) {
  try {
    /*
     * -----------------------------------------------------
     * Authenticate user
     * -----------------------------------------------------
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

    const authenticatedUid =
      decodedToken.uid;

    /*
     * -----------------------------------------------------
     * Resolve Brand/Admin role
     * -----------------------------------------------------
     */

    const [
      userSnapshot,
      brandSnapshot,
    ] =
      await Promise.all([
        adminDb
          .collection("users")
          .doc(authenticatedUid)
          .get(),

        adminDb
          .collection("brands")
          .doc(authenticatedUid)
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

    const userRole =
      cleanOptionalString(
        userData?.role ||
          brandData?.role
      );

    const adminAuthorized =
      isAdminRole({
        decodedToken,
        userRole,
      });

    const brandAuthorized =
      isBrandRole({
        decodedToken,
        userRole,
        brandExists:
          brandSnapshot.exists,
      });

    if (
      !adminAuthorized &&
      !brandAuthorized
    ) {
      return NextResponse.json(
        {
          error:
            "Brand or Admin authorization is required.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * Read and validate request
     * -----------------------------------------------------
     */

    const body =
      (await request.json()) as PublishRetailAssetRequest;

    const retailAssetId =
      cleanRequiredString(
        body.retailAssetId,
        "retailAssetId"
      );

    const allowedScopes =
      new Set([
        "global",
        "country",
        "region",
        "retailer",
        "store",
        "event",
      ]);

    const distributionScope =
      cleanOptionalString(
        body.distributionScope
      );

    if (
      distributionScope &&
      !allowedScopes.has(
        distributionScope
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid distribution scope.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Read the asset before calling the publishing service so
     * a Brand cannot use this endpoint to publish another
     * Brand's Retail Asset.
     */
    const retailAssetSnapshot =
      await adminDb
        .collection(
          "retailAssets"
        )
        .doc(retailAssetId)
        .get();

    if (
      !retailAssetSnapshot.exists
    ) {
      return NextResponse.json(
        {
          error:
            "Retail Asset not found.",
        },
        {
          status: 404,
        }
      );
    }

    const retailAsset =
      retailAssetSnapshot.data() as Record<
        string,
        any
      >;

    if (
      !adminAuthorized &&
      retailAsset.brandId !==
        authenticatedUid
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to publish this Retail Asset.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * Publish to the shared Goshsha infrastructure
     * -----------------------------------------------------
     */

    const publishInput: PublishRetailAssetInput = {
      retailAssetId,

      publishedByUserId:
        authenticatedUid,

      publishedByRole:
        adminAuthorized
          ? "admin"
          : "brand",

      distributionScope:
        distributionScope as
          | PublishRetailAssetInput["distributionScope"]
          | undefined,

      countryCodes:
        cleanOptionalStringArray(
          body.countryCodes
        ),

      regionIds:
        cleanOptionalStringArray(
          body.regionIds
        ),

      retailerIds:
        cleanOptionalStringArray(
          body.retailerIds
        ),

      storeIds:
        cleanOptionalStringArray(
          body.storeIds
        ),

      eventIds:
        cleanOptionalStringArray(
          body.eventIds
        ),
    };

    const result =
      await publishRetailAsset(
        publishInput
      );

    return NextResponse.json({
      ok: true,

      publication: {
        retailAssetId:
          result.retailAssetId,

        campaignId:
          result.campaignId,

        creatorId:
          result.creatorId,

        brandId:
          result.brandId,

        collectionId:
          result.collectionId,

        entryId:
          result.entryId,

        activationStartsAt:
          result.activationStartsAt
            .toDate()
            .toISOString(),

        activationEndsAt:
          result.activationEndsAt
            .toDate()
            .toISOString(),

        licenseStartsAt:
          result.licenseStartsAt
            .toDate()
            .toISOString(),

        licenseExpiresAt:
          result.licenseExpiresAt
            .toDate()
            .toISOString(),

        masterPlaylistPath:
          result.masterPlaylistPath,

        playlistItemCount:
          result.playlistItemCount,

        alreadyPublished:
          result.alreadyPublished,

        scanReady:
          true,

        status:
          "active",
      },

      iosProjection: {
        arEntryPath:
          `${result.collectionId}/_meta/entries/${result.entryId}`,

        masterPlaylistPath:
          result.masterPlaylistPath,

        playlistField:
          "ar_playlist",

        appConsumable:
          true,
      },

      message:
        result.alreadyPublished
          ? "Retail Media was already published. The Goshsha master playlist was rebuilt and verified."
          : "Retail Media is now active and scan-ready in the Goshsha app.",
    });
  } catch (error: any) {
    console.error(
      "Publish Retail Media error:",
      error
    );

    const errorMessage =
      String(
        error?.message ||
          ""
      );

    const knownError =
      mapKnownError(
        errorMessage
      );

    if (knownError) {
      return NextResponse.json(
        {
          error:
            knownError.message,
        },
        {
          status:
            knownError.status,
        }
      );
    }

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
            : errorMessage ||
              "Failed to publish Retail Media.",
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