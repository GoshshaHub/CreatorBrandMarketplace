import { NextResponse } from "next/server";
import { adminDb } from "../../../lib/firebase-admin";
import { stripe } from "../../../lib/stripe";

export async function POST(req: Request) {
  try {
    const { campaignId } = await req.json();

    if (!campaignId || typeof campaignId !== "string") {
      return NextResponse.json(
        { error: "Missing campaignId" },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_APP_URL" },
        { status: 500 }
      );
    }

    const campaignRef = adminDb.collection("campaigns").doc(campaignId);
    const campaignSnap = await campaignRef.get();

    if (!campaignSnap.exists) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const campaign = campaignSnap.data() as any;

    const amount = Number(campaign.agreedPrice || 0);

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Campaign amount must be greater than $0." },
        { status: 400 }
      );
    }

    const amountInCents = Math.round(amount * 100);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: campaign.brandEmail || campaign.contactEmail || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountInCents,
            product_data: {
              name: campaign.campaignTitle || "Goshsha Creator Campaign",
              description: campaign.productName
                ? `Product: ${campaign.productName}`
                : "Creator campaign funding",
            },
          },
        },
      ],
      metadata: {
        campaignId,
        brandId: campaign.brandId || "",
        creatorId: campaign.creatorId || "",
      },
      success_url: `${appUrl}/brand/campaign/${campaignId}?checkout=success`,
      cancel_url: `${appUrl}/brand/campaign/${campaignId}?checkout=cancelled`,
    });

    await campaignRef.update({
      stripeCheckoutSessionId: session.id,
      checkoutStatus: "created",
      updatedAt: new Date(),
    });

    return NextResponse.json({
      ok: true,
      checkoutUrl: session.url,
    });
  } catch (err: any) {
    console.error("Fund campaign checkout error:", err);

    return NextResponse.json(
      { error: err?.message || "Failed to create Stripe Checkout session." },
      { status: 500 }
    );
  }
}