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
    completedAt: null,

    creatorSubmittedArContentUrl: null,
    normalizedArContentUrl: null,
    creatorSubmittedAt: null,

    matchedEntryId: null,
    validatedCreatorIdFromEntryId: null,
    matchedCollection: null,
    matchedArPlaylistIndex: null,
    validationStatus: "pending",
    validationFailureReason: null,

    currentViews: 0,
    lastMetricsSyncAt: null,

    creatorAcceptedAt: null,

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
  };
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
  }));
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
  }));
}

export async function updateCampaignStatus(params: {
  campaignId: string;
  status: string;
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

  await updateDoc(ref, {
    creatorSubmittedArContentUrl: arContentUrl,
    normalizedArContentUrl: arContentUrl.trim(),
    status: "submitted",
    completionStatus: "submitted",
    creatorSubmittedAt: serverTimestamp(),
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

export async function getSubmittedCampaigns() {
  const q = query(
    collection(db, "campaigns"),
    where("status", "==", "submitted")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
}

export async function markCampaignLive(campaignId: string) {
  const ref = doc(db, "campaigns", campaignId);

  await updateDoc(ref, {
    status: "live",
    completionStatus: "live",
    goshshaReviewStatus: "approved",
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
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