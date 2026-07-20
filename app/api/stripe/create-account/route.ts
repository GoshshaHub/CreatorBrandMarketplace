import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

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

    const existingAccountId =
      userData?.stripeAccountId ||
      userData?.stripeConnectedAccountId ||
      creatorData?.stripeAccountId ||
      creatorData?.stripeConnectedAccountId ||
      "";

    let accountId =
      existingAccountId;

    if (!accountId) {
      const account =
        await stripe.accounts.create(
          {
            type: "express",

            email:
              userData?.contactEmail ||
              userData?.email ||
              creatorData?.contactEmail ||
              creatorData?.email ||
              decodedToken.email ||
              undefined,

            metadata: {
              firebaseUid: uid,
              accountPurpose:
                "creator_payouts",
            },
          },
          {
            idempotencyKey:
              `creator-stripe-account-${uid}`,
          }
        );

      accountId = account.id;

      const updateData = {
        stripeAccountId:
          accountId,

        stripeConnectedAccountId:
          accountId,

        stripeAccountType:
          "express",

        stripeOnboardingComplete:
          false,

        stripePayoutsEnabled:
          false,

        stripeDetailsSubmitted:
          false,

        stripePayoutReady:
          false,

        updatedAt:
          FieldValue.serverTimestamp(),
      };

      await Promise.all([
        adminDb
          .collection("users")
          .doc(uid)
          .set(updateData, {
            merge: true,
          }),

        adminDb
          .collection("creators")
          .doc(uid)
          .set(updateData, {
            merge: true,
          }),
      ]);
    }

    const account =
      await stripe.accounts.retrieve(
        accountId
      );

    const onboardingComplete =
      Boolean(
        account.details_submitted
      );

    const payoutsEnabled =
      Boolean(
        account.payouts_enabled
      );

    if (
      onboardingComplete &&
      payoutsEnabled
    ) {
      const statusUpdate = {
        stripeAccountId:
          accountId,

        stripeConnectedAccountId:
          accountId,

        stripeOnboardingComplete:
          true,

        stripeDetailsSubmitted:
          true,

        stripePayoutsEnabled:
          true,

        stripePayoutReady:
          true,

        updatedAt:
          FieldValue.serverTimestamp(),
      };

      await Promise.all([
        adminDb
          .collection("users")
          .doc(uid)
          .set(statusUpdate, {
            merge: true,
          }),

        adminDb
          .collection("creators")
          .doc(uid)
          .set(statusUpdate, {
            merge: true,
          }),
      ]);

      return NextResponse.json({
        ok: true,
        accountId,
        reusedExistingAccount:
          Boolean(existingAccountId),
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
      accountId,
      reusedExistingAccount:
        Boolean(existingAccountId),
      onboardingComplete,
      payoutsEnabled,
      ready:
        onboardingComplete &&
        payoutsEnabled,
    });
  } catch (err: any) {
    console.error(
      "Create Stripe account error:",
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
            "Failed to create Stripe account.",
      },
      {
        status: isInvalidToken
          ? 401
          : 500,
      }
    );
  }
}