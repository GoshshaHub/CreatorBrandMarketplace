import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../lib/firebase-admin";
import { sendEmail } from "../../../lib/postmark";
import { stripe } from "../../../lib/stripe";

export async function POST(req: Request) {
  try {
    const { campaignId } = await req.json();

    if (!campaignId || typeof campaignId !== "string") {
      return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://creator-brand-marketplace-rho.vercel.app";

    const creatorCampaignUrl = `${appUrl}/creator/campaign/${campaignId}`;
    const creatorProfileUrl = `${appUrl}/creator/profile`;
    const loginUrl = `${appUrl}/login`;

    const campaignRef = adminDb.collection("campaigns").doc(campaignId);
    const campaignSnap = await campaignRef.get();

    if (!campaignSnap.exists) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const campaign = campaignSnap.data() as any;

    if (campaign.payoutStatus === "released") {
      return NextResponse.json({
        ok: true,
        message: "Payout was already released.",
      });
    }

    const creatorPayoutAmount = Number(campaign.creatorPayoutAmount || 0);

    if (!creatorPayoutAmount || creatorPayoutAmount <= 0) {
      return NextResponse.json(
        { error: "Creator payout amount is missing or invalid." },
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

    const stripeAccountId =
      userCreator?.stripeAccountId ||
      userCreator?.stripeConnectedAccountId ||
      legacyCreator?.stripeAccountId ||
      legacyCreator?.stripeConnectedAccountId ||
      campaign.creatorStripeAccountId;

    if (!stripeAccountId) {
      return NextResponse.json(
        {
          error:
            "Creator Stripe account not found. Creator must complete Stripe setup before payout can be released.",
        },
        { status: 400 }
      );
    }

    const stripeAccount = await stripe.accounts.retrieve(stripeAccountId);

    if (!stripeAccount.details_submitted || !stripeAccount.payouts_enabled) {
      return NextResponse.json(
        {
          error:
            "Creator Stripe setup is not complete yet. Ask creator to finish Stripe onboarding.",
        },
        { status: 400 }
      );
    }

    const amountInCents = Math.round(creatorPayoutAmount * 100);

    const transfer = await stripe.transfers.create({
      amount: amountInCents,
      currency: "usd",
      destination: stripeAccountId,
      description: `Goshsha campaign payout: ${
        campaign.campaignTitle || campaignId
      }`,
      metadata: {
        campaignId,
        creatorId: campaign.creatorId || "",
        brandId: campaign.brandId || "",
      },
    });

    await campaignRef.update({
      status: "completed",
      payoutStatus: "released",
      payoutReleaseStatus: "released",
      payoutReleasedAt: FieldValue.serverTimestamp(),
      stripeTransferId: transfer.id,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await adminDb.collection("notifications").add({
      userId: campaign.creatorId,
      role: "creator",
      type: "payout_released",
      title: "Payout released",
      message: `Your payout for "${campaign.campaignTitle}" has been released.`,
      campaignId,
      read: false,
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
      read: false,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (creatorEmail) {
      await sendEmail({
        to: creatorEmail,
        subject: "Payout released",
        htmlBody: `
          <h2>Payout released</h2>
          <p>Your payout for <strong>${campaign.campaignTitle || "your campaign"}</strong> has been released.</p>
          <p><strong>Amount:</strong> $${creatorPayoutAmount.toFixed(2)}</p>
          <p><strong>Stripe transfer ID:</strong> ${transfer.id}</p>
          <p>You can view your campaign here:</p>
          <p><a href="${creatorCampaignUrl}">View campaign</a></p>
          <p>If you need to manage your payout account, go here:</p>
          <p><a href="${creatorProfileUrl}">Creator Profile</a></p>
          <p><a href="${loginUrl}">Log in to Goshsha IRL Campaign Network</a></p>
        `,
        textBody: `
Payout released.

Your payout for ${campaign.campaignTitle || "your campaign"} has been released.

Amount: $${creatorPayoutAmount.toFixed(2)}
Stripe transfer ID: ${transfer.id}

View campaign:
${creatorCampaignUrl}

Creator Profile:
${creatorProfileUrl}

Log in:
${loginUrl}
        `.trim(),
      });
    }

    return NextResponse.json({
      ok: true,
      transferId: transfer.id,
      amount: creatorPayoutAmount,
    });
  } catch (err: any) {
    console.error("Release campaign payout error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to release campaign payout" },
      { status: 500 }
    );
  }
}