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

    let brandEmail =
      campaign.contactEmail ||
      campaign.brandEmail ||
      campaign.email ||
      "";

    let brandName = campaign.brandName || "Brand";

    if (campaign.brandId) {
      const [brandSnap, userSnap] = await Promise.all([
        adminDb.collection("brands").doc(campaign.brandId).get(),
        adminDb.collection("users").doc(campaign.brandId).get(),
      ]);

      const brand = brandSnap.exists ? brandSnap.data() : null;
      const user = userSnap.exists ? userSnap.data() : null;

      brandEmail =
        brandEmail ||
        brand?.contactEmail ||
        brand?.email ||
        user?.email ||
        "";

      brandName =
        campaign.brandName ||
        brand?.brandName ||
        brand?.displayName ||
        user?.displayName ||
        "Brand";

      await adminDb.collection("notifications").add({
        userId: campaign.brandId,
        role: "brand",
        type: "first_irl_campaign_ar_live",
        title: "Your IRL Campaign is scan-ready",
        message: `"${campaign.campaignTitle || "Your campaign"}" is now scan-ready in Goshsha. Try scanning your product to see the live AR experience.`,
        campaignId,
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    if (brandEmail) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://irl.goshsha.com";
      const campaignUrl = `${appUrl}/brand/campaign/${campaignId}/live`;

      await sendEmail({
        to: brandEmail,
        subject: "Your first IRL Campaign is now scan-ready",
        htmlBody: `
          <h2>Your IRL Campaign is now scan-ready</h2>
          <p>Hi ${brandName},</p>
          <p><strong>${campaign.campaignTitle || "Your first IRL campaign"}</strong> has been prepared for Goshsha scan activation.</p>
          <p>Shoppers can now scan your product in Goshsha and unlock your campaign content.</p>
          <p><strong>Product:</strong> ${campaign.productName || ""}</p>
          <p><a href="${campaignUrl}">View your scan-ready IRL campaign</a></p>
        `,
        textBody: `
Your IRL Campaign is now scan-ready.

Hi ${brandName},

Campaign: ${campaign.campaignTitle || "Your first IRL campaign"}
Product: ${campaign.productName || ""}

Shoppers can now scan your product in Goshsha and unlock your campaign content.

View your scan-ready IRL campaign:
${campaignUrl}
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