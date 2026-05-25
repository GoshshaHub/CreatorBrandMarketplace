import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../lib/firebase-admin";
import { sendEmail } from "../../../lib/postmark";

export async function POST(req: Request) {
  try {
    const { campaignId } = await req.json();

    if (!campaignId) {
      return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
    }

    const campaignRef = adminDb.collection("campaigns").doc(campaignId);
    const campaignSnap = await campaignRef.get();

    if (!campaignSnap.exists) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const campaign = campaignSnap.data() as any;

    await campaignRef.update({
      status: "ar_live",
      arStatus: "live",
      goshshaReviewStatus: "approved",
      arLiveAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (campaign.brandId) {
      await adminDb.collection("notifications").add({
        userId: campaign.brandId,
        role: "brand",
        type: "first_irl_campaign_ar_live",
        title: "Your IRL Campaign is scan-ready",
        message: `"${campaign.campaignTitle || "Your campaign"}" is now scan-ready in Goshsha.`,
        campaignId,
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    const brandEmail = campaign.contactEmail || campaign.brandEmail;

    if (brandEmail) {
      await sendEmail({
        to: brandEmail,
        subject: "Your IRL Campaign is now scan-ready",
        htmlBody: `
          <h2>Your IRL Campaign is now scan-ready</h2>
          <p><strong>${campaign.campaignTitle || "Your campaign"}</strong> has been prepared for Goshsha scan activation.</p>
          <p>Your product is now ready for the next step: inviting creators and scaling your IRL campaign.</p>
        `,
        textBody: `
Your IRL Campaign is now scan-ready.

Campaign: ${campaign.campaignTitle || "Your campaign"}

Your product is now ready for the next step: inviting creators and scaling your IRL campaign.
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