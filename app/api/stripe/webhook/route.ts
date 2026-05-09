import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../lib/firebase-admin";
import { stripe } from "../../../../lib/stripe";
import { sendEmail } from "../../../../lib/postmark";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 }
    );
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET" },
      { status: 500 }
    );
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error("Stripe webhook signature error:", err.message);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const campaignId = session.metadata?.campaignId;

      if (!campaignId) {
        return NextResponse.json({ ok: true });
      }

      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        "https://creator-brand-marketplace-rho.vercel.app";

      const creatorCampaignUrl = `${appUrl}/creator/campaign/${campaignId}`;
      const adminReviewUrl = `${appUrl}/admin/review`;
      const loginUrl = `${appUrl}/login`;

      const campaignRef = adminDb.collection("campaigns").doc(campaignId);
      const campaignSnap = await campaignRef.get();

      if (!campaignSnap.exists) {
        return NextResponse.json({ ok: true });
      }

      const campaign = campaignSnap.data() as any;

      await campaignRef.update({
        status: "funded",
        fundingStatus: "funded",
        checkoutStatus: "paid",
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: session.payment_intent || null,
        fundedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      await adminDb.collection("notifications").add({
        userId: campaign.creatorId,
        role: "creator",
        type: "campaign_funded",
        title: "Campaign funded",
        message: `${campaign.brandName || "A brand"} funded "${campaign.campaignTitle}". You can start now.`,
        campaignId,
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      await adminDb.collection("notifications").add({
        userId: "admin",
        role: "admin",
        type: "campaign_funded_admin",
        title: "Campaign funded",
        message: `${campaign.brandName || "A brand"} funded "${campaign.campaignTitle}".`,
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
        creator?.contactEmail || creator?.email || campaign.creatorEmail;

      if (creatorEmail) {
        await sendEmail({
          to: creatorEmail,
          subject: "Your campaign is funded",
          htmlBody: `
            <h2>Your campaign is funded</h2>
            <p><strong>${campaign.brandName || "A brand"}</strong> funded your campaign.</p>
            <p><strong>Campaign:</strong> ${campaign.campaignTitle || ""}</p>
            <p><strong>Product:</strong> ${campaign.productName || ""}</p>
            <p>You can now create your post. When it is completed, submit your post URL here:</p>
            <p><a href="${creatorCampaignUrl}">Open campaign and submit URL</a></p>
            <p><a href="${loginUrl}">Log in to Goshsha IRL Campaign Network</a></p>
          `,
          textBody: `
Your campaign is funded.

Brand: ${campaign.brandName || "A brand"}
Campaign: ${campaign.campaignTitle || ""}
Product: ${campaign.productName || ""}

Create your post. When it is completed, submit your post URL here:
${creatorCampaignUrl}

Log in:
${loginUrl}
          `.trim(),
        });
      }

      await sendEmail({
        to: process.env.ADMIN_EMAIL || "athena@goshsha.com",
        subject: "Campaign funded",
        htmlBody: `
          <h2>Campaign funded</h2>
          <p><strong>Campaign:</strong> ${campaign.campaignTitle || ""}</p>
          <p><strong>Brand:</strong> ${campaign.brandName || ""}</p>
          <p><strong>Creator:</strong> ${campaign.creatorHandle || ""}</p>
          <p><a href="${adminReviewUrl}">Open admin review</a></p>
        `,
        textBody: `
Campaign funded.

Campaign: ${campaign.campaignTitle || ""}
Brand: ${campaign.brandName || ""}
Creator: ${campaign.creatorHandle || ""}

Open admin review:
${adminReviewUrl}
        `.trim(),
      });
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Stripe webhook handler error:", err);
    return NextResponse.json(
      { error: err?.message || "Webhook handler failed" },
      { status: 500 }
    );
  }
}