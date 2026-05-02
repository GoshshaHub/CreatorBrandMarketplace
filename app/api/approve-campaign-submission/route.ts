import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../lib/firebase-admin";
import { sendEmail } from "../../../lib/postmark";

export async function POST(req: Request) {
  try {
    const { campaignId } = await req.json();

    if (!campaignId || typeof campaignId !== "string") {
      return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://creator-brand-marketplace-rho.vercel.app";

    const creatorCampaignUrl = `${appUrl}/creator/campaign/${campaignId}`;
    const adminReviewUrl = `${appUrl}/admin/review`;

    const campaignRef = adminDb.collection("campaigns").doc(campaignId);
    const campaignSnap = await campaignRef.get();

    if (!campaignSnap.exists) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const campaign = campaignSnap.data() as any;

    await campaignRef.update({
      status: "approved",
      brandApprovalStatus: "approved",
      payoutStatus: "ready_to_release",
      brandApprovedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await adminDb.collection("notifications").add({
      userId: campaign.creatorId,
      role: "creator",
      type: "campaign_approved_creator",
      title: "Submission approved",
      message: `Your submission for "${campaign.campaignTitle}" was approved. Payout is pending release.`,
      campaignId,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await adminDb.collection("notifications").add({
      userId: "admin",
      role: "admin",
      type: "campaign_approved_admin",
      title: "Brand approved submission",
      message: `"${campaign.campaignTitle}" was approved by the brand and is ready for payout release.`,
      campaignId,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const creatorSnap = await adminDb.collection("users").doc(campaign.creatorId).get();
    const creator = creatorSnap.exists ? creatorSnap.data() : null;
    const creatorEmail =
      creator?.contactEmail || creator?.email || campaign.creatorEmail;

    if (creatorEmail) {
      await sendEmail({
        to: creatorEmail,
        subject: `Submission approved: ${campaign.campaignTitle || "Campaign"}`,
        htmlBody: `
          <h2>Submission approved</h2>
          <p>Your submission for <strong>${campaign.campaignTitle || "your campaign"}</strong> was approved.</p>
          <p>Payout is now pending admin release.</p>
          <p><a href="${creatorCampaignUrl}">View campaign</a></p>
        `,
        textBody: `
Submission approved.

Campaign: ${campaign.campaignTitle || ""}

Payout is now pending admin release.

View campaign:
${creatorCampaignUrl}
        `.trim(),
      });
    }

    return NextResponse.json({ ok: true, adminReviewUrl });
  } catch (err: any) {
    console.error("Approve campaign submission error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to approve campaign submission" },
      { status: 500 }
    );
  }
}