export type RetailAssetOwnerType =
  | "creator"
  | "brand"
  | "platform"
  | "consumer";

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

  renewalAllowed: boolean;

  qualifiedViewRate?: number | null;
  currency?: string | null;

  gracePeriodEndsAt?: unknown;
  terminatedAt?: unknown;
  terminationReason?: string | null;
};

export type RetailAssetPlayback = {
  mode: PlaybackMode;

  fullVideoAllowed: boolean;
  audioAllowed: boolean;
  defaultMuted: boolean;
  autoplay: boolean;

  previewDurationSeconds?: number | null;
};

export type RetailAssetActivation = {
  status: ActivationStatus;

  startsAt?: unknown;
  endsAt?: unknown;

  publishedAt?: unknown;
  pausedAt?: unknown;
  expiredAt?: unknown;
  archivedAt?: unknown;

  distributionScope: "global" | "retailer" | "store";
  retailerIds: string[];
  storeIds: string[];
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

export type RetailAssetAudit = {
  createdBy: string;
  createdByRole: "creator" | "brand" | "admin" | "consumer" | "system";
  schemaVersion: number;

  createdAt?: unknown;
  updatedAt?: unknown;
};

export type RetailAssetFields = {
  retailAssetId: string;

  campaignId?: string | null;
  creatorId?: string | null;
  brandId?: string | null;

  collectionId: string;
  entryId: string;

  ownership: RetailAssetOwnership;
  rights: RetailAssetRights;
  license: RetailAssetLicense;
  playback: RetailAssetPlayback;
  activation: RetailAssetActivation;
  metrics: RetailAssetMetrics;
  audit: RetailAssetAudit;
};

export type CreateCampaignRetailAssetDefaultsParams = {
  retailAssetId: string;
  collectionId: string;
  entryId: string;

  campaignId: string;
  creatorId: string;
  brandId: string;

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
    activationStartsAt,
    activationEndsAt,
    createdAt,
    updatedAt,
  } = params;

  return {
    retailAssetId,

    campaignId,
    creatorId,
    brandId,

    collectionId,
    entryId,

    ownership: {
      ownerType: "creator",
      ownerId: creatorId,
      creatorId,
      brandId,
      creatorRetainsCopyright: true,
    },

    rights: {
      status: "pending",
      contentRightsConfirmed: false,
      audioRightsConfirmed: false,
      appearanceRightsConfirmed: false,
      brandUsageApproved: false,
      certificationVersion: "1.0",
      certifiedByUserId: null,
    },

    license: {
      type: "campaign_window",
      status: "pending",
      startsAt: activationStartsAt,
      expiresAt: activationEndsAt,
      renewalAllowed: true,
      qualifiedViewRate: null,
      currency: "USD",
    },

    playback: {
      mode: "silent_video",
      fullVideoAllowed: false,
      audioAllowed: false,
      defaultMuted: true,
      autoplay: true,
      previewDurationSeconds: 8,
    },

    activation: {
      status: "draft",
      startsAt: activationStartsAt,
      endsAt: activationEndsAt,
      distributionScope: "global",
      retailerIds: [],
      storeIds: [],
    },

    metrics: {
      views: 0,
      qualifiedViews: 0,
      votesUp: 0,
      votesDown: 0,
      shares: 0,
    },

    audit: {
      createdBy: creatorId,
      createdByRole: "creator",
      schemaVersion: 1,
      createdAt,
      updatedAt,
    },
  };
}

export function isRetailAssetPlaylistEligible(
  asset: Pick<RetailAssetFields, "rights" | "license" | "activation" | "playback">
): boolean {
  return (
    asset.rights.status === "certified" &&
    asset.rights.contentRightsConfirmed === true &&
    asset.rights.brandUsageApproved === true &&
    asset.license.status === "active" &&
    asset.activation.status === "active" &&
    (
      asset.playback.fullVideoAllowed === true ||
      asset.playback.mode === "silent_video" ||
      asset.playback.mode === "animated_preview" ||
      asset.playback.mode === "image"
    )
  );
}