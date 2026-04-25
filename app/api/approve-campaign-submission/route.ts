import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../lib/firebase-admin";
import { sendEmail } from "../../../lib/postmark";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "athena@goshsha.com";

export async function POST(req: Request) {
  try {
    const { campaignId } = await req.json();

    if (!campaignId || typeof campaignId !== "string") {
      return NextResponse.json(
        { error: "Missing campaignId" },
        { status: 400 }
      );
    }

    const campaignRef = adminDb.collection("campaigns").doc(campaignId);
    const campaignSnap = await campaignRef.get();

    if (!campaignSnap.exists) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const campaign = campaignSnap.data() as any;

    await campaignRef.update({
      status: "approved",
      brandApprovalStatus: "approved",
      brandApprovedAt: FieldValue.serverTimestamp(),
      payoutStatus: "ready_to_release",
      updatedAt: FieldValue.serverTimestamp(),
    });

    await adminDb.collection("notifications").add({
      userId: "admin",
      role: "admin",
      type: "campaign_approved_admin",
      title: "Brand approved submission",
      message: `"${campaign.campaignTitle}" was approved by the brand and is ready for payout release.`,
      campaignId,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await adminDb.collection("notifications").add({
      userId: campaign.creatorId,
      role: "creator",
      type: "campaign_approved_creator",
      title: "Submission approved",
      message: `Your submission for "${campaign.campaignTitle}" was approved. Payout is pending release.`,
      campaignId,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const creatorSnap = await adminDb
      .collection("creators")
      .doc(campaign.creatorId)
      .get();

    const creator = creatorSnap.exists ? creatorSnap.data() : null;
    const creatorEmail = creator?.contactEmail || creator?.email;

    if (creatorEmail) {
      await sendEmail({
        to: creatorEmail,
        subject: `Your submission was approved`,
        htmlBody: `
          <h2>Your submission was approved</h2>
          <p>The brand approved your submission for:</p>
          <p><strong>${campaign.campaignTitle}</strong></p>
          <p>Your payout is now pending release by Goshsha admin.</p>
        `,
        textBody: `
Your submission was approved.

Campaign: ${campaign.campaignTitle}

Your payout is now pending release by Goshsha admin.
        `.trim(),
      });
    }

    if (ADMIN_EMAIL) {
      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `Ready to release payout: ${campaign.campaignTitle}`,
        htmlBody: `
          <h2>Ready to release payout</h2>
          <p>The brand approved the creator submission.</p>
          <p><strong>Brand:</strong> ${campaign.brandName}</p>
          <p><strong>Creator:</strong> ${campaign.creatorHandle || campaign.creatorId}</p>
          <p><strong>Campaign:</strong> ${campaign.campaignTitle}</p>
          <p><strong>Agreed Price:</strong> $${campaign.agreedPrice || 0}</p>
          <p><strong>Goshsha Fee:</strong> $${campaign.platformFeeAmount || 5}</p>
          <p><strong>Creator Payout:</strong> $${campaign.creatorPayoutAmount || Math.max((campaign.agreedPrice || 0) - 5, 0)}</p>
          <p>Next step: release payout from the admin dashboard.</p>
        `,
        textBody: `
Ready to release payout.

Brand: ${campaign.brandName}
Creator: ${campaign.creatorHandle || campaign.creatorId}
Campaign: ${campaign.campaignTitle}
Agreed Price: $${campaign.agreedPrice || 0}
Goshsha Fee: $${campaign.platformFeeAmount || 5}
Creator Payout: $${campaign.creatorPayoutAmount || Math.max((campaign.agreedPrice || 0) - 5, 0)}

Next step: release payout from the admin dashboard.
        `.trim(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Approve campaign submission error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to approve campaign submission" },
      { status: 500 }
    );
  }
}