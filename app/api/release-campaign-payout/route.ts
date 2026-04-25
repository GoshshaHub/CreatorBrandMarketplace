import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../lib/firebase-admin";
import { sendEmail } from "../../../lib/postmark";

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
      status: "completed",
      payoutStatus: "released",
      payoutReleasedAt: FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await adminDb.collection("notifications").add({
      userId: campaign.creatorId,
      role: "creator",
      type: "campaign_paid_out",
      title: "Payout released",
      message: `Your payout for "${campaign.campaignTitle}" has been released.`,
      campaignId,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await adminDb.collection("notifications").add({
      userId: campaign.brandId,
      role: "brand",
      type: "campaign_completed",
      title: "Campaign completed",
      message: `"${campaign.campaignTitle}" has been completed and creator payout was released.`,
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
        subject: `Your Goshsha payout has been released`,
        htmlBody: `
          <h2>Your payout has been released</h2>
          <p>Your payout for <strong>${campaign.campaignTitle}</strong> has been released.</p>
          <p><strong>Campaign:</strong> ${campaign.campaignTitle}</p>
          <p><strong>Brand:</strong> ${campaign.brandName}</p>
          <p><strong>Agreed Price:</strong> $${campaign.agreedPrice || 0}</p>
          <p><strong>Goshsha Fee:</strong> $${campaign.platformFeeAmount || 5}</p>
          <p><strong>Your Payout:</strong> $${campaign.creatorPayoutAmount || Math.max((campaign.agreedPrice || 0) - 5, 0)}</p>
        `,
        textBody: `
Your payout has been released.

Campaign: ${campaign.campaignTitle}
Brand: ${campaign.brandName}
Agreed Price: $${campaign.agreedPrice || 0}
Goshsha Fee: $${campaign.platformFeeAmount || 5}
Your Payout: $${campaign.creatorPayoutAmount || Math.max((campaign.agreedPrice || 0) - 5, 0)}
        `.trim(),
      });
    }

    const brandSnap = await adminDb
      .collection("brands")
      .doc(campaign.brandId)
      .get();

    const brand = brandSnap.exists ? brandSnap.data() : null;
    const brandEmail = brand?.contactEmail || brand?.email || campaign.contactEmail;

    if (brandEmail) {
      await sendEmail({
        to: brandEmail,
        subject: `Campaign completed: ${campaign.campaignTitle}`,
        htmlBody: `
          <h2>Campaign completed</h2>
          <p><strong>${campaign.campaignTitle}</strong> has been completed.</p>
          <p>The creator payout has been released by Goshsha admin.</p>
          <p><strong>Creator:</strong> ${campaign.creatorHandle || campaign.creatorId}</p>
          <p><strong>Product:</strong> ${campaign.productName}</p>
        `,
        textBody: `
Campaign completed.

Campaign: ${campaign.campaignTitle}
Creator: ${campaign.creatorHandle || campaign.creatorId}
Product: ${campaign.productName}

The creator payout has been released by Goshsha admin.
        `.trim(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Release campaign payout error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to release campaign payout" },
      { status: 500 }
    );
  }
}