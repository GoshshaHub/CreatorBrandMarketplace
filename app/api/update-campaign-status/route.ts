import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../lib/firebase-admin";
import { sendEmail } from "../../../lib/postmark";

export async function POST(req: Request) {
  try {
    const { campaignId, status } = await req.json();

    if (!campaignId || !status) {
      return NextResponse.json(
        { error: "Missing campaignId or status" },
        { status: 400 }
      );
    }

    if (status !== "accepted" && status !== "rejected") {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://irl.goshsha.com";

    const brandCampaignUrl = `${appUrl}/brand/campaign/${campaignId}`;

    const campaignRef = adminDb.collection("campaigns").doc(campaignId);
    const campaignSnap = await campaignRef.get();

    if (!campaignSnap.exists) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const campaign = campaignSnap.data() as any;

    const updateData: Record<string, any> = {
      status,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (status === "accepted") {
      updateData.creatorAcceptedAt = FieldValue.serverTimestamp();
    }

    if (status === "rejected") {
      updateData.creatorRejectedAt = FieldValue.serverTimestamp();
    }

    await campaignRef.update(updateData);

    await adminDb.collection("notifications").add({
      userId: campaign.brandId,
      role: "brand",
      type: status === "accepted" ? "campaign_accepted" : "campaign_rejected",
      title: status === "accepted" ? "Campaign accepted" : "Campaign rejected",
      message: `${campaign.creatorHandle || "A creator"} ${
        status === "accepted" ? "accepted" : "rejected"
      } "${campaign.campaignTitle || "your campaign"}".`,
      campaignId,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const brandSnap = await adminDb
      .collection("brands")
      .doc(campaign.brandId)
      .get();

    const brand = brandSnap.exists ? brandSnap.data() : null;
    const brandEmail =
      brand?.contactEmail ||
      brand?.email ||
      campaign.contactEmail ||
      campaign.brandEmail;

    if (brandEmail) {
      await sendEmail({
        to: brandEmail,
        subject:
          status === "accepted"
            ? `Creator accepted: ${campaign.campaignTitle || "Campaign"}`
            : `Creator rejected: ${campaign.campaignTitle || "Campaign"}`,
        htmlBody: `
          <h2>${status === "accepted" ? "Creator accepted" : "Creator rejected"}</h2>
          <p><strong>${campaign.creatorHandle || "A creator"}</strong> ${
            status === "accepted" ? "accepted" : "rejected"
          } your campaign.</p>
          <p><strong>Campaign:</strong> ${campaign.campaignTitle || "Campaign"}</p>
          <p><strong>Product:</strong> ${campaign.productName || "Not listed"}</p>
          ${
            status === "accepted"
              ? "<p>Next step: log in and fund the campaign so the creator can begin.</p>"
              : "<p>You can review this campaign or invite another creator.</p>"
          }
          <p><a href="${brandCampaignUrl}">View campaign</a></p>
        `,
        textBody: `
${status === "accepted" ? "Creator accepted" : "Creator rejected"}

Creator: ${campaign.creatorHandle || "Creator"}
Campaign: ${campaign.campaignTitle || "Campaign"}
Product: ${campaign.productName || "Not listed"}

${
  status === "accepted"
    ? "Next step: log in and fund the campaign so the creator can begin."
    : "You can review this campaign or invite another creator."
}

View campaign:
${brandCampaignUrl}
        `.trim(),
      });
    }

    return NextResponse.json({ ok: true, brandCampaignUrl });
  } catch (err: any) {
    console.error("Update campaign status error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to update campaign status" },
      { status: 500 }
    );
  }
}