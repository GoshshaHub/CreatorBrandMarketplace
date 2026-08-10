export type RetailAssetOwnerType =
  | "creator"
  | "brand"
  | "platform"
  | "consumer";

export type RetailAssetSourceProduct =
  | "creator_network"
  | "retail_media"
  | "rights_management"
  | "consumer_creation";

export type RightsStatus =
  | "pending"
  | "certified"
  | "restricted"
  | "revoked";

export type LicenseType =
  | "campaign_window"
  | "fixed_term"
  | "perpetual"
  | "pay_per_view"
  | "unlicensed";

export type LicenseStatus =
  | "pending"
  | "active"
  | "grace_period"
  | "expired"
  | "terminated";

export type PlaybackMode =
  | "full_video"
  | "silent_video"
  | "animated_preview"
  | "image";

export type ActivationStatus =
  | "draft"
  | "pending_review"
  | "scheduled"
  | "active"
  | "paused"
  | "expired"
  | "archived";

export type DistributionScope =
  | "global"
  | "country"
  | "region"
  | "retailer"
  | "store"
  | "event";

export type DistributionStatus =
  | "not_published"
  | "publishing"
  | "published"
  | "removed"
  | "failed";

export type RetailAssetOwnership = {
  ownerType: RetailAssetOwnerType;
  ownerId: string;

  creatorId?: string | null;
  brandId?: string | null;

  creatorRetainsCopyright: boolean;

  certifiedAt?: unknown;
};

export type RetailAssetRights = {
  status: RightsStatus;

  contentRightsConfirmed: boolean;
  audioRightsConfirmed: boolean;
  appearanceRightsConfirmed: boolean;
  brandUsageApproved: boolean;

  certificationVersion: string;

  certifiedByUserId?: string | null;
  certifiedAt?: unknown;

  revokedAt?: unknown;
  revokedReason?: string | null;
};

export type RetailAssetLicense = {
  type: LicenseType;
  status: LicenseStatus;

  startsAt?: unknown;
  expiresAt?: unknown;

  durationDays?: number | null;

  renewalAllowed: boolean;
  automaticRenewalAllowed?: boolean;

  futurePaidReactivationAllowed?: boolean;
  futureRoyaltyEarningsAcknowledged?: boolean;

  qualifiedViewRate?: number | null;
  currency?: string | null;

  gracePeriodEndsAt?: unknown;

  terminatedAt?: unknown;
  terminationReason?: string | null;

  termsVersion?: string | null;
};

export type RetailAssetPlayback = {
  mode: PlaybackMode;

  fullVideoAllowed: boolean;
  audioAllowed: boolean;

  defaultMuted: boolean;
  autoplay: boolean;

  previewDurationSeconds?: number | null;

  contentType?: string | null;
};

export type RetailAssetDistributionTargets = {
  countryCodes: string[];
  regionIds: string[];
  retailerIds: string[];
  storeIds: string[];
  eventIds: string[];
};

export type RetailAssetActivation = {
  status: ActivationStatus;

  startsAt?: unknown;
  endsAt?: unknown;

  publishedAt?: unknown;
  pausedAt?: unknown;
  expiredAt?: unknown;
  archivedAt?: unknown;

  distributionScope: DistributionScope;

  /*
   * These two fields remain for compatibility with code
   * already reading activation.retailerIds and storeIds.
   */
  retailerIds: string[];
  storeIds: string[];

  /*
   * Long-term targeting structure.
   */
  distributionTargets: RetailAssetDistributionTargets;
};

export type RetailAssetDistribution = {
  status: DistributionStatus;

  publishedToPlaylist: boolean;

  masterPlaylistId?: string | null;
  playlistVersion: number;

  publishedAt?: unknown;
  removedAt?: unknown;

  lastPublishAttemptAt?: unknown;
  lastPublishError?: string | null;
};

export type RetailAssetRecognition = {
  rawOcr?: string | null;
  normalizedOcr?: string | null;

  canonicalName?: string | null;
  canonicalSlug?: string | null;

  detectedBrand?: string | null;
  detectedProductNoun?: string | null;

  tokens: string[];

  confidence?: number | null;

  matcherVersion: string;
  source:
    | "ios_vision"
    | "web_ocr"
    | "manual"
    | "imported";
};

export type RetailAssetMetrics = {
  views: number;
  qualifiedViews: number;

  votesUp: number;
  votesDown: number;
  shares: number;

  lastViewedAt?: unknown;
  lastQualifiedViewAt?: unknown;
};

export type RetailAssetMonetization = {
  model:
    | "included_campaign_window"
    | "pay_per_view"
    | "fixed_license"
    | "subscription_included"
    | "unmonetized";

  brandPrice?: number | null;

  creatorRate?: number | null;
  creatorShare?: number | null;

  qualifiedViewRate?: number | null;

  currency: string;

  payoutSchedule?: string | null;
};

export type RetailAssetAudit = {
  createdBy: string;

  createdByRole:
    | "creator"
    | "brand"
    | "admin"
    | "consumer"
    | "system";

  createdFrom:
    | "ios"
    | "web"
    | "admin"
    | "migration"
    | "system";

  schemaVersion: number;
  assetVersion: number;

  createdAt?: unknown;
  updatedAt?: unknown;
};

export type RetailAssetFields = {
  retailAssetId: string;

  sourceProduct: RetailAssetSourceProduct;

  campaignId?: string | null;
  creatorId?: string | null;
  brandId?: string | null;

  collectionId: string;
  entryId: string;

  masterPlaylistId?: string | null;

  media?: {
    url: string;
    storagePath: string;

    contentType?: string | null;

    publicPostUrl?: string | null;

    playbackUrl?: string | null;
    playbackStoragePath?: string | null;
    playbackContentType?: string | null;

    playbackSourceUrl?: string | null;
    playbackSourceStoragePath?: string | null;

    playbackReusedExistingCopy?: boolean | null;

    playbackPreparedAt?: unknown;
  };

  targetImage?: {
    url: string;
    storagePath: string;

    contentType?: string | null;
  };

  ownership: RetailAssetOwnership;
  rights: RetailAssetRights;
  license: RetailAssetLicense;
  playback: RetailAssetPlayback;
  activation: RetailAssetActivation;
  distribution: RetailAssetDistribution;
  recognition: RetailAssetRecognition;
  metrics: RetailAssetMetrics;
  monetization: RetailAssetMonetization;
  audit: RetailAssetAudit;
};

export type CreateCampaignRetailAssetDefaultsParams = {
  retailAssetId: string;
  collectionId: string;
  entryId: string;

  campaignId: string;
  creatorId: string;
  brandId: string;

  sourceProduct?: RetailAssetSourceProduct;

  masterPlaylistId?: string | null;

  rawOcr?: string | null;
  normalizedOcr?: string | null;

  canonicalName?: string | null;
  canonicalSlug?: string | null;

  detectedBrand?: string | null;
  detectedProductNoun?: string | null;

  recognitionTokens?: string[];
  recognitionConfidence?: number | null;

  recognitionSource?:
    | "ios_vision"
    | "web_ocr"
    | "manual"
    | "imported";

  matcherVersion?: string;

  createdBy?: string;
  createdByRole?:
    | "creator"
    | "brand"
    | "admin"
    | "consumer"
    | "system";

  createdFrom?:
    | "ios"
    | "web"
    | "admin"
    | "migration"
    | "system";

  activationStartsAt?: unknown;
  activationEndsAt?: unknown;

  createdAt?: unknown;
  updatedAt?: unknown;
};

export function createCampaignRetailAssetDefaults(
  params: CreateCampaignRetailAssetDefaultsParams
): RetailAssetFields {
  const {
    retailAssetId,
    collectionId,
    entryId,

    campaignId,
    creatorId,
    brandId,

    sourceProduct =
      "creator_network",

    masterPlaylistId =
      collectionId,

    rawOcr = null,
    normalizedOcr = null,

    canonicalName = null,
    canonicalSlug = collectionId,

    detectedBrand = null,
    detectedProductNoun = null,

    recognitionTokens = [],
    recognitionConfidence = null,

    recognitionSource =
      "web_ocr",

    matcherVersion =
      "product-resolution-v1",

    createdBy =
      creatorId,

    createdByRole =
      "creator",

    createdFrom =
      "web",

    activationStartsAt,
    activationEndsAt,

    createdAt,
    updatedAt,
  } = params;

  return {
    retailAssetId,

    sourceProduct,

    campaignId,
    creatorId,
    brandId,

    collectionId,
    entryId,

    masterPlaylistId,

    ownership: {
      ownerType:
        "creator",

      ownerId:
        creatorId,

      creatorId,
      brandId,

      creatorRetainsCopyright:
        true,
    },

    rights: {
      status:
        "pending",

      contentRightsConfirmed:
        false,

      audioRightsConfirmed:
        false,

      appearanceRightsConfirmed:
        false,

      brandUsageApproved:
        false,

      certificationVersion:
        "1.0",

      certifiedByUserId:
        null,
    },

    license: {
      type:
        "campaign_window",

      status:
        "pending",

      startsAt:
        activationStartsAt,

      expiresAt:
        activationEndsAt,

      durationDays:
        90,

      renewalAllowed:
        true,

      automaticRenewalAllowed:
        false,

      futurePaidReactivationAllowed:
        true,

      futureRoyaltyEarningsAcknowledged:
        true,

      qualifiedViewRate:
        null,

      currency:
        "USD",

      termsVersion:
        "1.0",
    },

    playback: {
      mode:
        "silent_video",

      fullVideoAllowed:
        false,

      audioAllowed:
        false,

      defaultMuted:
        true,

      autoplay:
        true,

      previewDurationSeconds:
        8,

      contentType:
        null,
    },

    activation: {
      status:
        "draft",

      startsAt:
        activationStartsAt,

      endsAt:
        activationEndsAt,

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
        "not_published",

      publishedToPlaylist:
        false,

      masterPlaylistId,

      playlistVersion:
        0,
    },

    recognition: {
      rawOcr,
      normalizedOcr,

      canonicalName,
      canonicalSlug,

      detectedBrand,
      detectedProductNoun,

      tokens:
        recognitionTokens,

      confidence:
        recognitionConfidence,

      matcherVersion,

      source:
        recognitionSource,
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
    },

    monetization: {
      model:
        "included_campaign_window",

      brandPrice:
        null,

      creatorRate:
        null,

      creatorShare:
        null,

      qualifiedViewRate:
        null,

      currency:
        "USD",

      payoutSchedule:
        null,
    },

    audit: {
      createdBy,
      createdByRole,
      createdFrom,

      schemaVersion:
        2,

      assetVersion:
        1,

      createdAt,
      updatedAt,
    },
  };
}

export type PlaylistEligibilityResult = {
  eligible: boolean;
  reasons: string[];
};

export function evaluateRetailAssetPlaylistEligibility(
  asset: Pick<
    RetailAssetFields,
    | "rights"
    | "license"
    | "activation"
    | "playback"
  >
): PlaylistEligibilityResult {
  const reasons: string[] = [];

  if (
    asset.rights.status !==
    "certified"
  ) {
    reasons.push(
      "rights_not_certified"
    );
  }

  if (
    asset.rights
      .contentRightsConfirmed !==
    true
  ) {
    reasons.push(
      "content_rights_not_confirmed"
    );
  }

  if (
    asset.rights
      .brandUsageApproved !==
    true
  ) {
    reasons.push(
      "brand_usage_not_approved"
    );
  }

  if (
    asset.license.status !==
    "active"
  ) {
    reasons.push(
      "license_not_active"
    );
  }

  if (
    asset.activation.status !==
    "active"
  ) {
    reasons.push(
      "activation_not_active"
    );
  }

  const playbackAllowed =
    asset.playback
      .fullVideoAllowed ===
      true ||
    asset.playback.mode ===
      "silent_video" ||
    asset.playback.mode ===
      "animated_preview" ||
    asset.playback.mode ===
      "image";

  if (!playbackAllowed) {
    reasons.push(
      "playback_not_allowed"
    );
  }

  return {
    eligible:
      reasons.length === 0,

    reasons,
  };
}

/*
 * Preserve the existing boolean helper because current
 * publishing code already imports it.
 */
export function isRetailAssetPlaylistEligible(
  asset: Pick<
    RetailAssetFields,
    | "rights"
    | "license"
    | "activation"
    | "playback"
  >
): boolean {
  return evaluateRetailAssetPlaylistEligibility(
    asset
  ).eligible;
}