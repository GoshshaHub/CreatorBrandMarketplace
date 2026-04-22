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
      payoutReleaseStatus: "released",
      payoutReleasedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await createNotification({
      userId: campaign.creatorId,
      role: "creator",
      type: "payment_released",
      title: "Payment released",
      message: `Payment for "${campaign.campaignTitle}" has been released.`,
      campaignId,
    });

    const creatorRef = doc(db, "creators", campaign.creatorId);
    const creatorSnap = await getDoc(creatorRef);
    const creator = creatorSnap.exists() ? creatorSnap.data() : null;
    const creatorEmail = creator?.contactEmail || creator?.email;

    if (creatorEmail) {
      await sendEmail({
        to: creatorEmail,
        subject: `💸 Your payment has been released`,
        htmlBody: `
          <h2>Your payment has been released</h2>
          <p><strong>${campaign.campaignTitle}</strong></p>
          <p><strong>Amount:</strong> $${campaign.agreedPrice || 0}</p>
        `,
        textBody: `
Your payment has been released.

Campaign: ${campaign.campaignTitle}
Amount: $${campaign.agreedPrice || 0}
        `.trim(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Release campaign payment error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to release payment" },
      { status: 500 }
    );
  }
}