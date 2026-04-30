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

    const creatorProfileUrl = `${appUrl}/creator/profile`;
    const loginUrl = `${appUrl}/login`;

    const campaignRef = adminDb.collection("campaigns").doc(campaignId);
    const campaignSnap = await campaignRef.get();

    if (!campaignSnap.exists) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const campaign = campaignSnap.data() as any;

    await campaignRef.update({
      status: "completed",
      payoutStatus: "released",
      payoutReleaseStatus: "released",
      payoutReleasedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await adminDb.collection("notifications").add({
      userId: campaign.creatorId,
      role: "creator",
      type: "payout_released",
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
      message: `"${campaign.campaignTitle}" is now completed.`,
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
    const creatorEmail =
      creator?.contactEmail || creator?.email || campaign.creatorEmail;

    if (creatorEmail) {
      await sendEmail({
        to: creatorEmail,
        subject: "Payout released",
        htmlBody: `
          <h2>Payout released</h2>
          <p>Your payout for <strong>${campaign.campaignTitle || "your campaign"}</strong> has been released.</p>
          <p><strong>Important:</strong> To receive payment, please make sure your Stripe Payment Account is set up in your Creator Profile.</p>
          <p><a href="${creatorProfileUrl}">Set up Stripe Payment Account</a></p>
          <p>You can also log in here:</p>
          <p><a href="${loginUrl}">Log in to Goshsha Marketplace</a></p>
        `,
        textBody: `
Payout released.

Your payout for ${campaign.campaignTitle || "your campaign"} has been released.

Important: To receive payment, please make sure your Stripe Payment Account is set up in your Creator Profile.

Set up Stripe Payment Account:
${creatorProfileUrl}

Log in:
${loginUrl}
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