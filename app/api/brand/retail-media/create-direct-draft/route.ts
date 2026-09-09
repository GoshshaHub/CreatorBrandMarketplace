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
import {
  identityTokensV5,
  ProductIdentityAmbiguousError,
  resolveProductIdentityV5,
  writeProductIdentityV5,
  type ProductIdentityV5Resolution,
} from "../../../../../lib/retail-media/product-identity-v5";
import {
  extractTargetImageOcr,
  MAX_VISION_IMAGE_BYTES,
} from "../../../../../lib/retail-media/target-image-ocr";

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

const VISION_TARGET_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const PRODUCT_2_SCHEMA_VERSION =
  1;

type ContentOwnershipType =
  | "brand_owned"
  | "external_creator";


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

function shortHash(
  value: string,
  length = 12
): string {
  return createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, length);
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
  value: unknown
): boolean {
  if (
    typeof value ===
    "boolean"
  ) {
    return value;
  }

  return (
    String(
      value ?? ""
    )
      .trim()
      .toLowerCase() ===
    "true"
  );
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

async function verifyDirectUpload(
  params: {
    storagePath: string;

    brandUserId: string;

    kind:
      | "media"
      | "target";
  }
): Promise<{
  storagePath: string;

  originalName: string;

  contentType: string;

  sizeBytes: number;
}> {
  const expectedPrefix =
    `retail-media-direct-uploads/` +
    `${params.brandUserId}/` +
    `${params.kind}/`;

  if (
    !params.storagePath.startsWith(
      expectedPrefix
    )
  ) {
    throw new Error(
      "Invalid Retail Media upload path."
    );
  }

  const bucket =
    adminStorage.bucket();

  const storageFile =
    bucket.file(
      params.storagePath
    );

  const [
    exists,
  ] =
    await storageFile.exists();

  if (!exists) {
    throw new Error(
      params.kind ===
        "media"
        ? "The uploaded video could not be found."
        : "The uploaded product image could not be found."
    );
  }

  const [
    metadata,
  ] =
    await storageFile.getMetadata();

  const sizeBytes =
    Number(
      metadata.size ||
      0
    );

  if (
    !Number.isFinite(
      sizeBytes
    ) ||
    sizeBytes <=
      0
  ) {
    throw new Error(
      params.kind ===
        "media"
        ? "The uploaded video appears to be empty."
        : "The uploaded product image appears to be empty."
    );
  }

  const customMetadata =
    metadata.metadata ||
    {};

  const originalName =
    cleanString(
      customMetadata
        .originalFileName
    );

  if (!originalName) {
    throw new Error(
      "Uploaded file metadata is incomplete."
    );
  }

  return {
    storagePath:
      params.storagePath,

    originalName,

    contentType:
      cleanString(
        metadata.contentType
      ),

    sizeBytes,
  };
}

async function promoteDirectUpload(
  params: {
    sourcePath: string;

    destinationPath: string;

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

  const sourceFile =
    bucket.file(
      params.sourcePath
    );

  const destinationFile =
    bucket.file(
      params.destinationPath
    );

  await sourceFile.move(
    destinationFile
  );

  const downloadToken =
    randomUUID();

  await destinationFile.setMetadata(
    {
      contentType:
        params.contentType,

      cacheControl:
        "public,max-age=3600",

      metadata: {
        firebaseStorageDownloadTokens:
          downloadToken,

        ...params.metadata,
      },
    }
  );

  return {
    url:
      getFirebaseDownloadUrl({
        bucketName:
          bucket.name,

        objectName:
          params.destinationPath,

        downloadToken,
      }),

    storagePath:
      params.destinationPath,
  };
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

    const requestContentType =
      request.headers.get(
        "content-type"
      ) || "";

    const isJsonRequest =
      requestContentType
        .toLowerCase()
        .includes(
          "application/json"
        );

    const requestBody:
      Record<string, any> =
      isJsonRequest
        ? await request.json()
        : {};

    const formData =
      isJsonRequest
        ? null
        : await request.formData();

    const getInput = (
      key: string
    ): unknown => {
      return isJsonRequest
        ? requestBody[key]
        : formData?.get(
            key
          ) ?? null;
    };

    const brandName =
      cleanRequiredString(
        getInput(
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
      getInput(
        "productName"
      ),
        "Product name"
    );

    const linkUrl =
      cleanRequiredString(
      getInput(
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

    const submittedCorrection =
      cleanString(
        getInput(
          "rawOcr"
        )
      );

    const ocrCorrectionConfirmed =
      parseBoolean(
        getInput(
          "ocrCorrectionConfirmed"
        )
      );

    const contentOwnershipType =
      cleanString(
      getInput(
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
      getInput(
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
        getInput(
          "contentRightsConfirmed"
        )
      );

    const audioRightsConfirmed =
      parseBoolean(
        getInput(
          "audioRightsConfirmed"
        )
      );

    const appearanceRightsConfirmed =
      parseBoolean(
        getInput(
          "appearanceRightsConfirmed"
        )
      );

    const brandUsageApproved =
      parseBoolean(
        getInput(
          "brandUsageApproved"
        )
      );

    const goshshaDistributionLicenseGranted =
      parseBoolean(
        getInput(
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

    let mediaFileName =
      "";

    let mediaContentType =
      "";

    let mediaSizeBytes =
      0;

    let targetFileName =
      "";

    let targetContentType =
      "";

    let targetSizeBytes =
      0;

    let stagedMediaPath:
      string | null =
      null;

    let stagedTargetPath:
      string | null =
      null;

    let originalMedia:
      File | null =
      null;

    let targetImage:
      File | null =
      null;

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

    if (isJsonRequest) {
      stagedMediaPath =
        cleanRequiredString(
          getInput(
            "mediaStoragePath"
          ),
          "Media storage path"
        );

      const verifiedMedia =
        await verifyDirectUpload({
          storagePath:
            stagedMediaPath,

          brandUserId,

          kind:
            "media",
        });

      mediaFileName =
        verifiedMedia
          .originalName;

      mediaContentType =
        verifiedMedia
          .contentType;

      mediaSizeBytes =
        verifiedMedia
          .sizeBytes;
    } else {
      const mediaValue =
        formData?.get(
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

      originalMedia =
        mediaValue as File;

      mediaFileName =
        cleanRequiredString(
          originalMedia.name,
          "Media filename"
        );

      mediaContentType =
        cleanString(
          originalMedia.type
        );

      mediaSizeBytes =
        originalMedia.size;
    }

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
        mediaSizeBytes
      ) ||
      mediaSizeBytes <=
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
      mediaSizeBytes >
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

    if (isJsonRequest) {
      stagedTargetPath =
        cleanRequiredString(
          getInput(
            "targetImageStoragePath"
          ),
          "Target image storage path"
        );

      const verifiedTarget =
        await verifyDirectUpload({
          storagePath:
            stagedTargetPath,

          brandUserId,

          kind:
            "target",
        });

      targetFileName =
        verifiedTarget
          .originalName;

      targetContentType =
        cleanRequiredString(
          verifiedTarget
            .contentType,
          "Target image content type"
        );

      targetSizeBytes =
        verifiedTarget
          .sizeBytes;
    } else {
      const targetImageValue =
        formData?.get(
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

      targetImage =
        targetImageValue as File;

      targetFileName =
        cleanRequiredString(
          targetImage.name,
          "Target image filename"
        );

      targetContentType =
        cleanRequiredString(
          targetImage.type,
          "Target image content type"
        );

      targetSizeBytes =
        targetImage.size;
    }

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
        targetSizeBytes
      ) ||
      targetSizeBytes <=
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
      targetSizeBytes >
      MAX_VISION_IMAGE_BYTES
    ) {
      return NextResponse.json(
        {
          error:
            "The product image must be 20 MB or smaller for packaging recognition.",
        },
        {
          status: 400,
        }
      );
    }

    if (!VISION_TARGET_IMAGE_TYPES.has(targetContentType)) {
      return NextResponse.json({
        error: "Convert HEIC/HEIF targets through Goshsha's supported image pipeline before packaging recognition.",
      }, { status: 400 });
    }

    let temporaryOcrTargetPath = "";
    if (!isJsonRequest && targetImage) {
      temporaryOcrTargetPath =
        `retail-media-direct-uploads/${brandUserId}/target/ocr-${randomUUID()}-${targetFileName.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      stagedTargetPath = temporaryOcrTargetPath;
      await adminStorage.bucket().file(temporaryOcrTargetPath).save(
        Buffer.from(await targetImage.arrayBuffer()),
        {
          resumable: false,
          validation: "crc32c",
          metadata: {
            contentType: targetContentType,
            metadata: {
              originalFileName: targetFileName,
              uploadPurpose: "retail_media_direct_target_ocr",
            },
          },
        }
      );
    }

    /*
     * =====================================================
     * 6. Resolve product identity
     * =====================================================
     */

    if (!stagedTargetPath) {
      throw new Error(
        "Automatic packaging recognition requires the authenticated staged-upload flow."
      );
    }

    let targetOcr: Awaited<ReturnType<typeof extractTargetImageOcr>> | null = null;
    let ocrError = "";
    try {
      targetOcr = await extractTargetImageOcr({
        storagePath: stagedTargetPath,
        brandUserId,
      });
    } catch (error: any) {
      ocrError = cleanString(error?.message) || "Packaging recognition failed.";
    }
    if (temporaryOcrTargetPath) {
      await deleteStorageObject(temporaryOcrTargetPath);
    }

    const automaticText = cleanString(targetOcr?.originalText);
    const automaticTokens = identityTokensV5(automaticText);
    const lowConfidence = targetOcr?.confidence !== null &&
      targetOcr?.confidence !== undefined &&
      targetOcr.confidence < 0.5;
    const correctionRequired = Boolean(
      ocrError ||
      automaticTokens.length < 2 ||
      lowConfidence
    );

    if (correctionRequired && (!ocrCorrectionConfirmed || !submittedCorrection)) {
      return NextResponse.json({
        error: ocrError ||
          "We could not confidently identify enough packaging text. Review the extracted text and correct it before continuing.",
        code: "OCR_CORRECTION_REQUIRED",
        extractedText: automaticText,
        confidence: targetOcr?.confidence ?? null,
      }, { status: 422 });
    }

    const useConfirmedCorrection = ocrCorrectionConfirmed && Boolean(submittedCorrection);
    const rawOcr = useConfirmedCorrection ? submittedCorrection : automaticText;
    let productResolution: ProductIdentityV5Resolution;
    try {
      productResolution = await resolveProductIdentityV5({
        rawOcr,
        brandName,
        productName,
        requireUnambiguousMatch: true,
      });
    } catch (error) {
      if (error instanceof ProductIdentityAmbiguousError) {
        return NextResponse.json({
          error: error.message,
          code: "OCR_CORRECTION_REQUIRED",
          extractedText: rawOcr,
          confidence: targetOcr?.confidence ?? null,
        }, { status: 422 });
      }
      throw error;
    }

    const ocrProvenance = {
      source: "target_image_ocr",
      extraction: {
        originalText: automaticText,
        provider: targetOcr?.provider || "google_cloud_vision",
        version: targetOcr?.version || "document-text-detection-v1",
        confidence: targetOcr?.confidence ?? null,
        targetSha256: targetOcr?.targetSha256 || null,
        extractedAt: targetOcr?.extractedAt || null,
        error: ocrError || null,
      },
      correction: useConfirmedCorrection
        ? {
            correctedText: submittedCorrection,
            confirmedByUserId: brandUserId,
            confirmedAt: FieldValue.serverTimestamp(),
            reason: !correctionRequired
              ? "identity_ambiguity_or_confirmed_correction"
              : ocrError
              ? "ocr_failure"
              : lowConfidence
              ? "low_confidence"
              : "insufficient_tokens",
          }
        : null,
    };

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
            mediaSizeBytes
          ),
          targetFileName
            .toLowerCase(),
          String(
            targetSizeBytes
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

      if (isJsonRequest) {
        await Promise.all([
          deleteStorageObject(
            stagedMediaPath
          ),

          deleteStorageObject(
            stagedTargetPath
          ),
        ]);
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
      isJsonRequest
        ? await promoteDirectUpload({
            sourcePath:
              stagedMediaPath!,

            destinationPath:
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
          })
        : await uploadFile({
            file:
              originalMedia!,

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
      isJsonRequest
        ? await promoteDirectUpload({
            sourcePath:
              stagedTargetPath!,

            destinationPath:
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
          })
        : await uploadFile({
            file:
              targetImage!,

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
            mediaSizeBytes,

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
            targetFileName ||
            null,

          contentType:
            targetContentType,

          sizeBytes:
            targetSizeBytes,

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
            targetOcr?.confidence ?? null,

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

          ocrProvenance,
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
        writeProductIdentityV5({
          transaction,
          resolution: productResolution,
          source: "product_2_web",
        });

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
            mediaSizeBytes,
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
            targetFileName ||
            null,

          sizeBytes:
            targetSizeBytes,
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
