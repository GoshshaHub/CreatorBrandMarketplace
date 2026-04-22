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
      status: "live",
      completionStatus: "live",
      goshshaReviewStatus: "approved",
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

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

    const creatorRef = doc(db, "creators", campaign.creatorId);
    const creatorSnap = await getDoc(creatorRef);
    const creator = creatorSnap.exists() ? creatorSnap.data() : null;
    const creatorEmail = creator?.contactEmail || creator?.email;

    if (creatorEmail) {
      await sendEmail({
        to: creatorEmail,
        subject: `🚀 Your campaign is live`,
        htmlBody: `
          <h2>Your campaign is live</h2>
          <p><strong>${campaign.campaignTitle}</strong> has been approved and is now live.</p>
          <p>We’ll continue tracking campaign performance.</p>
        `,
        textBody: `
Your campaign is live.

Campaign: ${campaign.campaignTitle}

We’ll continue tracking campaign performance.
        `.trim(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Mark campaign live error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to mark campaign live" },
      { status: 500 }
    );
  }
}