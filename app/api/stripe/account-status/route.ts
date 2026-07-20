import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
} from "../../../../lib/firebase-admin";
import { stripe } from "../../../../lib/stripe";

function getBearerToken(req: Request): string {
  const authorization = req.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

export async function POST(req: Request) {
  try {
    const idToken = getBearerToken(req);

    if (!idToken) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const [userSnap, creatorSnap] = await Promise.all([
      adminDb.collection("users").doc(uid).get(),
      adminDb.collection("creators").doc(uid).get(),
    ]);

    const userData = userSnap.exists ? userSnap.data() : null;
    const creatorData = creatorSnap.exists ? creatorSnap.data() : null;

    const accountId =
      userData?.stripeAccountId ||
      userData?.stripeConnectedAccountId ||
      creatorData?.stripeAccountId ||
      creatorData?.stripeConnectedAccountId ||
      "";

    if (!accountId) {
      return NextResponse.json({
        ok: true,
        hasStripeAccount: false,
        onboardingComplete: false,
        payoutsEnabled: false,
        ready: false,
      });
    }

    const account = await stripe.accounts.retrieve(accountId);

    const onboardingComplete = Boolean(account.details_submitted);
    const chargesEnabled = Boolean(account.charges_enabled);
    const payoutsEnabled = Boolean(account.payouts_enabled);
    const ready = onboardingComplete && payoutsEnabled;

    const updateData = {
      stripeAccountId: accountId,
      stripeConnectedAccountId: accountId,
      stripeOnboardingComplete: onboardingComplete,
      stripeChargesEnabled: chargesEnabled,
      stripePayoutsEnabled: payoutsEnabled,
      stripeDetailsSubmitted: onboardingComplete,
      stripePayoutReady: ready,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await Promise.all([
      adminDb.collection("users").doc(uid).set(updateData, { merge: true }),
      adminDb.collection("creators").doc(uid).set(updateData, { merge: true }),
    ]);

    return NextResponse.json({
      ok: true,
      hasStripeAccount: true,
      accountId,
      onboardingComplete,
      detailsSubmitted: onboardingComplete,
      chargesEnabled,
      payoutsEnabled,
      ready,
    });
  } catch (err: any) {
    console.error("Retrieve Stripe account status error:", err);

    const isInvalidToken =
      err?.code === "auth/id-token-expired" ||
      err?.code === "auth/invalid-id-token" ||
      err?.code === "auth/argument-error";

    return NextResponse.json(
      {
        error: isInvalidToken
          ? "Your login session expired. Please log in again."
          : err?.message || "Failed to retrieve Stripe account status.",
      },
      { status: isInvalidToken ? 401 : 500 }
    );
  }
}
