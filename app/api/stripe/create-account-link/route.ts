import { NextResponse } from "next/server";

import {
  adminAuth,
  adminDb,
} from "../../../../lib/firebase-admin";

import { stripe } from "../../../../lib/stripe";

function getBearerToken(req: Request): string {
  const authorization =
    req.headers.get("authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return "";
  }

  return authorization
    .slice("Bearer ".length)
    .trim();
}

export async function POST(req: Request) {
  try {
    const idToken = getBearerToken(req);

    if (!idToken) {
      return NextResponse.json(
        {
          error: "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    const decodedToken =
      await adminAuth.verifyIdToken(idToken);

    const uid = decodedToken.uid;

    const [userSnap, creatorSnap] =
      await Promise.all([
        adminDb
          .collection("users")
          .doc(uid)
          .get(),

        adminDb
          .collection("creators")
          .doc(uid)
          .get(),
      ]);

    const userData =
      userSnap.exists
        ? userSnap.data()
        : null;

    const creatorData =
      creatorSnap.exists
        ? creatorSnap.data()
        : null;

    const role =
      userData?.role ||
      creatorData?.role ||
      decodedToken.role;

    if (role && role !== "creator") {
      return NextResponse.json(
        {
          error:
            "Creator authorization required.",
        },
        {
          status: 403,
        }
      );
    }

    const accountId =
      userData?.stripeAccountId ||
      userData?.stripeConnectedAccountId ||
      creatorData?.stripeAccountId ||
      creatorData?.stripeConnectedAccountId ||
      "";

    if (!accountId) {
      return NextResponse.json(
        {
          error:
            "No Stripe account was found. Start Stripe setup before requesting a new onboarding link.",
        },
        {
          status: 404,
        }
      );
    }

    const account =
      await stripe.accounts.retrieve(
        accountId
      );

    if (
      account.details_submitted &&
      account.payouts_enabled
    ) {
      return NextResponse.json({
        ok: true,
        onboardingComplete: true,
        payoutsEnabled: true,
        ready: true,
        message:
          "Stripe onboarding is already complete.",
      });
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://irl.goshsha.com";

    const accountLink =
      await stripe.accountLinks.create({
        account: accountId,

        refresh_url:
          `${appUrl}/creator/stripe/refresh`,

        return_url:
          `${appUrl}/creator/stripe/return`,

        type: "account_onboarding",
      });

    return NextResponse.json({
      ok: true,
      url: accountLink.url,
      onboardingComplete: Boolean(
        account.details_submitted
      ),
      payoutsEnabled: Boolean(
        account.payouts_enabled
      ),
      ready: Boolean(
        account.details_submitted &&
          account.payouts_enabled
      ),
    });
  } catch (err: any) {
    console.error(
      "Create Stripe account link error:",
      err
    );

    const isInvalidToken =
      err?.code ===
        "auth/id-token-expired" ||
      err?.code ===
        "auth/invalid-id-token" ||
      err?.code ===
        "auth/argument-error";

    return NextResponse.json(
      {
        error: isInvalidToken
          ? "Your login session expired. Please log in again."
          : err?.message ||
            "Failed to create Stripe account link.",
      },
      {
        status: isInvalidToken
          ? 401
          : 500,
      }
    );
  }
}