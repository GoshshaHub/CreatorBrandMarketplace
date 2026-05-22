import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Missing STRIPE_SECRET_KEY" },
        { status: 500 }
      );
    }

    const { email, brandName } = await req.json();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email || undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: 7500,
            recurring: {
              interval: "month",
            },
            product_data: {
              name: "Goshsha IRL Campaign Network",
              description: "Brand access with a 14-day free trial.",
            },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          brandName: brandName || "",
        },
      },
      metadata: {
        role: "brand",
        brandName: brandName || "",
      },
      success_url: `${appUrl}/brand/onboarding/launch?subscription=success`,
      cancel_url: `${appUrl}/login?subscription=cancelled`,
    });

    return NextResponse.json({
      checkoutUrl: session.url,
    });
  } catch (err: any) {
    console.error("Brand subscription checkout error:", err);

    return NextResponse.json(
      { error: err?.message || "Failed to create brand subscription checkout." },
      { status: 500 }
    );
  }
}