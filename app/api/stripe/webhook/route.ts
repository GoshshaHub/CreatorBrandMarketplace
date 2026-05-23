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

      // =========================
      // 🔥 BRAND SUBSCRIPTION FLOW
      // =========================
      const uid = session.metadata?.uid;

      if (uid && session.mode === "subscription") {
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        await adminDb.collection("users").doc(uid).set(
          {
            isActive: true,
            subscriptionStatus: "trialing",
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            stripeCheckoutSessionId: session.id,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        await adminDb.collection("brands").doc(uid).set(
          {
            isActive: true,
            subscriptionStatus: "trialing",
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        console.log("✅ Brand activated after Stripe:", uid);

        return NextResponse.json({ received: true });
      }

      // =========================
      // 💰 CAMPAIGN FUNDING FLOW
      // =========================
      const campaignId = session.metadata?.campaignId;

      if (!campaignId) {
        return NextResponse.json({ ok: true });
      }

      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        "https://irl.goshsha.com";

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
            <p><a href="${creatorCampaignUrl}">Submit your content</a></p>
          `,
        });
      }
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