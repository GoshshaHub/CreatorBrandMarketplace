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
import { createNotification, markNotificationRead } from "./notifications";

export type CampaignStatus =
  | "invited"
  | "accepted"
  | "rejected"
  | "funded"
  | "submitted"
  | "live";

export type FundingStatus = "not_funded" | "funded";
export type CompletionStatus = "not_submitted" | "submitted" | "live";
export type ReviewStatus = "pending" | "approved" | "rejected";
export type PayoutReleaseStatus = "locked" | "released";

export type Campaign = {
  id: string;
  brandId: string;
  creatorId: string;
  brandName?: string;
  creatorHandle?: string;
  contactEmail?: string;
  productName?: string;
  campaignTitle?: string;
  campaignBrief?: string;
  deliveryStartDate?: string;
  deliveryEndDate?: string;
  agreedPrice?: number;
  platformFeeAmount?: number;
  status?: CampaignStatus;
  fundingStatus?: FundingStatus;
  completionStatus?: CompletionStatus;
  goshshaReviewStatus?: ReviewStatus;
  payoutReleaseStatus?: PayoutReleaseStatus;
  payoutThresholdViews?: number;
  payoutReleasedAt?: any;
  fundedAt?: any;
  creatorSubmittedArContentUrl?: string | null;
  normalizedArContentUrl?: string | null;
  creatorSubmittedAt?: any;
  matchedEntryId?: string | null;
  currentViews?: number;
  totalViews?: number;
  lastMetricsSyncAt?: any;
  createdAt?: any;
  updatedAt?: any;
};

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

  const docRef = await addDoc(collection(db, "campaigns"), {
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
    platformFeeAmount: 4.99,

    status: "invited",
    fundingStatus: "not_funded",
    fundedAt: null,

    completionStatus: "not_submitted",
    goshshaReviewStatus: "pending",

    payoutReleaseStatus: "locked",
    payoutThresholdViews: 1000,
    payoutReleasedAt: null,

    creatorSubmittedArContentUrl: null,
    normalizedArContentUrl: null,
    creatorSubmittedAt: null,

    matchedEntryId: null,

    currentViews: 0,
    totalViews: 0,
    lastMetricsSyncAt: null,

    creatorAcceptedAt: null,
    completedAt: null,

    adminNotifiedSubmittedAt: null,
    brandNotifiedLiveAt: null,
    creatorNotifiedLiveAt: null,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await createNotification({
    userId: creatorId,
    role: "creator",
    type: "campaign_invited",
    title: "New campaign invite",
    message: `${brandName} invited you to "${campaignTitle}".`,
    campaignId: docRef.id,
  });

  return docRef;
}

export async function getMarketplaceCreators() {
  const q = query(
    collection(db, "creators"),
    where("isMarketplaceVisible", "==", true)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
}

export async function getCreatorById(creatorId: string) {
  const ref = doc(db, "creators", creatorId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  return {
    id: snap.id,
    ...snap.data(),
  };
}

export async function getCampaignById(campaignId: string) {
  const ref = doc(db, "campaigns", campaignId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  return {
    id: snap.id,
    ...snap.data(),
  } as Campaign;
}

export async function getCreatorCampaigns(creatorId: string) {
  const q = query(
    collection(db, "campaigns"),
    where("creatorId", "==", creatorId)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as Campaign[];
}

export async function getBrandCampaigns(brandId: string) {
  const q = query(
    collection(db, "campaigns"),
    where("brandId", "==", brandId)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as Campaign[];
}

export async function getSubmittedCampaigns() {
  const q = query(
    collection(db, "campaigns"),
    where("status", "==", "submitted")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as Campaign[];
}

export async function getLiveCampaigns() {
  const q = query(collection(db, "campaigns"), where("status", "==", "live"));

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as Campaign[];
}

export async function updateCampaignStatus(params: {
  campaignId: string;
  status: CampaignStatus;
}) {
  const { campaignId, status } = params;

  const ref = doc(db, "campaigns", campaignId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Campaign not found.");
  }

  const campaign = snap.data() as any;

  const updateData: Record<string, any> = {
    status,
    updatedAt: serverTimestamp(),
  };

  if (status === "accepted") {
    updateData.creatorAcceptedAt = serverTimestamp();
  }

  if (status === "submitted") {
    updateData.creatorSubmittedAt = serverTimestamp();
    updateData.completionStatus = "submitted";
  }

  if (status === "live") {
    updateData.completionStatus = "live";
    updateData.completedAt = serverTimestamp();
    updateData.goshshaReviewStatus = "approved";
  }

  if (status === "rejected") {
    updateData.goshshaReviewStatus = "rejected";
  }

  await updateDoc(ref, updateData);

  if (status === "accepted") {
    await createNotification({
      userId: campaign.brandId,
      role: "brand",
      type: "campaign_accepted",
      title: "Campaign accepted",
      message: `${campaign.creatorHandle || "A creator"} accepted "${campaign.campaignTitle}".`,
      campaignId,
    });
  }

  if (status === "rejected") {
    await createNotification({
      userId: campaign.brandId,
      role: "brand",
      type: "campaign_rejected",
      title: "Campaign rejected",
      message: `${campaign.creatorHandle || "A creator"} rejected "${campaign.campaignTitle}".`,
      campaignId,
    });
  }

  if (status === "live") {
    await createNotification({
      userId: campaign.brandId,
      role: "brand",
      type: "campaign_live",
      title: "Campaign live",
      message: `"${campaign.campaignTitle}" is now live.`,
      campaignId,
    });

    await createNotification({
      userId: campaign.creatorId,
      role: "creator",
      type: "campaign_live",
      title: "Campaign live",
      message: `"${campaign.campaignTitle}" is now live.`,
      campaignId,
    });
  }
}

export async function getUserNotifications(userId: string) {
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId)
  );

  const snapshot = await getDocs(q);

  const items = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));

  return items.sort((a: any, b: any) => {
    const aTime = a.createdAt?.seconds || 0;
    const bTime = b.createdAt?.seconds || 0;
    return bTime - aTime;
  });
}

export { markNotificationRead };