import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export async function POST() {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Missing STRIPE_SECRET_KEY in .env.local" },
        { status: 500 }
      );
    }

    const account = await stripe.accounts.create({
      type: "express",
    });

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: "http://localhost:3000/creator/profile",
      return_url: "http://localhost:3000/creator/dashboard",
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