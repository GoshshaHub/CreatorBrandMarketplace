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
      status: "funded",
      fundingStatus: "funded",
      fundedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await adminDb.collection("notifications").add({
      userId: campaign.creatorId,
      role: "creator",
      type: "campaign_funded",
      title: "Campaign funded",
      message: `${campaign.brandName} funded "${campaign.campaignTitle}". You can start now.`,
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
      creator?.contactEmail || creator?.email || campaign.contactEmail;

    if (creatorEmail) {
      await sendEmail({
        to: creatorEmail,
        subject: "Your campaign is funded",
        htmlBody: `
          <h2>Your campaign is funded</h2>
          <p><strong>${campaign.brandName}</strong> funded your campaign.</p>
          <p><strong>Campaign:</strong> ${campaign.campaignTitle}</p>
          <p><strong>Product:</strong> ${campaign.productName}</p>
          <p>You can now log in and submit your content when ready.</p>
        `,
        textBody: `
Your campaign is funded

Brand: ${campaign.brandName}
Campaign: ${campaign.campaignTitle}
Product: ${campaign.productName}

You can now log in and submit your content when ready.
        `.trim(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Fund campaign error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fund campaign" },
      { status: 500 }
    );
  }
}