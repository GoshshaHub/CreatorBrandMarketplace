import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "./firebase";

import {
  createNotification,
  markNotificationRead,
} from "./notifications";

/*
 * ---------------------------------------------------------
 * Campaign workflow types
 * ---------------------------------------------------------
 */

export type CampaignStatus =
  | "invited"
  | "accepted"
  | "rejected"
  | "funded"
  | "submitted"
  | "approved"
  | "completed";

export type FundingStatus =
  | "not_funded"
  | "funded";

export type BrandApprovalStatus =
  | "pending"
  | "approved"
  | "rejected";

export type PayoutStatus =
  | "not_ready"
  | "ready_to_release"
  | "processing"
  | "released";

export type PayoutReleaseStatus =
  | "not_started"
  | "processing"
  | "failed"
  | "released";

export type CompletionStatus =
  | "not_completed"
  | "brand_approved"
  | "creator_transaction_completed";

export type RetailAssetCreationStatus =
  | "not_created"
  | "pending"
  | "created"
  | "failed";

export type RetailMediaStatus =
  | "not_activated"
  | "awaiting_retail_activation"
  | "active"
  | "inactive"
  | "expired";

export type ArStatus =
  | "not_started"
  | "needs_admin_creation"
  | "awaiting_retail_activation"
  | "live"
  | "inactive"
  | "failed";

/*
 * ---------------------------------------------------------
 * Creator submission
 * ---------------------------------------------------------
 */

export type CreatorSubmission = {
  publicPostUrl?: string | null;

  originalMediaUrl?: string | null;
  originalMediaStoragePath?: string | null;
  originalMediaName?: string | null;

  mediaType?:
    | "video"
    | "image"
    | "file"
    | null;

  mediaContentType?: string | null;
  mediaSizeBytes?: number | null;

  submittedBy?: string | null;
  submittedAt?: any;

  submissionVersion?: number;
};

/*
 * ---------------------------------------------------------
 * Creator rights certification
 * ---------------------------------------------------------
 */

export type CreatorRightsCertification = {
  status?:
    | "pending"
    | "certified"
    | "brand_approved";

  contentRightsConfirmed?: boolean;
  audioRightsConfirmed?: boolean;
  appearanceRightsConfirmed?: boolean;
  creatorRetainsCopyright?: boolean;

  certificationVersion?: string | null;

  certifiedByUserId?: string | null;
  certifiedAt?: any;
};

/*
 * ---------------------------------------------------------
 * Creator license certification
 * ---------------------------------------------------------
 */

export type CreatorLicenseCertification = {
  status?:
    | "pending_brand_approval"
    | "brand_approved_pending_activation"
    | "active"
    | "expired"
    | "inactive";

  licenseType?:
    | "campaign_window"
    | string;

  licenseDurationDays?: number;

  brandUsageLicenseGranted?: boolean;
  goshshaDistributionLicenseGranted?: boolean;

  postWindowRoyaltyAcknowledged?: boolean;
  futureRoyaltyEarningsAcknowledged?: boolean;

  /*
   * Internal eligibility field.
   * This is not an automatic renewal.
   */
  futurePaidReactivationAllowed?: boolean;

  automaticRenewalAllowed?: boolean;
  renewalRequestAllowed?: boolean;

  startsAt?: any;
  expiresAt?: any;

  qualifiedViewRate?: number | null;
  currency?: string;

  licenseTermsVersion?: string | null;

  acceptedByUserId?: string | null;
  acceptedAt?: any;
};

/*
 * ---------------------------------------------------------
 * Frozen Brand approval snapshot
 * ---------------------------------------------------------
 */

export type BrandApprovalSnapshot = {
  snapshotVersion?: number;

  campaignId?: string | null;
  creatorId?: string | null;
  brandId?: string | null;

  campaignTitle?: string | null;
  productName?: string | null;

  creatorSubmission?: CreatorSubmission;

  rightsCertification?: CreatorRightsCertification;

  licenseCertification?: CreatorLicenseCertification;

  approvedByBrandId?: string | null;
  approvedAt?: any;
};

/*
 * ---------------------------------------------------------
 * Main Campaign type
 * ---------------------------------------------------------
 */

export type Campaign = {
  id: string;

  brandId: string;
  creatorId: string;

  brandName?: string;
  brandEmail?: string;

  creatorHandle?: string;
  creatorEmail?: string;

  contactEmail?: string;

  productName?: string;
  campaignTitle?: string;
  campaignBrief?: string;

  deliveryStartDate?: string;
  deliveryEndDate?: string;

  agreedPrice?: number;
  platformFeeAmount?: number;
  creatorPayoutAmount?: number;

  status?: CampaignStatus;

  fundingStatus?: FundingStatus;

  brandApprovalStatus?: BrandApprovalStatus;

  payoutStatus?: PayoutStatus;

  payoutReleaseStatus?: PayoutReleaseStatus;

  completionStatus?: CompletionStatus;

  /*
   * Creator submission package.
   */
  creatorSubmission?: CreatorSubmission;

  creatorRightsCertification?: CreatorRightsCertification;

  creatorLicenseCertification?: CreatorLicenseCertification;

  /*
   * Frozen package approved by the Brand.
   */
  brandApprovalSnapshot?: BrandApprovalSnapshot;

  /*
   * Legacy Creator submission fields.
   * Retained temporarily for existing campaigns.
   */
  creatorSubmittedArContentUrl?: string | null;
  normalizedArContentUrl?: string | null;

  creatorMediaUrl?: string | null;
  creatorMediaStoragePath?: string | null;
  creatorMediaOriginalName?: string | null;
  creatorMediaContentType?: string | null;
  creatorMediaSizeBytes?: number | null;

  /*
   * Workflow timestamps.
   */
  creatorAcceptedAt?: any;
  fundedAt?: any;
  creatorSubmittedAt?: any;

  brandApprovedAt?: any;
  brandApprovedByUserId?: string | null;

  payoutReadyAt?: any;

  payoutProcessingStartedAt?: any;
  payoutProcessingStartedBy?: string | null;

  payoutReleasedAt?: any;
  payoutReleasedBy?: string | null;

  creatorTransactionCompletedAt?: any;

  completedAt?: any;

  createdAt?: any;
  updatedAt?: any;

  /*
   * Stripe payout information.
   */
  creatorStripeAccountId?: string | null;

  stripeTransferId?: string | null;
  stripeTransferAmount?: number | null;
  stripeTransferAmountCents?: number | null;
  stripeTransferCurrency?: string | null;
  stripeTransferDestination?: string | null;

  payoutLastError?: string | null;
  payoutLastFailedAt?: any;

  /*
   * Retail Media references.
   *
   * Creator approval and payout must not populate
   * or activate these fields.
   */
  retailAssetId?: string | null;
  publishedArEntryId?: string | null;
  arEntryId?: string | null;
  productCollectionId?: string | null;

  retailAssetCreationStatus?: RetailAssetCreationStatus;

  retailMediaStatus?: RetailMediaStatus;

  arStatus?: ArStatus;

  retailAssetCreatedAt?: any;
  retailAssetPublishedAt?: any;

  activationStart?: any;
  activationEnd?: any;

  /*
   * First IRL preview workflow.
   */
  campaignType?: string;

  campaignContentUrl?: string | null;
  arTargetImageUrl?: string | null;
};

/*
 * ---------------------------------------------------------
 * Create campaign
 * ---------------------------------------------------------
 */

export async function createCampaign(params: {
  brandId: string;
  creatorId: string;

  brandName: string;
  creatorHandle: string;
  contactEmail: string;

  productName: string;
  campaignTitle: string;
  campaignBrief: string;

  deliveryStartDate: string;
  deliveryEndDate: string;

  agreedPrice: number;
}) {
  const {
    brandId,
    creatorId,
    brandName,
    creatorHandle,
    contactEmail,
    productName,
    campaignTitle,
    campaignBrief,
    deliveryStartDate,
    deliveryEndDate,
    agreedPrice,
  } = params;

  const platformFeeAmount = 5;

  const creatorPayoutAmount =
    Math.max(
      agreedPrice -
        platformFeeAmount,
      0
    );

  const docRef =
    await addDoc(
      collection(
        db,
        "campaigns"
      ),
      {
        brandId,
        creatorId,

        brandName,
        creatorHandle,
        contactEmail,

        productName,
        campaignTitle,
        campaignBrief,

        deliveryStartDate,
        deliveryEndDate,

        agreedPrice,
        platformFeeAmount,
        creatorPayoutAmount,

        /*
         * Creator collaboration workflow.
         */
        status:
          "invited",

        fundingStatus:
          "not_funded",

        brandApprovalStatus:
          "pending",

        payoutStatus:
          "not_ready",

        payoutReleaseStatus:
          "not_started",

        completionStatus:
          "not_completed",

        /*
         * Creator submission package.
         */
        creatorSubmission: {
          publicPostUrl:
            null,

          originalMediaUrl:
            null,

          originalMediaStoragePath:
            null,

          originalMediaName:
            null,

          mediaType:
            null,

          mediaContentType:
            null,

          mediaSizeBytes:
            null,

          submittedBy:
            null,

          submittedAt:
            null,

          submissionVersion:
            1,
        },

        creatorRightsCertification: {
          status:
            "pending",

          contentRightsConfirmed:
            false,

          audioRightsConfirmed:
            false,

          appearanceRightsConfirmed:
            false,

          creatorRetainsCopyright:
            false,

          certificationVersion:
            "1.0",

          certifiedByUserId:
            null,

          certifiedAt:
            null,
        },

        creatorLicenseCertification: {
          status:
            "pending_brand_approval",

          licenseType:
            "campaign_window",

          licenseDurationDays:
            90,

          brandUsageLicenseGranted:
            false,

          goshshaDistributionLicenseGranted:
            false,

          postWindowRoyaltyAcknowledged:
            false,

          futureRoyaltyEarningsAcknowledged:
            false,

          futurePaidReactivationAllowed:
            false,

          automaticRenewalAllowed:
            false,

          renewalRequestAllowed:
            true,

          /*
           * These dates begin only when Retail Media
           * is activated.
           */
          startsAt:
            null,

          expiresAt:
            null,

          qualifiedViewRate:
            null,

          currency:
            "USD",

          licenseTermsVersion:
            "1.0",

          acceptedByUserId:
            null,

          acceptedAt:
            null,
        },

        brandApprovalSnapshot:
          null,

        /*
         * Legacy Creator submission fields.
         */
        creatorSubmittedArContentUrl:
          null,

        normalizedArContentUrl:
          null,

        creatorMediaUrl:
          null,

        creatorMediaStoragePath:
          null,

        creatorMediaOriginalName:
          null,

        creatorMediaContentType:
          null,

        creatorMediaSizeBytes:
          null,

        /*
         * Retail Media remains completely separate.
         */
        retailAssetId:
          null,

        publishedArEntryId:
          null,

        arEntryId:
          null,

        productCollectionId:
          null,

        retailAssetCreationStatus:
          "not_created",

        retailMediaStatus:
          "not_activated",

        arStatus:
          "not_started",

        retailAssetCreatedAt:
          null,

        retailAssetPublishedAt:
          null,

        activationStart:
          null,

        activationEnd:
          null,

        /*
         * Workflow timestamps.
         */
        creatorAcceptedAt:
          null,

        fundedAt:
          null,

        creatorSubmittedAt:
          null,

        brandApprovedAt:
          null,

        brandApprovedByUserId:
          null,

        payoutReadyAt:
          null,

        payoutProcessingStartedAt:
          null,

        payoutProcessingStartedBy:
          null,

        payoutReleasedAt:
          null,

        payoutReleasedBy:
          null,

        creatorTransactionCompletedAt:
          null,

        completedAt:
          null,

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),
      }
    );

  await createNotification({
    userId:
      creatorId,

    role:
      "creator",

    type:
      "campaign_invited",

    title:
      "New campaign invite",

    message:
      `${brandName} invited you to "${campaignTitle}".`,

    campaignId:
      docRef.id,
  });

  return docRef.id;
}

/*
 * ---------------------------------------------------------
 * Creator directory
 * ---------------------------------------------------------
 */

export async function getMarketplaceCreators() {
  const creatorsQuery =
    query(
      collection(
        db,
        "creators"
      ),

      where(
        "isMarketplaceVisible",
        "==",
        true
      )
    );

  const snapshot =
    await getDocs(
      creatorsQuery
    );

  return snapshot.docs.map(
    (docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })
  );
}

export async function getCreatorById(
  creatorId: string
) {
  const ref =
    doc(
      db,
      "creators",
      creatorId
    );

  const snap =
    await getDoc(ref);

  if (!snap.exists()) {
    return null;
  }

  return {
    id: snap.id,
    ...snap.data(),
  };
}

/*
 * ---------------------------------------------------------
 * Campaign reads
 * ---------------------------------------------------------
 */

export async function getCampaignById(
  campaignId: string
) {
  const ref =
    doc(
      db,
      "campaigns",
      campaignId
    );

  const snap =
    await getDoc(ref);

  if (!snap.exists()) {
    return null;
  }

  return {
    id: snap.id,
    ...snap.data(),
  } as Campaign;
}

export async function getCreatorCampaigns(
  creatorId: string
) {
  const campaignsQuery =
    query(
      collection(
        db,
        "campaigns"
      ),

      where(
        "creatorId",
        "==",
        creatorId
      )
    );

  const snapshot =
    await getDocs(
      campaignsQuery
    );

  return snapshot.docs.map(
    (docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })
  ) as Campaign[];
}

export async function getBrandCampaigns(
  brandId: string
) {
  const campaignsQuery =
    query(
      collection(
        db,
        "campaigns"
      ),

      where(
        "brandId",
        "==",
        brandId
      )
    );

  const snapshot =
    await getDocs(
      campaignsQuery
    );

  return snapshot.docs.map(
    (docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })
  ) as Campaign[];
}

/*
 * ---------------------------------------------------------
 * Admin review queues
 * ---------------------------------------------------------
 */

export async function getSubmittedCampaigns() {
  const campaignsQuery =
    query(
      collection(
        db,
        "campaigns"
      ),

      where(
        "status",
        "==",
        "submitted"
      )
    );

  const snapshot =
    await getDocs(
      campaignsQuery
    );

  return snapshot.docs.map(
    (docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })
  ) as Campaign[];
}

export async function getApprovedCampaignsReadyForPayout() {
  const campaignsQuery =
    query(
      collection(
        db,
        "campaigns"
      ),

      where(
        "brandApprovalStatus",
        "==",
        "approved"
      ),

      where(
        "payoutStatus",
        "==",
        "ready_to_release"
      )
    );

  const snapshot =
    await getDocs(
      campaignsQuery
    );

  return snapshot.docs.map(
    (docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })
  ) as Campaign[];
}

/*
 * ---------------------------------------------------------
 * Safe client-side campaign transitions
 * ---------------------------------------------------------
 *
 * Sensitive transitions are not permitted here:
 *
 * - Creator submission approval
 * - Creator payout release
 * - Retail Media activation
 *
 * Those transitions require authenticated server routes.
 */

export async function updateCampaignStatus(params: {
  campaignId: string;
  status: CampaignStatus;
}) {
  const {
    campaignId,
    status,
  } = params;

  if (
    status === "approved"
  ) {
    throw new Error(
      "Campaign approval must use the authenticated approve-campaign-submission API."
    );
  }

  if (
    status === "completed"
  ) {
    throw new Error(
      "Campaign completion and payout release must use the authenticated release-campaign-payout API."
    );
  }

  const ref =
    doc(
      db,
      "campaigns",
      campaignId
    );

  const snap =
    await getDoc(ref);

  if (!snap.exists()) {
    throw new Error(
      "Campaign not found."
    );
  }

  const campaign =
    snap.data() as Campaign;

  const updateData: Record<
    string,
    any
  > = {
    status,
    updatedAt:
      serverTimestamp(),
  };

  if (
    status === "accepted"
  ) {
    updateData.creatorAcceptedAt =
      serverTimestamp();
  }

  if (
    status === "funded"
  ) {
    updateData.fundedAt =
      serverTimestamp();

    updateData.fundingStatus =
      "funded";
  }

  if (
    status === "submitted"
  ) {
    /*
     * This status should normally be set by the
     * authenticated submission API after validating
     * the complete Creator deliverable package.
     */
    updateData.creatorSubmittedAt =
      serverTimestamp();

    updateData.brandApprovalStatus =
      "pending";

    updateData.payoutStatus =
      "not_ready";
  }

  if (
    status === "rejected"
  ) {
    updateData.brandApprovalStatus =
      "rejected";
  }

  await updateDoc(
    ref,
    updateData
  );

  if (
    status === "accepted"
  ) {
    await createNotification({
      userId:
        campaign.brandId,

      role:
        "brand",

      type:
        "campaign_accepted",

      title:
        "Campaign accepted",

      message:
        `${campaign.creatorHandle || "A Creator"} accepted "${campaign.campaignTitle || "your campaign"}".`,

      campaignId,
    });
  }

  if (
    status === "rejected"
  ) {
    await createNotification({
      userId:
        campaign.brandId,

      role:
        "brand",

      type:
        "campaign_rejected",

      title:
        "Campaign rejected",

      message:
        `${campaign.creatorHandle || "A Creator"} rejected "${campaign.campaignTitle || "your campaign"}".`,

      campaignId,
    });
  }
}

/*
 * ---------------------------------------------------------
 * Funding
 * ---------------------------------------------------------
 */

export async function fundCampaign(
  campaignId: string
) {
  const ref =
    doc(
      db,
      "campaigns",
      campaignId
    );

  const snap =
    await getDoc(ref);

  if (!snap.exists()) {
    throw new Error(
      "Campaign not found."
    );
  }

  const campaign =
    snap.data() as Campaign;

  await updateDoc(
    ref,
    {
      status:
        "funded",

      fundingStatus:
        "funded",

      fundedAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    }
  );

  await createNotification({
    userId:
      campaign.creatorId,

    role:
      "creator",

    type:
      "campaign_funded",

    title:
      "Campaign funded",

    message:
      `${campaign.brandName || "The Brand"} funded "${campaign.campaignTitle || "your campaign"}". You can begin creating the deliverable.`,

    campaignId,
  });

  await createNotification({
    userId:
      "admin",

    role:
      "admin",

    type:
      "campaign_funded_admin",

    title:
      "Campaign funded",

    message:
      `"${campaign.campaignTitle || "A campaign"}" has been funded and is ready for Creator production.`,

    campaignId,
  });
}

/*
 * ---------------------------------------------------------
 * Deprecated sensitive client-side mutations
 * ---------------------------------------------------------
 *
 * These functions remain exported temporarily so older
 * imports fail with a clear message instead of producing
 * silent or insecure Firestore writes.
 */

export async function submitCampaignLink(
  _params: {
    campaignId: string;
    arContentUrl: string;
  }
): Promise<never> {
  throw new Error(
    "submitCampaignLink is deprecated. Submit the complete Creator deliverable package through /api/submit-campaign-link."
  );
}

export async function approveCampaignSubmission(
  _campaignId: string
): Promise<never> {
  throw new Error(
    "approveCampaignSubmission cannot write directly to Firestore. Use /api/approve-campaign-submission."
  );
}

export async function releaseCampaignPayout(
  _campaignId: string
): Promise<never> {
  throw new Error(
    "releaseCampaignPayout cannot write directly to Firestore. Use /api/release-campaign-payout."
  );
}

/*
 * ---------------------------------------------------------
 * Notifications
 * ---------------------------------------------------------
 */

export async function getUserNotifications(
  userId: string
) {
  const notificationsQuery =
    query(
      collection(
        db,
        "notifications"
      ),

      where(
        "userId",
        "==",
        userId
      )
    );

  const snapshot =
    await getDocs(
      notificationsQuery
    );

  const items =
    snapshot.docs.map(
      (docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })
    );

  return items.sort(
    (
      first: any,
      second: any
    ) => {
      const firstTime =
        first.createdAt?.seconds ||
        0;

      const secondTime =
        second.createdAt?.seconds ||
        0;

      return (
        secondTime -
        firstTime
      );
    }
  );
}

export {
  markNotificationRead,
};