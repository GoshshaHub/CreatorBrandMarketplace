import { NextResponse } from "next/server";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { createNotification } from "../../../lib/notifications";
import { sendEmail } from "../../../lib/postmark";

export async function POST(req: Request) {
  try {
    const { campaignId, views } = await req.json();

    if (!campaignId || typeof views !== "number") {
      return NextResponse.json(
        { error: "Missing campaignId or invalid views" },
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
    const threshold = campaign.payoutThresholdViews || 1000;

    const updateData: Record<string, any> = {
      currentViews: views,
      totalViews: views,
      lastMetricsSyncAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    let released = false;

    if (views >= threshold && campaign.payoutReleaseStatus !== "released") {
      updateData.payoutReleaseStatus = "released";
      updateData.payoutReleasedAt = serverTimestamp();
      released = true;
    }

    await updateDoc(campaignRef, updateData);

    if (released) {
      await createNotification({
        userId: campaign.creatorId,
        role: "creator",
        type: "payment_released",
        title: "Payment released",
        message: `Payment for "${campaign.campaignTitle}" has been released.`,
        campaignId,
      });

      await createNotification({
        userId: campaign.brandId,
        role: "brand",
        type: "payment_released",
        title: "Payment released",
        message: `Payment for "${campaign.campaignTitle}" has been released automatically.`,
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
            <p><strong>${campaign.campaignTitle}</strong> reached the release threshold.</p>
            <p><strong>Views:</strong> ${views}</p>
            <p><strong>Amount:</strong> $${campaign.agreedPrice || 0}</p>
          `,
          textBody: `
Your payment has been released.

Campaign: ${campaign.campaignTitle}
Views: ${views}
Amount: $${campaign.agreedPrice || 0}
          `.trim(),
        });
      }
    }

    return NextResponse.json({ ok: true, released });
  } catch (err: any) {
    console.error("Sync campaign views error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to sync campaign views" },
      { status: 500 }
    );
  }
}