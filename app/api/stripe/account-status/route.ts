import { NextResponse } from "next/server";
import Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../lib/firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

async function updateStripeAccountStatus(accountId: string) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Missing STRIPE_SECRET_KEY in environment variables" },
      { status: 500 }
    );
  }

  if (!accountId) {
    return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
  }

  const account = await stripe.accounts.retrieve(accountId);

  const onboardingComplete = Boolean(account.details_submitted);
  const chargesEnabled = Boolean(account.charges_enabled);
  const payoutsEnabled = Boolean(account.payouts_enabled);

  const usersSnap = await adminDb
    .collection("users")
    .where("stripeAccountId", "==", accountId)
    .get();

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;

    const updateData = {
      stripeAccountId: accountId,
      stripeOnboardingComplete: onboardingComplete,
      stripeChargesEnabled: chargesEnabled,
      stripePayoutsEnabled: payoutsEnabled,
      stripeDetailsSubmitted: Boolean(account.details_submitted),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await adminDb.collection("users").doc(uid).set(updateData, { merge: true });
    await adminDb.collection("creators").doc(uid).set(updateData, { merge: true });
  }

  return NextResponse.json({
    success: true,
    accountId,
    onboardingComplete,
    ready: onboardingComplete && chargesEnabled && payoutsEnabled,
    detailsSubmitted: Boolean(account.details_submitted),
    chargesEnabled,
    payoutsEnabled,
    matchedUsers: usersSnap.docs.length,
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId") || "";

    return await updateStripeAccountStatus(accountId);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to retrieve Stripe account status" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { accountId }: { accountId: string } = await req.json();

    return await updateStripeAccountStatus(accountId);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to retrieve Stripe account status" },
      { status: 500 }
    );
  }
}