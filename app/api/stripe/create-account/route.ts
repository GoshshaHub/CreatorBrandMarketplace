import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Missing STRIPE_SECRET_KEY in .env.local" },
        { status: 500 }
      );
    }

    const origin = req.headers.get("origin") || "http://localhost:3000";

    const account = await stripe.accounts.create({
      type: "express",
    });

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${origin}/creator/stripe/refresh?accountId=${account.id}`,
      return_url: `${origin}/creator/stripe/return?accountId=${account.id}`,
      type: "account_onboarding",
    });

    return NextResponse.json({
      url: accountLink.url,
      accountId: account.id,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to create Stripe account" },
      { status: 500 }
    );
  }
}