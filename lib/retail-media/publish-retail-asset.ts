import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

import { adminDb } from "../firebase-admin";

import {
  evaluateRetailAssetPlaylistEligibility,
  type RetailAssetFields,
} from "../retail-media";

import {
  rebuildMasterPlaylistForEntry,
  type RebuildMasterPlaylistResult,
} from "./playlist-builder";

import {
  createPlaybackCopy,
} from "./create-playback-copy";

const DEFAULT_LICENSE_DURATION_DAYS = 90;
const RETAIL_ASSET_SCHEMA_VERSION = 2;

export type PublishRetailAssetInput = {
  retailAssetId: string;

  /*
   * Authenticated user initiating publication.
   *
   * Normally the Brand that owns the source campaign.
   * Admin publication can be permitted explicitly.
   */
  publishedByUserId: string;

  publishedByRole:
    | "brand"
    | "admin"
    | "system";

  /*
   * Optional future targeting override.
   *
   * When omitted, the existing draft activation targeting
   * remains unchanged.
   */
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

export type PublishRetailAssetResult = {
  retailAssetId: string;

  campaignId: string | null;
  creatorId: string | null;
  brandId: string | null;

  collectionId: string;
  entryId: string;

  activationStartsAt: Timestamp;
  activationEndsAt: Timestamp;

  licenseStartsAt: Timestamp;
  licenseExpiresAt: Timestamp;

  masterPlaylistPath: string;
  playlistItemCount: number;

  alreadyPublished: boolean;

  playlist: RebuildMasterPlaylistResult;
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

function cleanStringArray(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
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

function isValidHttpUrl(
  value: string
): boolean {
  try {
    const parsed = new URL(value);

    return (
      parsed.protocol === "https:" ||
      parsed.protocol === "http:"
    );
  } catch {
    return false;
  }
}

function toTimestamp(
  value: unknown
): Timestamp | null {
  if (value instanceof Timestamp) {
    return value;
  }

  if (value instanceof Date) {
    if (
      !Number.isNaN(
        value.getTime()
      )
    ) {
      return Timestamp.fromDate(
        value
      );
    }

    return null;
  }

  if (
    value &&
    typeof value === "object" &&
    typeof (value as any).toDate ===
      "function"
  ) {
    const date =
      (value as any).toDate();

    if (
      date instanceof Date &&
      !Number.isNaN(
        date.getTime()
      )
    ) {
      return Timestamp.fromDate(
        date
      );
    }
  }

  return null;
}

function addDays(
  timestamp: Timestamp,
  days: number
): Timestamp {
  const milliseconds =
    timestamp.toMillis() +
    days *
      24 *
      60 *
      60 *
      1000;

  return Timestamp.fromMillis(
    milliseconds
  );
}

function getDurationDays(
  asset: Record<string, any>
): number {
  const configured =
    Number(
      asset.license
        ?.durationDays ||
        DEFAULT_LICENSE_DURATION_DAYS
    );

  if (
    !Number.isFinite(
      configured
    ) ||
    configured <= 0
  ) {
    return DEFAULT_LICENSE_DURATION_DAYS;
  }

  return Math.floor(
    configured
  );
}

function getPublicPostUrl(
  asset: Record<string, any>,
  campaign: Record<string, any> | null
): string {
  return cleanOptionalString(
    asset.media
      ?.publicPostUrl ||
      asset.sourceContentUrl ||
      campaign
        ?.brandApprovalSnapshot
        ?.creatorSubmission
        ?.publicPostUrl ||
      campaign
        ?.creatorSubmission
        ?.publicPostUrl ||
      campaign
        ?.normalizedArContentUrl ||
      campaign
        ?.creatorSubmittedArContentUrl
  ) || "";
}

function getSourceMediaUrl(
  asset: Record<string, any>
): string {
  return cleanRequiredString(
    asset.media?.url,
    "Retail Asset source media URL"
  );
}

function getPlaybackMediaUrl(
  asset: Record<string, any>
): string {
  return cleanRequiredString(
    asset.media?.playbackUrl ||
      asset.media?.url,
    "Retail Asset playback media URL"
  );
}

function getTargetImageUrl(
  asset: Record<string, any>
): string {
  return cleanRequiredString(
    asset.targetImage?.url,
    "Retail Asset target image URL"
  );
}

function getTargetImageStoragePath(
  asset: Record<string, any>
): string {
  return cleanRequiredString(
    asset.targetImage
      ?.storagePath,
    "Retail Asset target image storage path"
  );
}

function getSourceMediaStoragePath(
  asset: Record<string, any>
): string {
  return cleanRequiredString(
    asset.media?.storagePath,
    "Retail Asset source media storage path"
  );
}

function getPlaybackMediaStoragePath(
  asset: Record<string, any>
): string {
  return cleanRequiredString(
    asset.media?.playbackStoragePath ||
      asset.media?.storagePath,
    "Retail Asset playback media storage path"
  );
}

type PreparedPlaybackMedia = {
  sourceUrl: string;
  sourceStoragePath: string;

  playbackUrl: string;
  playbackStoragePath: string;

  contentType: string;

  reusedExistingCopy: boolean;
};

async function preparePlaybackMedia(
  asset: Record<string, any>
): Promise<PreparedPlaybackMedia> {
  const sourceUrl =
    getSourceMediaUrl(asset);

  const sourceStoragePath =
    getSourceMediaStoragePath(
      asset
    );

  const contentType =
    cleanOptionalString(
      asset.media?.contentType
    ) || "";

  const lowerContentType =
    contentType.toLowerCase();

  const lowerStoragePath =
    sourceStoragePath.toLowerCase();

  const isVideo =
    lowerContentType.startsWith(
      "video/"
    ) ||
    /\.(mp4|mov|m4v)$/i.test(
      sourceStoragePath
    );

  /*
   * Images do not need the MP4 compatibility bridge.
   */
  if (!isVideo) {
    return {
      sourceUrl,
      sourceStoragePath,

      playbackUrl:
        sourceUrl,

      playbackStoragePath:
        sourceStoragePath,

      contentType:
        contentType ||
        "application/octet-stream",

      reusedExistingCopy:
        true,
    };
  }

  /*
   * Videos are projected through a standardized lowercase
   * .mp4 Firebase Storage object for compatibility with the
   * current iOS renderer.
   */
  return createPlaybackCopy({
    retailAssetId:
      cleanRequiredString(
        asset.retailAssetId,
        "retailAssetId"
      ),

    sourceUrl,
    sourceStoragePath,

    campaignId:
      cleanOptionalString(
        asset.campaignId
      ),

    creatorId:
      cleanOptionalString(
        asset.creatorId
      ),

    brandId:
      cleanOptionalString(
        asset.brandId
      ),

    contentType:
      contentType || null,
  });
}

function validatePublisherAuthorization(
  params: {
    asset: Record<string, any>;
    publishedByUserId: string;
    publishedByRole:
      | "brand"
      | "admin"
      | "system";
  }
) {
  const {
    asset,
    publishedByUserId,
    publishedByRole,
  } = params;

  if (
    publishedByRole === "admin" ||
    publishedByRole === "system"
  ) {
    return;
  }

  if (
    publishedByRole === "brand" &&
    asset.brandId ===
      publishedByUserId
  ) {
    return;
  }

  throw new Error(
    "NOT_AUTHORIZED_TO_PUBLISH"
  );
}

function validateDraftForPublication(
  asset: Record<string, any>
) {
  const mediaUrl =
    getSourceMediaUrl(asset);

  const targetImageUrl =
    getTargetImageUrl(asset);

  getSourceMediaStoragePath(
    asset
    );

  getTargetImageStoragePath(
    asset
  );

  if (
    !isValidHttpUrl(
      mediaUrl
    )
  ) {
    throw new Error(
      "Retail Asset media URL is invalid."
    );
  }

  if (
    !isValidHttpUrl(
      targetImageUrl
    )
  ) {
    throw new Error(
      "Retail Asset target image URL is invalid."
    );
  }

  if (
    asset.rights?.status !==
      "certified" ||
    asset.rights
      ?.contentRightsConfirmed !==
      true ||
    asset.rights
      ?.brandUsageApproved !==
      true
  ) {
    throw new Error(
      "RETAIL_ASSET_RIGHTS_NOT_READY"
    );
  }

  if (
    asset.license?.status !==
      "pending" &&
    asset.license?.status !==
      "active"
  ) {
    throw new Error(
      "RETAIL_ASSET_LICENSE_NOT_PUBLISHABLE"
    );
  }

  if (
    asset.activation?.status !==
      "draft" &&
    asset.activation?.status !==
      "pending_review" &&
    asset.activation?.status !==
      "scheduled" &&
    asset.activation?.status !==
      "active"
  ) {
    throw new Error(
      "RETAIL_ASSET_ACTIVATION_NOT_PUBLISHABLE"
    );
  }

  const playbackAllowed =
    asset.playback
      ?.fullVideoAllowed ===
      true ||
    asset.playback?.mode ===
      "silent_video" ||
    asset.playback?.mode ===
      "animated_preview" ||
    asset.playback?.mode ===
      "image";

  if (!playbackAllowed) {
    throw new Error(
      "RETAIL_ASSET_PLAYBACK_NOT_READY"
    );
  }
}

function createIosCompatibleEntry(
  params: {
    asset: Record<string, any>;

    campaign:
      | Record<string, any>
      | null;

    activationStartsAt: Timestamp;
    activationEndsAt: Timestamp;

    publishedByUserId: string;
  }
): Record<string, any> {
  const {
    asset,
    campaign,
    activationStartsAt,
    activationEndsAt,
    publishedByUserId,
  } = params;

  const mediaUrl =
    getPlaybackMediaUrl(asset);

  const publicPostUrl =
    getPublicPostUrl(
      asset,
      campaign
    );

  const targetImageUrl =
    getTargetImageUrl(asset);

  const targetImageStoragePath =
    getTargetImageStoragePath(
      asset
    );

  const mediaStoragePath =
    getPlaybackMediaStoragePath(
        asset
    );

  const existingMetrics =
    asset.metrics || {};

  return {
    /*
     * -----------------------------------------------------
     * Existing iOS-compatible AR Entry fields
     * -----------------------------------------------------
     */

    "Augmented URL":
      mediaUrl,

    "ARContent URL":
      publicPostUrl,

    has_augmented:
      true,

    /*
     * These fields preserve the current app-created AR
     * vocabulary and make the new web-created entry easier
     * to inspect alongside legacy records.
     */
    "Target URL":
      targetImageUrl,

    "User ID":
      asset.creatorId ||
      asset.brandId ||
      publishedByUserId,

    "Subscription Level":
      "Retail Media",

    Date:
      activationStartsAt,

    /*
     * Current playlist and engagement fields.
     */
    votes_up:
      Number(
        existingMetrics.votesUp ||
          0
      ),

    votes_down:
      Number(
        existingMetrics.votesDown ||
          0
      ),

    views:
      Number(
        existingMetrics.views ||
          0
      ),

    qualified_views:
      Number(
        existingMetrics
          .qualifiedViews ||
          0
      ),

    shares:
      Number(
        existingMetrics.shares ||
          0
      ),

    created_at:
      asset.createdAt ||
      asset.audit?.createdAt ||
      FieldValue.serverTimestamp(),

    updated_at:
      FieldValue.serverTimestamp(),

    /*
     * -----------------------------------------------------
     * Shared infrastructure identity
     * -----------------------------------------------------
     */

    retailAssetId:
      asset.retailAssetId,

    retailAssetSchemaVersion:
      Number(
        asset
          .retailAssetSchemaVersion ||
          asset.audit
            ?.schemaVersion ||
          RETAIL_ASSET_SCHEMA_VERSION
      ),

    sourceProduct:
      asset.sourceProduct ||
      "creator_network",

    campaignId:
      asset.campaignId ||
      null,

    creatorId:
      asset.creatorId ||
      null,

    brandId:
      asset.brandId ||
      null,

    collectionId:
      asset.collectionId,

    entryId:
      asset.entryId,

    masterPlaylistId:
      asset.masterPlaylistId ||
      asset.collectionId,

    /*
     * -----------------------------------------------------
     * Media and target-image provenance
     * -----------------------------------------------------
     */

    media: {
      ...(asset.media || {}),

      url:
        mediaUrl,

      storagePath:
        mediaStoragePath,
    },

    targetImage: {
      ...(asset.targetImage ||
        {}),

      url:
        targetImageUrl,

      storagePath:
        targetImageStoragePath,
    },

    publicPostUrl:
      publicPostUrl ||
      null,

    /*
     * -----------------------------------------------------
     * Product-resolution metadata
     * -----------------------------------------------------
     */

    raw_ocr:
      asset.recognition?.rawOcr ||
      null,

    normalized_ocr:
      asset.recognition
        ?.normalizedOcr ||
      null,

    canonical:
      asset.recognition
        ?.canonicalName ||
      null,

    canonical_slug:
      asset.recognition
        ?.canonicalSlug ||
      asset.collectionId,

    recognition_tokens:
      asset.recognition
        ?.tokens ||
      [],

    recognition:
      asset.recognition ||
      null,

    brand:
      asset.recognition
        ?.detectedBrand ||
      campaign?.brandName ||
      null,

    product_name:
      campaign?.productName ||
      asset.recognition
        ?.canonicalName ||
      null,

    /*
     * -----------------------------------------------------
     * Rights, licensing, playback, activation
     * -----------------------------------------------------
     */

    ownership:
      asset.ownership,

    rights:
      asset.rights,

    license: {
      ...asset.license,

      status:
        "active",

      startsAt:
        activationStartsAt,

      expiresAt:
        activationEndsAt,
    },

    playback:
      asset.playback,

    activation: {
      ...asset.activation,

      status:
        "active",

      startsAt:
        activationStartsAt,

      endsAt:
        activationEndsAt,

      publishedAt:
        activationStartsAt,
    },

    distribution: {
      ...asset.distribution,

      status:
        "published",

      publishedToPlaylist:
        true,

      masterPlaylistId:
        asset.masterPlaylistId ||
        asset.collectionId,

      publishedAt:
        activationStartsAt,
    },

    metrics: {
      views:
        Number(
          existingMetrics.views ||
            0
        ),

      qualifiedViews:
        Number(
          existingMetrics
            .qualifiedViews ||
            0
        ),

      votesUp:
        Number(
          existingMetrics.votesUp ||
            0
        ),

      votesDown:
        Number(
          existingMetrics
            .votesDown ||
            0
        ),

      shares:
        Number(
          existingMetrics.shares ||
            0
        ),
    },

    monetization:
      asset.monetization ||
      null,

    audit: {
      ...(asset.audit || {}),

      updatedAt:
        FieldValue.serverTimestamp(),
    },

    publishedBy:
      publishedByUserId,

    publishedAt:
      activationStartsAt,
  };
}

export async function publishRetailAsset(
  input: PublishRetailAssetInput
): Promise<PublishRetailAssetResult> {
  const retailAssetId =
    cleanRequiredString(
      input.retailAssetId,
      "retailAssetId"
    );

  const publishedByUserId =
    cleanRequiredString(
      input.publishedByUserId,
      "publishedByUserId"
    );

  const publishedByRole =
    input.publishedByRole;

  if (
    publishedByRole !==
      "brand" &&
    publishedByRole !==
      "admin" &&
    publishedByRole !==
      "system"
  ) {
    throw new Error(
      "publishedByRole is invalid."
    );
  }

  const retailAssetRef =
    adminDb
      .collection("retailAssets")
      .doc(retailAssetId);

  const assetSnap =
    await retailAssetRef.get();

  if (!assetSnap.exists) {
    throw new Error(
      "RETAIL_ASSET_NOT_FOUND"
    );
  }

  const asset =
    assetSnap.data() as Record<
      string,
      any
    >;

  validatePublisherAuthorization({
    asset,
    publishedByUserId,
    publishedByRole,
  });

  const collectionId =
    cleanRequiredString(
      asset.collectionId,
      "Retail Asset collectionId"
    );

  const entryId =
    cleanRequiredString(
      asset.entryId,
      "Retail Asset entryId"
    );

  const campaignId =
    cleanOptionalString(
      asset.campaignId
    );

  let campaign:
    | Record<string, any>
    | null = null;

  let campaignRef:
    | ReturnType<
        typeof adminDb
          .collection
      >["doc"]
    | any = null;

  if (campaignId) {
    campaignRef =
      adminDb
        .collection("campaigns")
        .doc(campaignId);

    const campaignSnap =
      await campaignRef.get();

    if (!campaignSnap.exists) {
      throw new Error(
        "SOURCE_CAMPAIGN_NOT_FOUND"
      );
    }

    campaign =
      campaignSnap.data() as Record<
        string,
        any
      >;

    if (
      campaign.brandApprovalStatus !==
        "approved"
    ) {
      throw new Error(
        "SOURCE_CAMPAIGN_NOT_APPROVED"
      );
    }
  }

  /*
   * Idempotent success for an already-published asset.
   *
   * Rebuild the playlist in case the master projection was
   * lost or needs repair.
   */
  const existingActivationStart =
    toTimestamp(
      asset.activation?.startsAt
    );

  const existingActivationEnd =
    toTimestamp(
      asset.activation?.endsAt
    );

  const alreadyPublished =
    asset.distribution
      ?.publishedToPlaylist ===
      true &&
    asset.distribution?.status ===
      "published" &&
    asset.activation?.status ===
      "active" &&
    asset.license?.status ===
      "active" &&
    existingActivationStart &&
    existingActivationEnd;

  if (alreadyPublished) {
    /*
    * A previously published Retail Asset may predate the
    * standardized playback layer. Prepare/repair it without
    * restarting its existing license window.
    */
    const preparedPlayback =
        await preparePlaybackMedia(
        asset
        );

    const repairedAsset = {
        ...asset,

        media: {
        ...(asset.media || {}),

        url:
            preparedPlayback.sourceUrl,

        storagePath:
            preparedPlayback
            .sourceStoragePath,

        playbackUrl:
            preparedPlayback
            .playbackUrl,

        playbackStoragePath:
            preparedPlayback
            .playbackStoragePath,

        playbackContentType:
            preparedPlayback
            .contentType,

        playbackReusedExistingCopy:
            preparedPlayback
            .reusedExistingCopy,
        },
    };

    const entryRef =
        adminDb
        .collection(
            collectionId
        )
        .doc("_meta")
        .collection("entries")
        .doc(entryId);

    const repairedEntry =
        createIosCompatibleEntry({
        asset:
            repairedAsset,

        campaign,

        activationStartsAt:
            existingActivationStart,

        activationEndsAt:
            existingActivationEnd,

        publishedByUserId,
        });

    await Promise.all([
        entryRef.set(
        repairedEntry,
        {
            merge: true,
        }
        ),

        retailAssetRef.update({
        "media.playbackUrl":
            preparedPlayback
            .playbackUrl,

        "media.playbackStoragePath":
            preparedPlayback
            .playbackStoragePath,

        "media.playbackContentType":
            preparedPlayback
            .contentType,

        "media.playbackSourceUrl":
            preparedPlayback
            .sourceUrl,

        "media.playbackSourceStoragePath":
            preparedPlayback
            .sourceStoragePath,

        "media.playbackReusedExistingCopy":
            preparedPlayback
            .reusedExistingCopy,

        "media.playbackPreparedAt":
            FieldValue.serverTimestamp(),

        updatedAt:
            FieldValue.serverTimestamp(),
        }),
    ]);

    const playlist =
        await rebuildMasterPlaylistForEntry({
        collectionId,
        entryId,
        });

    return {
        retailAssetId,

        campaignId,

        creatorId:
        cleanOptionalString(
            asset.creatorId
        ),

        brandId:
        cleanOptionalString(
            asset.brandId
        ),

        collectionId,
        entryId,

        /*
        * Preserve the original 90-day period.
        * Repairing playback does NOT restart licensing.
        */
        activationStartsAt:
        existingActivationStart,

        activationEndsAt:
        existingActivationEnd,

        licenseStartsAt:
        existingActivationStart,

        licenseExpiresAt:
        existingActivationEnd,

        masterPlaylistPath:
        playlist
            .masterPlaylistPath,

        playlistItemCount:
        playlist
            .playlistItemCount,

        alreadyPublished:
        true,

        playlist,
    };
    }

  validateDraftForPublication(
    asset
  );

  const durationDays =
    getDurationDays(asset);

  const activationStartsAt =
    Timestamp.now();

  const activationEndsAt =
    addDays(
      activationStartsAt,
      durationDays
    );

  const distributionScope =
    input.distributionScope ||
    asset.activation
      ?.distributionScope ||
    "global";

  const countryCodes =
    input.countryCodes
      ? cleanStringArray(
          input.countryCodes
        )
      : cleanStringArray(
          asset.activation
            ?.distributionTargets
            ?.countryCodes
        );

  const regionIds =
    input.regionIds
      ? cleanStringArray(
          input.regionIds
        )
      : cleanStringArray(
          asset.activation
            ?.distributionTargets
            ?.regionIds
        );

  const retailerIds =
    input.retailerIds
      ? cleanStringArray(
          input.retailerIds
        )
      : cleanStringArray(
          asset.activation
            ?.distributionTargets
            ?.retailerIds ||
            asset.activation
              ?.retailerIds
        );

  const storeIds =
    input.storeIds
      ? cleanStringArray(
          input.storeIds
        )
      : cleanStringArray(
          asset.activation
            ?.distributionTargets
            ?.storeIds ||
            asset.activation
              ?.storeIds
        );

  const eventIds =
    input.eventIds
      ? cleanStringArray(
          input.eventIds
        )
      : cleanStringArray(
          asset.activation
            ?.distributionTargets
            ?.eventIds
        );

  const preparedPlayback =
    await preparePlaybackMedia(
        asset
    );

  const activeAsset: RetailAssetFields = {
    ...(asset as RetailAssetFields),

  media: {
    ...(asset.media || {}),

    /*
    * Original Creator upload stays authoritative.
    */
    url:
        preparedPlayback.sourceUrl,

    storagePath:
        preparedPlayback
        .sourceStoragePath,

    /*
    * Distribution copy consumed by iOS.
    */
    playbackUrl:
        preparedPlayback
        .playbackUrl,

    playbackStoragePath:
        preparedPlayback
        .playbackStoragePath,

    playbackContentType:
        preparedPlayback
        .contentType,

    playbackReusedExistingCopy:
        preparedPlayback
        .reusedExistingCopy,
    },

    license: {
      ...asset.license,

      status:
        "active",

      startsAt:
        activationStartsAt,

      expiresAt:
        activationEndsAt,

      durationDays,
    },

    activation: {
      ...asset.activation,

      status:
        "active",

      startsAt:
        activationStartsAt,

      endsAt:
        activationEndsAt,

      publishedAt:
        activationStartsAt,

      distributionScope,

      retailerIds,
      storeIds,

      distributionTargets: {
        countryCodes,
        regionIds,
        retailerIds,
        storeIds,
        eventIds,
      },
    },

    distribution: {
      ...asset.distribution,

      status:
        "publishing",

      publishedToPlaylist:
        false,

      masterPlaylistId:
        collectionId,

      lastPublishAttemptAt:
        activationStartsAt,

      lastPublishError:
        null,
    },

    audit: {
      ...asset.audit,

      assetVersion:
        Number(
          asset.audit
            ?.assetVersion ||
            1
        ) + 1,

      updatedAt:
        FieldValue.serverTimestamp(),
    },
  };

  /*
   * Verify the future active state before writing the AR Entry.
   */
  const eligibility =
    evaluateRetailAssetPlaylistEligibility(
      activeAsset
    );

  if (!eligibility.eligible) {
    throw new Error(
      `RETAIL_ASSET_NOT_PLAYLIST_ELIGIBLE: ${eligibility.reasons.join(
        ", "
      )}`
    );
  }

  const entryRef =
    adminDb
      .collection(
        collectionId
      )
      .doc("_meta")
      .collection("entries")
      .doc(entryId);

  const entryData =
    createIosCompatibleEntry({
      asset:
        activeAsset,

      campaign,

      activationStartsAt,
      activationEndsAt,

      publishedByUserId,
    });

  /*
   * -------------------------------------------------------
   * Stage 1: activate authoritative data and create AR Entry
   * -------------------------------------------------------
   *
   * Playlist rebuilding occurs afterward because Firestore
   * transactions cannot safely read a variable-sized entry
   * collection and then update the master projection in the
   * same transaction.
   */

  await adminDb.runTransaction(
    async (transaction) => {
      const freshAssetSnap =
        await transaction.get(
          retailAssetRef
        );

      if (
        !freshAssetSnap.exists
      ) {
        throw new Error(
          "RETAIL_ASSET_NOT_FOUND"
        );
      }

      const freshAsset =
        freshAssetSnap.data() as Record<
          string,
          any
        >;

      validatePublisherAuthorization({
        asset:
          freshAsset,

        publishedByUserId,

        publishedByRole,
      });

      if (
        freshAsset.distribution
          ?.publishedToPlaylist ===
          true ||
        freshAsset.activation
          ?.status === "active" ||
        freshAsset.license
          ?.status === "active"
      ) {
        throw new Error(
          "RETAIL_ASSET_ALREADY_PUBLISHED"
        );
      }

      validateDraftForPublication(
        freshAsset
      );

      transaction.set(
        entryRef,
        entryData,
        {
          merge: true,
        }
      );

      transaction.update(
        retailAssetRef,
        {
          status:
            "publishing",

          "media.playbackUrl":
            preparedPlayback
             .playbackUrl,

          "media.playbackStoragePath":
            preparedPlayback
                .playbackStoragePath,

          "media.playbackContentType":
            preparedPlayback
                .contentType,

          "media.playbackSourceUrl":
            preparedPlayback
                .sourceUrl,

          "media.playbackSourceStoragePath":
             preparedPlayback
                 .sourceStoragePath,

          "media.playbackReusedExistingCopy":
            preparedPlayback
                .reusedExistingCopy,

          "media.playbackPreparedAt":
            FieldValue.serverTimestamp(),

          license: {
            ...freshAsset.license,

            status:
              "active",

            startsAt:
              activationStartsAt,

            expiresAt:
              activationEndsAt,

            durationDays,
          },

          activation: {
            ...freshAsset.activation,

            status:
              "active",

            startsAt:
              activationStartsAt,

            endsAt:
              activationEndsAt,

            publishedAt:
              activationStartsAt,

            distributionScope,

            retailerIds,
            storeIds,

            distributionTargets: {
              countryCodes,
              regionIds,
              retailerIds,
              storeIds,
              eventIds,
            },
          },

          distribution: {
            ...freshAsset.distribution,

            status:
              "publishing",

            publishedToPlaylist:
              false,

            masterPlaylistId:
              collectionId,

            lastPublishAttemptAt:
              activationStartsAt,

            lastPublishError:
              null,
          },

          "audit.assetVersion":
            Number(
              freshAsset.audit
                ?.assetVersion ||
                1
            ) + 1,

          "audit.updatedAt":
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        }
      );

      if (
        campaignId &&
        campaignRef
      ) {
        transaction.update(
          campaignRef,
          {
            retailAssetId,

            productCollectionId:
              collectionId,

            arEntryId:
              entryId,

            retailAssetCreationStatus:
              "entry_created",

            retailMediaStatus:
              "publishing",

            arStatus:
              "publishing",

            activationStart:
              activationStartsAt,

            activationEnd:
              activationEndsAt,

            updatedAt:
              FieldValue.serverTimestamp(),
          }
        );
      }
    }
  );

  let playlist:
    RebuildMasterPlaylistResult;

  try {
    /*
     * -----------------------------------------------------
     * Stage 2: rebuild iOS production projection
     * -----------------------------------------------------
     */

    playlist =
      await rebuildMasterPlaylistForEntry({
        collectionId,
        entryId,
      });
  } catch (error: any) {
    const failureMessage =
      String(
        error?.message ||
          "Master playlist rebuild failed."
      );

    /*
     * Keep the AR Entry and Retail Asset for recovery, but do
     * not claim that publication completed.
     */
    await retailAssetRef.update({
      status:
        "publish_failed",

      "distribution.status":
        "failed",

      "distribution.publishedToPlaylist":
        false,

      "distribution.lastPublishError":
        failureMessage,

      "distribution.lastPublishAttemptAt":
        FieldValue.serverTimestamp(),

      updatedAt:
        FieldValue.serverTimestamp(),
    });

    if (
      campaignId &&
      campaignRef
    ) {
      await campaignRef.update({
        retailAssetCreationStatus:
          "entry_created",

        retailMediaStatus:
          "publish_failed",

        arStatus:
          "publish_failed",

        updatedAt:
          FieldValue.serverTimestamp(),
      });
    }

    throw new Error(
      `MASTER_PLAYLIST_BUILD_FAILED: ${failureMessage}`
    );
  }

  /*
   * -------------------------------------------------------
   * Stage 3: mark publication complete
   * -------------------------------------------------------
   */

  await adminDb.runTransaction(
    async (transaction) => {
      const freshAssetSnap =
        await transaction.get(
          retailAssetRef
        );

      if (
        !freshAssetSnap.exists
      ) {
        throw new Error(
          "RETAIL_ASSET_NOT_FOUND"
        );
      }

      const freshAsset =
        freshAssetSnap.data() as Record<
          string,
          any
        >;

      transaction.update(
        retailAssetRef,
        {
          status:
            "active",

          "distribution.status":
            "published",

          "distribution.publishedToPlaylist":
            true,

          "distribution.masterPlaylistId":
            collectionId,

          "distribution.playlistVersion":
            Number(
              freshAsset.distribution
                ?.playlistVersion ||
                0
            ) + 1,

          "distribution.publishedAt":
            activationStartsAt,

          "distribution.lastPublishError":
            null,

          publishedAt:
            activationStartsAt,

          updatedAt:
            FieldValue.serverTimestamp(),
        }
      );

      if (
        campaignId &&
        campaignRef
      ) {
        transaction.update(
          campaignRef,
          {
            retailAssetId,

            productCollectionId:
              collectionId,

            arEntryId:
              entryId,

            publishedArEntryId:
              entryId,

            retailAssetCreationStatus:
              "created",

            retailMediaStatus:
              "active",

            arStatus:
              "live",

            activationStart:
              activationStartsAt,

            activationEnd:
              activationEndsAt,

            retailAssetPublishedAt:
              activationStartsAt,

            /*
             * Payout fields remain untouched.
             */
            updatedAt:
              FieldValue.serverTimestamp(),
          }
        );
      }
    }
  );

  return {
    retailAssetId,

    campaignId,

    creatorId:
      cleanOptionalString(
        asset.creatorId
      ),

    brandId:
      cleanOptionalString(
        asset.brandId
      ),

    collectionId,
    entryId,

    activationStartsAt,
    activationEndsAt,

    licenseStartsAt:
      activationStartsAt,

    licenseExpiresAt:
      activationEndsAt,

    masterPlaylistPath:
      playlist
        .masterPlaylistPath,

    playlistItemCount:
      playlist
        .playlistItemCount,

    alreadyPublished:
      false,

    playlist,
  };
}