import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import {
  adminAuth,
  adminDb,
  adminStorage,
} from "../../../../../lib/firebase-admin";

import {
  createDraftRetailAsset,
} from "../../../../../lib/retail-media/create-draft-asset";

const MAX_TARGET_IMAGE_BYTES =
  25 * 1024 * 1024;

const ALLOWED_TARGET_IMAGE_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ]);

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

  if (
    !Number.isFinite(parsed)
  ) {
    return null;
  }

  return parsed;
}

function getExtensionFromContentType(
  contentType: string
): string {
  switch (contentType) {
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
  const {
    bucketName,
    objectName,
    downloadToken,
  } = params;

  return (
    "https://firebasestorage.googleapis.com/v0/b/" +
    `${encodeURIComponent(bucketName)}/o/` +
    `${encodeURIComponent(objectName)}` +
    `?alt=media&token=${encodeURIComponent(downloadToken)}`
  );
}

function mapKnownError(
  errorMessage: string
): {
  status: number;
  message: string;
} | null {
  switch (errorMessage) {
    case "CAMPAIGN_NOT_FOUND":
      return {
        status: 404,
        message:
          "Campaign not found.",
      };

    case "NOT_CAMPAIGN_BRAND":
      return {
        status: 403,
        message:
          "You do not have permission to create Retail Media for this campaign.",
      };

    case "CAMPAIGN_NOT_APPROVED":
      return {
        status: 409,
        message:
          "The Creator submission must be approved before Retail Media can be created.",
      };

    case "APPROVAL_SNAPSHOT_MISSING":
      return {
        status: 409,
        message:
          "The approved Creator submission snapshot is missing.",
      };

    case "APPROVED_RIGHTS_PACKAGE_INCOMPLETE":
      return {
        status: 409,
        message:
          "The approved rights or licensing package is incomplete.",
      };

    case "RETAIL_ASSET_ID_CONFLICT":
      return {
        status: 409,
        message:
          "A conflicting Retail Asset already exists for this campaign.",
      };

    default:
      return null;
  }
}

export async function POST(
  request: Request
) {
  let uploadedStoragePath:
    | string
    | null = null;

  try {
    /*
     * -----------------------------------------------------
     * Authenticate the Brand
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

    const brandUserId =
      decodedToken.uid;

    /*
     * -----------------------------------------------------
     * Confirm this account is a Brand
     * -----------------------------------------------------
     */

    const [
      userSnapshot,
      brandSnapshot,
    ] =
      await Promise.all([
        adminDb
          .collection("users")
          .doc(brandUserId)
          .get(),

        adminDb
          .collection("brands")
          .doc(brandUserId)
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

    const role =
      cleanOptionalString(
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

    /*
     * -----------------------------------------------------
     * Read multipart form data
     * -----------------------------------------------------
     */

    const formData =
      await request.formData();

    const campaignId =
      cleanRequiredString(
        formData.get(
          "campaignId"
        ),
        "campaignId"
      );

    const rawOcr =
      cleanRequiredString(
        formData.get(
          "rawOcr"
        ),
        "rawOcr"
      );

    const brandName =
      cleanOptionalString(
        formData.get(
          "brandName"
        )
      ) ||
      cleanOptionalString(
        brandData?.brandName ||
          brandData?.displayName ||
          userData?.brandName ||
          userData?.displayName
      );

    const productName =
      cleanOptionalString(
        formData.get(
          "productName"
        )
      );

    const recognitionConfidence =
      cleanOptionalNumber(
        formData.get(
          "recognitionConfidence"
        )
      );

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
            "A target product image is required.",
        },
        {
          status: 400,
        }
      );
    }

    const targetImage =
      targetImageValue as File;

    /*
     * -----------------------------------------------------
     * Validate the target image
     * -----------------------------------------------------
     */

    const targetImageContentType =
      cleanRequiredString(
        targetImage.type,
        "Target image content type"
      );

    if (
      !ALLOWED_TARGET_IMAGE_TYPES.has(
        targetImageContentType
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
      targetImage.size <= 0
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
     * -----------------------------------------------------
     * Confirm campaign ownership before uploading
     * -----------------------------------------------------
     */

    const campaignReference =
      adminDb
        .collection("campaigns")
        .doc(campaignId);

    const campaignSnapshot =
      await campaignReference.get();

    if (
      !campaignSnapshot.exists
    ) {
      return NextResponse.json(
        {
          error:
            "Campaign not found.",
        },
        {
          status: 404,
        }
      );
    }

    const campaign =
      campaignSnapshot.data() as Record<
        string,
        any
      >;

    if (
      campaign.brandId !==
      brandUserId
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to create Retail Media for this campaign.",
        },
        {
          status: 403,
        }
      );
    }

    if (
      campaign.brandApprovalStatus !==
      "approved"
    ) {
      return NextResponse.json(
        {
          error:
            "The Creator submission must be approved before Retail Media can be created.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * Upload the target image
     * -----------------------------------------------------
     */

    const extension =
      getExtensionFromContentType(
        targetImageContentType
      );

    const storageObjectName =
      [
        "retail-media-targets",
        brandUserId,
        campaignId,
        `${randomUUID()}.${extension}`,
      ].join("/");

    uploadedStoragePath =
      storageObjectName;

    const bucket =
      adminStorage.bucket();

    const storageFile =
      bucket.file(
        storageObjectName
      );

    const downloadToken =
      randomUUID();

    const imageBuffer =
      Buffer.from(
        await targetImage.arrayBuffer()
      );

    await storageFile.save(
      imageBuffer,
      {
        resumable:
          false,

        validation:
          "crc32c",

        metadata: {
          contentType:
            targetImageContentType,

          cacheControl:
            "public,max-age=3600",

          metadata: {
            firebaseStorageDownloadTokens:
              downloadToken,

            campaignId,

            brandId:
              brandUserId,

            uploadedBy:
              brandUserId,

            uploadPurpose:
              "retail_media_target",
          },
        },
      }
    );

    const targetImageUrl =
      getFirebaseDownloadUrl({
        bucketName:
          bucket.name,

        objectName:
          storageObjectName,

        downloadToken,
      });

    /*
     * -----------------------------------------------------
     * Create the authoritative Retail Asset draft
     * -----------------------------------------------------
     */

    const result =
      await createDraftRetailAsset({
        campaignId,

        brandUserId,

        rawOcr,

        targetImageUrl,

        targetImageStoragePath:
          storageObjectName,

        targetImageOriginalName:
          cleanOptionalString(
            targetImage.name
          ),

        targetImageContentType,

        targetImageSizeBytes:
          targetImage.size,

        brandName,

        productName,

        recognitionConfidence,
      });

    return NextResponse.json(
      {
        ok:
          true,

        retailAsset:
          result,

        targetImage: {
          url:
            targetImageUrl,

          storagePath:
            storageObjectName,

          contentType:
            targetImageContentType,

          sizeBytes:
            targetImage.size,

          originalName:
            targetImage.name ||
            null,
        },

        /*
         * Explicitly communicate that nothing is live yet.
         */
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
        },
      },
      {
        status:
          result.reusedExistingDraft
            ? 200
            : 201,
      }
    );
  } catch (error: any) {
    console.error(
      "Create Retail Media draft error:",
      error
    );

    /*
     * If the upload succeeded but draft creation failed,
     * remove the new orphaned image.
     */
    if (
      uploadedStoragePath
    ) {
      try {
        await adminStorage
          .bucket()
          .file(
            uploadedStoragePath
          )
          .delete({
            ignoreNotFound:
              true,
          });
      } catch (
        cleanupError
      ) {
        console.error(
          "Failed to clean up orphaned Retail Media target image:",
          cleanupError
        );
      }
    }

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
              "Failed to create the Retail Media draft.",
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