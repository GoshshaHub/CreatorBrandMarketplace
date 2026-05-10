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
      "https://irl.goshsha.com";

    const creatorCampaignUrl = `${appUrl}/creator/campaign/${campaignId}`;
    const loginUrl = `${appUrl}/login`;

    const campaignRef = adminDb.collection("campaigns").doc(campaignId);
    const campaignSnap = await campaignRef.get();

    if (!campaignSnap.exists) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const campaign = campaignSnap.data() as any;

    if (!campaign.creatorId) {
      return NextResponse.json(
        { error: "Campaign is missing creatorId" },
        { status: 400 }
      );
    }

    const userCreatorSnap = await adminDb
      .collection("users")
      .doc(campaign.creatorId)
      .get();

    const legacyCreatorSnap = await adminDb
      .collection("creators")
      .doc(campaign.creatorId)
      .get();

    const userCreator = userCreatorSnap.exists ? userCreatorSnap.data() : null;
    const legacyCreator = legacyCreatorSnap.exists
      ? legacyCreatorSnap.data()
      : null;

    const creatorEmail =
      userCreator?.contactEmail ||
      userCreator?.email ||
      legacyCreator?.contactEmail ||
      legacyCreator?.email ||
      campaign.creatorEmail;

    if (!creatorEmail) {
      return NextResponse.json(
        { error: "Creator email not found" },
        { status: 400 }
      );
    }

    // await adminDb.collection("notifications").add({
    //   userId: campaign.creatorId,
    //   role: "creator",
    //   type: "campaign_invite",
    //   title: "New campaign invite",
    //   message: `${campaign.brandName || "A brand"} invited you to "${
    //     campaign.campaignTitle || "a campaign"
    //   }".`,
    //   campaignId,
    //   read: false,
    //   createdAt: FieldValue.serverTimestamp(),
    //   updatedAt: FieldValue.serverTimestamp(),
    // });

    await sendEmail({
      to: creatorEmail,
      subject: "You have a new campaign invite",
      htmlBody: `
        <h2>You have a new campaign invite</h2>
        <p><strong>${campaign.brandName || "A brand"}</strong> invited you to a campaign.</p>
        <p><strong>Campaign:</strong> ${campaign.campaignTitle || ""}</p>
        <p><strong>Product:</strong> ${campaign.productName || ""}</p>
        <p>Please log in to review, accept, or decline the invite.</p>
        <p>
          <a href="${creatorCampaignUrl}" style="background:#0f172a;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block;">
            Open campaign invite
          </a>
        </p>
        <p>If the button does not work, log in here: <a href="${loginUrl}">${loginUrl}</a></p>
      `,
      textBody: `
You have a new campaign invite.

Brand: ${campaign.brandName || "A brand"}
Campaign: ${campaign.campaignTitle || ""}
Product: ${campaign.productName || ""}

Open campaign invite:
${creatorCampaignUrl}

Log in:
${loginUrl}
      `.trim(),
    });

    return NextResponse.json({ ok: true, sentTo: creatorEmail });
  } catch (err: any) {
    console.error("Send campaign invite error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to send campaign invite" },
      { status: 500 }
    );
  }
}