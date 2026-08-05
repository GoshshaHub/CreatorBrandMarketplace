import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../firebase-admin";

import {
  createCampaignRetailAssetDefaults,
  type PlaybackMode,
  type RetailAssetFields,
} from "../retail-media";

import {
  resolveProductCollection,
  type ProductResolutionResult,
} from "./product-resolution";

const RETAIL_ASSET_SCHEMA_VERSION = 2;
const RETAIL_ASSET_VERSION = 1;

export type CreateDraftRetailAssetInput = {
  campaignId: string;

  /*
   * UID of the authenticated Brand initiating Product 2.
   */
  brandUserId: string;

  /*
   * OCR extracted from the uploaded target image.
   */
  rawOcr: string;

  /*
   * Permanent target-image references.
   */
  targetImageUrl: string;
  targetImageStoragePath: string;

  targetImageOriginalName?: string | null;
  targetImageContentType?: string | null;
  targetImageSizeBytes?: number | null;

  /*
   * Optional authoritative values from the Brand campaign.
   */
  brandName?: string | null;
  productName?: string | null;

  recognitionConfidence?: number | null;
};

export type DraftRetailAssetResult = {
  retailAssetId: string;

  campaignId: string;
  creatorId: string;
  brandId: string;

  collectionId: string;
  entryId: string;

  status: "draft";

  productResolution: ProductResolutionResult;

  reusedExistingDraft: boolean;
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

  const cleaned =
    value.trim();

  return cleaned || null;
}

function isValidHttpUrl(
  value: string
): boolean {
  try {
    const parsed =
      new URL(value);

    return (
      parsed.protocol === "https:" ||
      parsed.protocol === "http:"
    );
  } catch {
    return false;
  }
}

function determinePlaybackMode(
  mediaContentType: string
): PlaybackMode {
  if (
    mediaContentType.startsWith(
      "image/"
    )
  ) {
    return "image";
  }

  return "full_video";
}

/*
 * A deterministic first-version ID makes draft creation
 * idempotent. Repeating the same request will return the
 * existing draft rather than creating duplicate assets.
 *
 * Future campaigns with several separately licensable assets
 * can use additional versioned IDs.
 */
function createRetailAssetId(
  campaignId: string
): string {
  return `campaign-${campaignId}-v1`;
}

export async function createDraftRetailAsset(
  input: CreateDraftRetailAssetInput
): Promise<DraftRetailAssetResult> {
  const campaignId =
    cleanRequiredString(
      input.campaignId,
      "campaignId"
    );

  const brandUserId =
    cleanRequiredString(
      input.brandUserId,
      "brandUserId"
    );

  const rawOcr =
    cleanRequiredString(
      input.rawOcr,
      "rawOcr"
    );

  const targetImageUrl =
    cleanRequiredString(
      input.targetImageUrl,
      "targetImageUrl"
    );

  const targetImageStoragePath =
    cleanRequiredString(
      input.targetImageStoragePath,
      "targetImageStoragePath"
    );

  if (
    !isValidHttpUrl(
      targetImageUrl
    )
  ) {
    throw new Error(
      "targetImageUrl must be a valid HTTP or HTTPS URL."
    );
  }

  const campaignRef =
    adminDb
      .collection("campaigns")
      .doc(campaignId);

  const campaignSnap =
    await campaignRef.get();

  if (!campaignSnap.exists) {
    throw new Error(
      "CAMPAIGN_NOT_FOUND"
    );
  }

  const campaign =
    campaignSnap.data() as Record<
      string,
      any
    >;

  /*
   * Product 2 can only be initiated by the Brand that owns
   * the source campaign.
   */
  if (
    !campaign.brandId ||
    campaign.brandId !==
      brandUserId
  ) {
    throw new Error(
      "NOT_CAMPAIGN_BRAND"
    );
  }

  /*
   * The Creator deliverable must already have passed Brand
   * approval. Creator payout itself may still be pending or
   * may already have been released.
   */
  if (
    campaign.brandApprovalStatus !==
      "approved"
  ) {
    throw new Error(
      "CAMPAIGN_NOT_APPROVED"
    );
  }

  const approvalSnapshot =
    campaign.brandApprovalSnapshot as
      | Record<string, any>
      | null
      | undefined;

  if (!approvalSnapshot) {
    throw new Error(
      "APPROVAL_SNAPSHOT_MISSING"
    );
  }

  const creatorId =
    cleanRequiredString(
      approvalSnapshot.creatorId ||
        campaign.creatorId,
      "creatorId"
    );

  const brandId =
    cleanRequiredString(
      approvalSnapshot.brandId ||
        campaign.brandId,
      "brandId"
    );

  const submission =
    approvalSnapshot
      .creatorSubmission ||
    campaign.creatorSubmission ||
    {};

  const rightsSnapshot =
    approvalSnapshot
      .rightsCertification ||
    campaign
      .creatorRightsCertification ||
    {};

  const licenseSnapshot =
    approvalSnapshot
      .licenseCertification ||
    campaign
      .creatorLicenseCertification ||
    {};

  const creatorMediaUrl =
    cleanRequiredString(
      submission.originalMediaUrl ||
        campaign.creatorMediaUrl,
      "Creator media URL"
    );

  const creatorMediaStoragePath =
    cleanRequiredString(
      submission
        .originalMediaStoragePath ||
        campaign
          .creatorMediaStoragePath,
      "Creator media storage path"
    );

  const creatorMediaContentType =
    cleanRequiredString(
      submission.mediaContentType ||
        campaign
          .creatorMediaContentType,
      "Creator media content type"
    );

  if (
    !isValidHttpUrl(
      creatorMediaUrl
    )
  ) {
    throw new Error(
      "Creator media URL is invalid."
    );
  }

  /*
   * Revalidate the frozen rights package. A draft should
   * never be created from incomplete or uncertified content.
   */
  const contentRightsConfirmed =
    rightsSnapshot
      .contentRightsConfirmed ===
    true;

  const audioRightsConfirmed =
    rightsSnapshot
      .audioRightsConfirmed ===
    true;

  const appearanceRightsConfirmed =
    rightsSnapshot
      .appearanceRightsConfirmed ===
    true;

  const creatorRetainsCopyright =
    rightsSnapshot
      .creatorRetainsCopyright ===
    true;

  const brandUsageLicenseGranted =
    licenseSnapshot
      .brandUsageLicenseGranted ===
    true;

  const goshshaDistributionLicenseGranted =
    licenseSnapshot
      .goshshaDistributionLicenseGranted ===
    true;

  const futureRoyaltyEarningsAcknowledged =
    licenseSnapshot
      .futureRoyaltyEarningsAcknowledged ===
    true;

  const futurePaidReactivationAllowed =
    licenseSnapshot
      .futurePaidReactivationAllowed ===
    true;

  if (
    !contentRightsConfirmed ||
    !appearanceRightsConfirmed ||
    !creatorRetainsCopyright ||
    !brandUsageLicenseGranted ||
    !goshshaDistributionLicenseGranted ||
    !futureRoyaltyEarningsAcknowledged ||
    !futurePaidReactivationAllowed
  ) {
    throw new Error(
      "APPROVED_RIGHTS_PACKAGE_INCOMPLETE"
    );
  }

  /*
   * Resolve or create the shared Product Collection.
   *
   * This does not create an AR Entry or playlist item.
   */
  const productResolution =
    await resolveProductCollection({
      rawOcr,

      brandName:
        cleanOptionalString(
          input.brandName
        ) ||
        cleanOptionalString(
          campaign.brandName
        ),

      productName:
        cleanOptionalString(
          input.productName
        ) ||
        cleanOptionalString(
          campaign.productName
        ),

      source:
        "web_ocr",

      createdBy:
        brandUserId,

      createIfMissing:
        true,
    });

  const retailAssetId =
    createRetailAssetId(
      campaignId
    );

  /*
   * For the first vertical slice, the future AR Entry ID is
   * deterministic and equal to the Retail Asset ID.
   *
   * The entry itself is not created by this service.
   */
  const entryId =
    retailAssetId;

  const retailAssetRef =
    adminDb
      .collection("retailAssets")
      .doc(retailAssetId);

  const existingAssetSnap =
    await retailAssetRef.get();

  if (existingAssetSnap.exists) {
    const existing =
      existingAssetSnap.data() as Record<
        string,
        any
      >;

    if (
      existing.campaignId !==
        campaignId ||
      existing.brandId !==
        brandId ||
      existing.creatorId !==
        creatorId
    ) {
      throw new Error(
        "RETAIL_ASSET_ID_CONFLICT"
      );
    }

    return {
      retailAssetId,

      campaignId,
      creatorId,
      brandId,

      collectionId:
        cleanRequiredString(
          existing.collectionId,
          "existing collectionId"
        ),

      entryId:
        cleanRequiredString(
          existing.entryId,
          "existing entryId"
        ),

      status:
        "draft",

      productResolution,

      reusedExistingDraft:
        true,
    };
  }

  const playbackMode =
    determinePlaybackMode(
      creatorMediaContentType
    );

  const isVideo =
    creatorMediaContentType.startsWith(
      "video/"
    );

  const assetDefaults =
    createCampaignRetailAssetDefaults({
      retailAssetId,

      collectionId:
        productResolution.collectionId,

      entryId,

      campaignId,
      creatorId,
      brandId,

      sourceProduct:
        "creator_network",

      masterPlaylistId:
        productResolution.collectionId,

      rawOcr:
        productResolution.rawOcr,

      normalizedOcr:
        productResolution.normalizedOcr,

      canonicalName:
        productResolution.canonicalName,

      canonicalSlug:
        productResolution.canonicalSlug,

      detectedBrand:
        productResolution.brandName,

      recognitionTokens:
        productResolution.tokens,

      recognitionConfidence:
        input.recognitionConfidence ??
        null,

      recognitionSource:
        "web_ocr",

      matcherVersion:
        productResolution.matcherVersion,

      createdBy:
        brandUserId,

      createdByRole:
        "brand",

      createdFrom:
        "web",

      /*
       * The 90-day window deliberately remains unset.
       */
      activationStartsAt:
        null,

      activationEndsAt:
        null,

      createdAt:
        FieldValue.serverTimestamp(),

      updatedAt:
        FieldValue.serverTimestamp(),
    });

  /*
   * The approved snapshot establishes the future playback
   * entitlement, but activation and license status remain
   * inactive until the later publishing action.
   */
  const retailAsset: RetailAssetFields = {
    ...assetDefaults,

    ownership: {
      ...assetDefaults.ownership,

      ownerType:
        "creator",

      ownerId:
        creatorId,

      creatorId,
      brandId,

      creatorRetainsCopyright:
        true,

      certifiedAt:
        rightsSnapshot.certifiedAt ||
        null,
    },

    rights: {
      ...assetDefaults.rights,

      status:
        "certified",

      contentRightsConfirmed:
        true,

      audioRightsConfirmed,

      appearanceRightsConfirmed:
        true,

      brandUsageApproved:
        true,

      certificationVersion:
        cleanOptionalString(
          rightsSnapshot
            .certificationVersion
        ) || "1.0",

      certifiedByUserId:
        cleanOptionalString(
          rightsSnapshot
            .certifiedByUserId
        ) || creatorId,

      certifiedAt:
        rightsSnapshot.certifiedAt ||
        null,
    },

    license: {
      ...assetDefaults.license,

      type:
        "campaign_window",

      /*
       * Draft creation does not activate the license.
       */
      status:
        "pending",

      startsAt:
        null,

      expiresAt:
        null,

      durationDays:
        Number(
          licenseSnapshot
            .licenseDurationDays ||
            90
        ),

      renewalAllowed:
        licenseSnapshot
          .renewalRequestAllowed !==
        false,

      automaticRenewalAllowed:
        false,

      futurePaidReactivationAllowed:
        true,

      futureRoyaltyEarningsAcknowledged:
        true,

      qualifiedViewRate:
        null,

      currency:
        cleanOptionalString(
          licenseSnapshot.currency
        ) || "USD",

      termsVersion:
        cleanOptionalString(
          licenseSnapshot
            .licenseTermsVersion
        ) || "1.0",
    },

    playback: {
      ...assetDefaults.playback,

      mode:
        playbackMode,

      fullVideoAllowed:
        isVideo,

      audioAllowed:
        isVideo &&
        audioRightsConfirmed,

      defaultMuted:
        true,

      autoplay:
        true,

      previewDurationSeconds:
        isVideo ? null : 8,

      contentType:
        creatorMediaContentType,
    },

    activation: {
    ...assetDefaults.activation,

    status:
        "draft",

    startsAt:
        null,

    endsAt:
        null,
    },

    distribution: {
    ...assetDefaults.distribution,

    status:
        "not_published",

    publishedToPlaylist:
        false,

    playlistVersion:
        0,
    },

    audit: {
      ...assetDefaults.audit,

      schemaVersion:
        RETAIL_ASSET_SCHEMA_VERSION,

      assetVersion:
        RETAIL_ASSET_VERSION,

      createdBy:
        brandUserId,

      createdByRole:
        "brand",

      createdFrom:
        "web",
    },
  };

  const targetImage = {
    url:
      targetImageUrl,

    storagePath:
      targetImageStoragePath,

    originalName:
      cleanOptionalString(
        input
          .targetImageOriginalName
      ),

    contentType:
      cleanOptionalString(
        input
          .targetImageContentType
      ),

    sizeBytes:
      Number(
        input
          .targetImageSizeBytes ||
          0
      ) || null,

    uploadedBy:
      brandUserId,

    uploadedAt:
      FieldValue.serverTimestamp(),
  };

  const media = {
    url:
      creatorMediaUrl,

    storagePath:
      creatorMediaStoragePath,

    originalName:
      cleanOptionalString(
        submission
          .originalMediaName
      ),

    contentType:
      creatorMediaContentType,

    sizeBytes:
      Number(
        submission
          .mediaSizeBytes ||
          campaign
            .creatorMediaSizeBytes ||
          0
      ) || null,

    mediaType:
      isVideo
        ? "video"
        : "image",

    sourceSubmissionVersion:
      Number(
        submission
          .submissionVersion ||
          1
      ),

    sourceApprovalSnapshotVersion:
      Number(
        approvalSnapshot
          .snapshotVersion ||
          1
      ),
  };

  /*
   * Create the authoritative asset and attach its references
   * to the campaign atomically.
   *
   * Nothing is written to:
   *
   * /{collectionId}/_meta/entries/{entryId}
   * /masters/{collectionId}
   */
  await adminDb.runTransaction(
    async (transaction) => {
      const [
        freshCampaignSnap,
        freshAssetSnap,
      ] =
        await Promise.all([
          transaction.get(
            campaignRef
          ),

          transaction.get(
            retailAssetRef
          ),
        ]);

      if (
        !freshCampaignSnap.exists
      ) {
        throw new Error(
          "CAMPAIGN_NOT_FOUND"
        );
      }

      if (freshAssetSnap.exists) {
        return;
      }

      const freshCampaign =
        freshCampaignSnap.data() as Record<
          string,
          any
        >;

      if (
        freshCampaign.brandId !==
          brandUserId
      ) {
        throw new Error(
          "NOT_CAMPAIGN_BRAND"
        );
      }

      if (
        freshCampaign
          .brandApprovalStatus !==
        "approved"
      ) {
        throw new Error(
          "CAMPAIGN_NOT_APPROVED"
        );
      }

      transaction.create(
        retailAssetRef,
        {
          ...retailAsset,

          targetImage,
          media,

          status:
            "draft",

          retailAssetSchemaVersion:
            RETAIL_ASSET_SCHEMA_VERSION,

          createdAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        }
      );

      transaction.update(
        campaignRef,
        {
          retailAssetId,

          productCollectionId:
            productResolution
              .collectionId,

          /*
           * This is reserved for the future production entry,
           * but the entry does not exist yet.
           */
          proposedArEntryId:
            entryId,

          arEntryId:
            null,

          publishedArEntryId:
            null,

          retailAssetCreationStatus:
            "draft_created",

          retailMediaStatus:
            "draft",

          arStatus:
            "not_started",

          activationStart:
            null,

          activationEnd:
            null,

          retailAssetDraftCreatedAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        }
      );
    }
  );

  return {
    retailAssetId,

    campaignId,
    creatorId,
    brandId,

    collectionId:
      productResolution.collectionId,

    entryId,

    status:
      "draft",

    productResolution,

    reusedExistingDraft:
      false,
  };
}