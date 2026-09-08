import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../firebase-admin";
import { createCampaignRetailAssetDefaults } from "../retail-media";
import { promoteRetailMediaStagedUpload, verifyRetailMediaStagedUpload } from "./direct-upload-storage";
import { publishRetailAsset } from "./publish-retail-asset";
import { resolveProductCollection } from "./product-resolution";

export const FIRST_FREE_ACTIVATION_DAYS = 30;
export const FIRST_FREE_INCLUDED_QUALIFIED_VIEWS = 250;
const MAX_MEDIA_BYTES = 250 * 1024 * 1024;
const MAX_TARGET_BYTES = 25 * 1024 * 1024;
const TARGET_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export type FirstFreeRightsBasis = "brand_owned" | "brand_licensed";

export function firstFreeIds(brandId: string) {
  return {
    campaignId: `first-free-${brandId}`,
    retailAssetId: `rm-free-${brandId}`,
    entryId: `first-free-${brandId}-v1`,
  };
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function targetExtension(contentType: string): string {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/heic") return "heic";
  if (contentType === "image/heif") return "heif";
  return "bin";
}

export async function verifyFirstFreeScanReady(params: {
  brandId: string;
  campaignId: string;
}) {
  const campaignSnap = await adminDb.collection("campaigns").doc(params.campaignId).get();
  if (!campaignSnap.exists) {
    return { scanReady: false, status: "not_found", campaign: null };
  }
  const campaign = campaignSnap.data() as Record<string, any>;
  if (clean(campaign.brandId) !== params.brandId) {
    throw new Error("NOT_AUTHORIZED");
  }

  const retailAssetId = clean(campaign.retailAssetId);
  const collectionId = clean(campaign.productCollectionId);
  const entryId = clean(campaign.arEntryId || campaign.publishedArEntryId);
  if (!retailAssetId || !collectionId || !entryId) {
    return {
      scanReady: false,
      status: clean(campaign.arStatus) || "preparing",
      campaign,
    };
  }

  const [assetSnap, entrySnap, masterSnap] = await Promise.all([
    adminDb.collection("retailAssets").doc(retailAssetId).get(),
    adminDb.collection(collectionId).doc("_meta").collection("entries").doc(entryId).get(),
    adminDb.collection("masters").doc(collectionId).get(),
  ]);
  const asset = assetSnap.exists ? (assetSnap.data() as Record<string, any>) : null;
  const eligibleEntryIds = masterSnap.exists
    ? (masterSnap.data()?.eligibleEntryIds as unknown)
    : null;
  const projected = Array.isArray(eligibleEntryIds) && eligibleEntryIds.includes(entryId);
  const scanReady = Boolean(
    asset &&
      clean(asset.brandId) === params.brandId &&
      asset.status === "active" &&
      asset.license?.status === "active" &&
      asset.activation?.status === "active" &&
      asset.distribution?.status === "published" &&
      asset.distribution?.publishedToPlaylist === true &&
      entrySnap.exists &&
      projected
  );

  return {
    scanReady,
    status: scanReady ? "active" : clean(campaign.arStatus) || "preparing",
    campaign,
    retailAssetId,
    collectionId,
    entryId,
    activationStartsAt: asset?.activation?.startsAt || null,
    activationEndsAt: asset?.activation?.endsAt || null,
    includedQualifiedViews:
      Number(asset?.monetization?.includedQualifiedViews || 0) || null,
  };
}

export async function createAndPublishFirstFreeActivation(params: {
  brandId: string;
  brandName: string;
  productName: string;
  campaignTitle?: string;
  destinationUrl?: string;
  mediaStoragePath: string;
  targetImageStoragePath: string;
  rightsBasis: FirstFreeRightsBasis;
  contentRightsConfirmed: boolean;
  audioRightsConfirmed: boolean;
  appearanceRightsConfirmed: boolean;
}) {
  const brandName = clean(params.brandName);
  const productName = clean(params.productName);
  const campaignTitle = clean(params.campaignTitle) || `First IRL Campaign — ${productName}`;
  const destinationUrl = clean(params.destinationUrl);
  if (!brandName || !productName) throw new Error("Brand name and product name are required.");
  if (!validUrl(destinationUrl)) throw new Error("Shopper destination must be a valid HTTP or HTTPS URL.");
  if (!params.contentRightsConfirmed || !params.audioRightsConfirmed || !params.appearanceRightsConfirmed) {
    throw new Error("Complete all required rights certifications before publishing.");
  }
  if (params.rightsBasis !== "brand_owned" && params.rightsBasis !== "brand_licensed") {
    throw new Error("Select a valid content-rights basis.");
  }

  const [mediaUpload, targetUpload] = await Promise.all([
    verifyRetailMediaStagedUpload({
      storagePath: params.mediaStoragePath,
      brandUserId: params.brandId,
      kind: "media",
    }),
    verifyRetailMediaStagedUpload({
      storagePath: params.targetImageStoragePath,
      brandUserId: params.brandId,
      kind: "target",
    }),
  ]);
  const mediaType = mediaUpload.contentType.toLowerCase();
  if (
    !mediaUpload.originalName.toLowerCase().endsWith(".mp4") ||
    (mediaType && mediaType !== "video/mp4" && mediaType !== "application/octet-stream") ||
    mediaUpload.sizeBytes > MAX_MEDIA_BYTES
  ) {
    throw new Error("The free IRL campaign requires one MP4 video no larger than 250 MB.");
  }
  if (!TARGET_TYPES.has(targetUpload.contentType) || targetUpload.sizeBytes > MAX_TARGET_BYTES) {
    throw new Error("The product image must be JPEG, PNG, WebP, HEIC, or HEIF and no larger than 25 MB.");
  }

  const ids = firstFreeIds(params.brandId);
  const brandRef = adminDb.collection("brands").doc(params.brandId);
  const campaignRef = adminDb.collection("campaigns").doc(ids.campaignId);
  const legacyFirstFree = await adminDb
    .collection("campaigns")
    .where("brandId", "==", params.brandId)
    .get();
  const conflictingLegacy = legacyFirstFree.docs.some((doc) => {
    const data = doc.data();
    return doc.id !== ids.campaignId &&
      (data.isFirstFreeIRLLaunch === true || data.campaignType === "brand_first_irl_preview");
  });
  if (conflictingLegacy) throw new Error("FIRST_FREE_ALREADY_CLAIMED");

  await adminDb.runTransaction(async (transaction) => {
    const [brandSnap, campaignSnap] = await Promise.all([
      transaction.get(brandRef),
      transaction.get(campaignRef),
    ]);
    if (!brandSnap.exists) throw new Error("BRAND_PROFILE_NOT_FOUND");
    const brand = brandSnap.data() as Record<string, any>;
    const claimStatus = clean(brand.firstFreeIRL?.status);
    const claimCampaignId = clean(brand.firstFreeIRL?.campaignId);
    if (
      (brand.hasLaunchedFirstIRL === true || claimStatus === "active") &&
      claimCampaignId !== ids.campaignId
    ) {
      throw new Error("FIRST_FREE_ALREADY_CLAIMED");
    }
    if (claimCampaignId && claimCampaignId !== ids.campaignId) {
      throw new Error("FIRST_FREE_ALREADY_CLAIMED");
    }

    transaction.set(brandRef, {
      firstFreeIRL: {
        status: claimStatus === "active" ? "active" : "reserved",
        campaignId: ids.campaignId,
        retailAssetId: ids.retailAssetId,
        reservedAt: brand.firstFreeIRL?.reservedAt || FieldValue.serverTimestamp(),
        activatedAt: brand.firstFreeIRL?.activatedAt || null,
        lastError: null,
      },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    if (!campaignSnap.exists) {
      transaction.create(campaignRef, {
        brandId: params.brandId,
        brandName,
        campaignTitle,
        productName,
        campaignContentUrl: destinationUrl || null,
        campaignType: "brand_first_irl_preview",
        status: "preparing",
        isFirstFreeIRLLaunch: true,
        isAutoGeneratedLaunch: true,
        brandApprovalStatus: "approved",
        fundingStatus: "not_funded",
        payoutStatus: "not_ready",
        arStatus: "preparing",
        retailMediaStatus: "preparing",
        recoveryRequired: false,
        publicationAttemptCount: 0,
        firstFreeEntitlement: {
          activationDays: FIRST_FREE_ACTIVATION_DAYS,
          includedQualifiedViews: FIRST_FREE_INCLUDED_QUALIFIED_VIEWS,
          productLimit: 1,
          videoLimit: 1,
        },
        retailAssetId: ids.retailAssetId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  const alreadyReady = await verifyFirstFreeScanReady({
    brandId: params.brandId,
    campaignId: ids.campaignId,
  });
  if (alreadyReady.scanReady) return alreadyReady;

  await adminDb.runTransaction(async (transaction) => {
    const brandSnap = await transaction.get(brandRef);
    if (!brandSnap.exists) throw new Error("BRAND_PROFILE_NOT_FOUND");
    const firstFree = brandSnap.data()?.firstFreeIRL || {};
    const publishingAt = firstFree.publishingAt?.toMillis?.() || 0;
    const publishingIsFresh =
      firstFree.status === "publishing" && Date.now() - publishingAt < 15 * 60 * 1000;
    if (publishingIsFresh) throw new Error("FIRST_FREE_PUBLICATION_IN_PROGRESS");
    transaction.set(brandRef, {
      "firstFreeIRL.status": "publishing",
      "firstFreeIRL.publishingAt": FieldValue.serverTimestamp(),
      "firstFreeIRL.lastError": null,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  try {
    await campaignRef.set({
      status: "publishing",
      arStatus: "publishing",
      retailMediaStatus: "publishing",
      recoveryRequired: false,
      publicationAttemptCount: FieldValue.increment(1),
      lastPublicationError: null,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    const resolution = await resolveProductCollection({
      rawOcr: `${brandName} ${productName}`,
      brandName,
      productName,
      source: "manual",
      createdBy: params.brandId,
      createIfMissing: true,
    });
    const mediaPath = `retail-media-source/${params.brandId}/${ids.retailAssetId}/source.mp4`;
    const targetPath =
      `retail-media-targets/${params.brandId}/${ids.retailAssetId}/target.` +
      targetExtension(targetUpload.contentType);
    const [media, target] = await Promise.all([
      promoteRetailMediaStagedUpload({
        sourcePath: params.mediaStoragePath,
        destinationPath: mediaPath,
        contentType: "video/mp4",
        metadata: {
          retailAssetId: ids.retailAssetId,
          brandId: params.brandId,
          sourceProduct: "first_free_irl",
          uploadPurpose: "retail_media_source",
          originalFileName: mediaUpload.originalName,
        },
      }),
      promoteRetailMediaStagedUpload({
        sourcePath: params.targetImageStoragePath,
        destinationPath: targetPath,
        contentType: targetUpload.contentType,
        metadata: {
          retailAssetId: ids.retailAssetId,
          brandId: params.brandId,
          sourceProduct: "first_free_irl",
          uploadPurpose: "retail_media_target",
          originalFileName: targetUpload.originalName,
        },
      }),
    ]);

    const assetRef = adminDb.collection("retailAssets").doc(ids.retailAssetId);
    const base = createCampaignRetailAssetDefaults({
      retailAssetId: ids.retailAssetId,
      collectionId: resolution.collectionId,
      entryId: ids.entryId,
      campaignId: ids.campaignId,
      creatorId: params.brandId,
      brandId: params.brandId,
      sourceProduct: "retail_media",
      rawOcr: resolution.rawOcr,
      normalizedOcr: resolution.normalizedOcr,
      canonicalName: resolution.canonicalName,
      canonicalSlug: resolution.canonicalSlug,
      detectedBrand: brandName,
      detectedProductNoun: productName,
      recognitionTokens: resolution.tokens,
      recognitionSource: "manual",
      matcherVersion: resolution.matcherVersion,
      createdBy: params.brandId,
      createdByRole: "brand",
      createdFrom: "web",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const asset = {
      ...base,
      status: "draft",
      creatorId: null,
      commercialSource: {
        product: "first_free_irl",
        acquisitionType: "one_time_free_activation",
      },
      media: {
        url: media.url,
        storagePath: media.storagePath,
        contentType: "video/mp4",
        publicPostUrl: destinationUrl || null,
        originalName: mediaUpload.originalName,
        sizeBytes: mediaUpload.sizeBytes,
      },
      targetImage: {
        url: target.url,
        storagePath: target.storagePath,
        contentType: targetUpload.contentType,
        originalName: targetUpload.originalName,
        sizeBytes: targetUpload.sizeBytes,
      },
      ownership: {
        ownerType: "brand",
        ownerId: params.brandId,
        creatorId: null,
        brandId: params.brandId,
        creatorRetainsCopyright: params.rightsBasis === "brand_licensed",
        rightsBasis: params.rightsBasis,
        certifiedAt: FieldValue.serverTimestamp(),
      },
      rights: {
        status: "certified",
        contentRightsConfirmed: true,
        audioRightsConfirmed: true,
        appearanceRightsConfirmed: true,
        brandUsageApproved: true,
        goshshaDistributionLicenseGranted: true,
        rightsBasis: params.rightsBasis,
        certificationVersion: "first-free-irl-1.0",
        certifiedByUserId: params.brandId,
        certifiedByRole: "brand",
        certifiedAt: FieldValue.serverTimestamp(),
      },
      license: {
        ...base.license,
        type: "fixed_term",
        status: "pending",
        startsAt: null,
        expiresAt: null,
        durationDays: FIRST_FREE_ACTIVATION_DAYS,
        renewalAllowed: false,
        automaticRenewalAllowed: false,
        termsVersion: "first-free-irl-1.0",
      },
      playback: {
        ...base.playback,
        mode: "full_video",
        fullVideoAllowed: true,
        audioAllowed: true,
        defaultMuted: true,
        autoplay: true,
        contentType: "video/mp4",
      },
      monetization: {
        model: "included_campaign_window",
        product: "first_free_irl",
        activationPriceUsd: 0,
        includedQualifiedViews: FIRST_FREE_INCLUDED_QUALIFIED_VIEWS,
        qualifiedViewsUsed: 0,
        overageQualifiedViews: 0,
        activationDays: FIRST_FREE_ACTIVATION_DAYS,
        usageStatus: "included_usage",
        currency: "USD",
      },
      audit: {
        ...base.audit,
        sourceProduct: "first_free_irl",
      },
    };

    await adminDb.runTransaction(async (transaction) => {
      const existing = await transaction.get(assetRef);
      if (existing.exists) {
        if (clean(existing.data()?.brandId) !== params.brandId) {
          throw new Error("RETAIL_ASSET_OWNERSHIP_CONFLICT");
        }
      } else {
        transaction.create(assetRef, asset);
      }
      transaction.set(campaignRef, {
        retailAssetId: ids.retailAssetId,
        productCollectionId: resolution.collectionId,
        arEntryId: ids.entryId,
        arTargetImageUrl: target.url,
        arTargetImagePath: target.storagePath,
        retailAssetCreationStatus: "created",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    await publishRetailAsset({
      retailAssetId: ids.retailAssetId,
      publishedByUserId: params.brandId,
      publishedByRole: "brand",
      distributionScope: "global",
    });
    const verified = await verifyFirstFreeScanReady({
      brandId: params.brandId,
      campaignId: ids.campaignId,
    });
    if (!verified.scanReady) throw new Error("CANONICAL_PUBLICATION_VERIFICATION_FAILED");

    await Promise.all([
      brandRef.set({
        hasLaunchedFirstIRL: true,
        firstFreeIRL: {
          status: "active",
          campaignId: ids.campaignId,
          retailAssetId: ids.retailAssetId,
          reservedAt: FieldValue.serverTimestamp(),
          activatedAt: FieldValue.serverTimestamp(),
          publishingAt: null,
          lastError: null,
        },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true }),
      campaignRef.set({
        status: "ar_live",
        arStatus: "live",
        retailMediaStatus: "active",
        canonicalScanReady: true,
        canonicalScanReadyVerifiedAt: FieldValue.serverTimestamp(),
        recoveryRequired: false,
        lastPublicationError: null,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true }),
    ]);
    return verified;
  } catch (error: any) {
    const message = clean(error?.message) || "Automatic publication failed.";
    await Promise.all([
      brandRef.set({
        firstFreeIRL: {
          status: "recovery_required",
          campaignId: ids.campaignId,
          retailAssetId: ids.retailAssetId,
          reservedAt: FieldValue.serverTimestamp(),
          activatedAt: null,
          publishingAt: null,
          lastError: message,
        },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true }),
      campaignRef.set({
        status: "recovery_required",
        arStatus: "publish_failed",
        retailMediaStatus: "publish_failed",
        canonicalScanReady: false,
        recoveryRequired: true,
        lastPublicationError: message,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true }),
      adminDb.collection("notifications").add({
        userId: "admin",
        role: "admin",
        type: "first_free_irl_recovery_required",
        title: "Free IRL Campaign Needs Recovery",
        message: `${brandName}: ${campaignTitle} could not be published automatically.`,
        campaignId: ids.campaignId,
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }),
    ]);
    throw error;
  }
}
