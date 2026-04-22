import { NextResponse } from "next/server";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { createNotification } from "../../../lib/notifications";
import { sendEmail } from "../../../lib/postmark";

export async function POST(req: Request) {
  try {
    const { campaignId } = await req.json();

    if (!campaignId) {
      return NextResponse.json(
        { error: "Missing campaignId" },
        { status: 400 }
      );
    }

    const campaignRef = doc(db, "campaigns", campaignId);
    const campaignSnap = await getDoc(campaignRef);

    if (!campaignSnap.exists()) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const campaign = campaignSnap.data() as any;

    await updateDoc(campaignRef, {
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

    const creatorRef = doc(db, "creators", campaign.creatorId);
    const creatorSnap = await getDoc(creatorRef);
    const creator = creatorSnap.exists() ? creatorSnap.data() : null;
    const creatorEmail = creator?.contactEmail || creator?.email;

    if (creatorEmail) {
      await sendEmail({
        to: creatorEmail,
        subject: `💰 Your campaign is funded`,
        htmlBody: `
          <h2>Your campaign is funded</h2>
          <p><strong>${campaign.brandName}</strong> funded your campaign.</p>
          <p><strong>Campaign:</strong> ${campaign.campaignTitle}</p>
          <p><strong>Product:</strong> ${campaign.productName}</p>
          <p>You can now log in and submit your content when ready.</p>
        `,
        textBody: `
Your campaign is funded.

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