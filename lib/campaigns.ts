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
  | "approved"
  | "completed";

export type FundingStatus = "not_funded" | "funded";
export type BrandApprovalStatus = "pending" | "approved" | "rejected";
export type PayoutStatus = "not_ready" | "ready_to_release" | "released";

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
  creatorPayoutAmount?: number;

  creatorAcceptedAt?: any;
  fundedAt?: any;
  completedAt?: any;

  createdAt?: any;
  updatedAt?: any;

  status?: string;

  fundingStatus?: string;

  completionStatus?: string;

  brandApprovalStatus?: "pending" | "approved" | "rejected";

  payoutStatus?: "locked" | "releasable" | "released";

  creatorSubmittedArContentUrl?: string;

  normalizedArContentUrl?: string;

  creatorSubmittedAt?: any;

  brandApprovedAt?: any;

  payoutReleasedAt?: any;
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

  const platformFeeAmount = 5;
  const creatorPayoutAmount = Math.max(agreedPrice - platformFeeAmount, 0);

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
    platformFeeAmount,
    creatorPayoutAmount,

    status: "invited",
    fundingStatus: "not_funded",
    brandApprovalStatus: "pending",
    payoutStatus: "not_ready",

    creatorSubmittedArContentUrl: null,
    normalizedArContentUrl: null,

    creatorAcceptedAt: null,
    fundedAt: null,
    creatorSubmittedAt: null,
    brandApprovedAt: null,
    payoutReleasedAt: null,
    completedAt: null,

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

export async function getApprovedCampaignsReadyForPayout() {
  const q = query(
    collection(db, "campaigns"),
    where("brandApprovalStatus", "==", "approved"),
    where("payoutStatus", "==", "ready_to_release")
  );

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

  if (status === "funded") {
    updateData.fundedAt = serverTimestamp();
    updateData.fundingStatus = "funded";
  }

  if (status === "submitted") {
    updateData.creatorSubmittedAt = serverTimestamp();
  }

  if (status === "approved") {
    updateData.brandApprovedAt = serverTimestamp();
    updateData.brandApprovalStatus = "approved";
    updateData.payoutStatus = "ready_to_release";
  }

  if (status === "completed") {
    updateData.payoutReleasedAt = serverTimestamp();
    updateData.completedAt = serverTimestamp();
    updateData.payoutStatus = "released";
  }

  if (status === "rejected") {
    updateData.brandApprovalStatus = "rejected";
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
}

export async function fundCampaign(campaignId: string) {
  const ref = doc(db, "campaigns", campaignId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Campaign not found.");
  }

  const campaign = snap.data() as any;

  await updateDoc(ref, {
    status: "funded",
    fundingStatus: "funded",
    fundedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await createNotification({
    userId: campaign.creatorId,
    role: "creator",
    type: "campaign_funded",
    title: "Campaign funded",
    message: `${campaign.brandName} funded "${campaign.campaignTitle}". You can start now.`,
    campaignId,
  });

  await createNotification({
    userId: "admin",
    role: "admin",
    type: "campaign_funded_admin",
    title: "Campaign funded",
    message: `"${campaign.campaignTitle}" has been funded and is now active.`,
    campaignId,
  });
}

export async function submitCampaignLink(params: {
  campaignId: string;
  arContentUrl: string;
}) {
  const { campaignId, arContentUrl } = params;

  const ref = doc(db, "campaigns", campaignId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Campaign not found.");
  }

  const campaign = snap.data() as any;
  const normalizedUrl = arContentUrl.trim();

  await updateDoc(ref, {
    status: "submitted",
    creatorSubmittedArContentUrl: arContentUrl,
    normalizedArContentUrl: normalizedUrl,
    creatorSubmittedAt: serverTimestamp(),
    brandApprovalStatus: "pending",
    payoutStatus: "not_ready",
    updatedAt: serverTimestamp(),
  });

  await createNotification({
    userId: campaign.brandId,
    role: "brand",
    type: "campaign_submitted",
    title: "Campaign submitted",
    message: `${campaign.creatorHandle || "A creator"} submitted the campaign link for "${campaign.campaignTitle}".`,
    campaignId,
  });

  await createNotification({
    userId: "admin",
    role: "admin",
    type: "campaign_submitted_admin",
    title: "Campaign ready for review",
    message: `${campaign.creatorHandle || "A creator"} submitted "${campaign.campaignTitle}" for review.`,
    campaignId,
  });
}

export async function approveCampaignSubmission(campaignId: string) {
  const ref = doc(db, "campaigns", campaignId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Campaign not found.");
  }

  const campaign = snap.data() as any;

  await updateDoc(ref, {
    status: "approved",
    brandApprovalStatus: "approved",
    brandApprovedAt: serverTimestamp(),
    payoutStatus: "ready_to_release",
    updatedAt: serverTimestamp(),
  });

  await createNotification({
    userId: "admin",
    role: "admin",
    type: "campaign_approved_admin",
    title: "Brand approved submission",
    message: `"${campaign.campaignTitle}" was approved by the brand and is ready for payout release.`,
    campaignId,
  });

  await createNotification({
    userId: campaign.creatorId,
    role: "creator",
    type: "campaign_approved_creator",
    title: "Submission approved",
    message: `Your submission for "${campaign.campaignTitle}" was approved. Payout is pending release.`,
    campaignId,
  });
}

export async function releaseCampaignPayout(campaignId: string) {
  const ref = doc(db, "campaigns", campaignId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Campaign not found.");
  }

  const campaign = snap.data() as any;

  await updateDoc(ref, {
    status: "completed",
    payoutStatus: "released",
    payoutReleasedAt: serverTimestamp(),
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await createNotification({
    userId: campaign.creatorId,
    role: "creator",
    type: "campaign_paid_out",
    title: "Payout released",
    message: `Your payout for "${campaign.campaignTitle}" has been released.`,
    campaignId,
  });

  await createNotification({
    userId: campaign.brandId,
    role: "brand",
    type: "campaign_completed",
    title: "Campaign completed",
    message: `"${campaign.campaignTitle}" has been completed and payout was released.`,
    campaignId,
  });
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