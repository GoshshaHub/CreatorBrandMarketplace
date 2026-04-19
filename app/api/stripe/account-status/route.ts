import { NextResponse } from "next/server";
import Stripe from "stripe";
import { collection, getDocs, query, serverTimestamp, setDoc, where, doc } from "firebase/firestore";
import { db } from "../../../../lib/firebase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Missing STRIPE_SECRET_KEY in .env.local" },
        { status: 500 }
      );
    }

    const { accountId }: { accountId: string } = await req.json();

    if (!accountId) {
      return NextResponse.json(
        { error: "Missing accountId" },
        { status: 400 }
      );
    }

    const account = await stripe.accounts.retrieve(accountId);

    const ready = Boolean(
      account.details_submitted &&
        account.charges_enabled &&
        account.payouts_enabled
    );

    const usersQ = query(
      collection(db, "users"),
      where("stripeAccountId", "==", accountId)
    );

    const usersSnap = await getDocs(usersQ);

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;

      await setDoc(
        doc(db, "users", uid),
        {
          stripeOnboardingComplete: ready,
          stripeChargesEnabled: account.charges_enabled,
          stripePayoutsEnabled: account.payouts_enabled,
          stripeDetailsSubmitted: account.details_submitted,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "creators", uid),
        {
          stripeOnboardingComplete: ready,
          stripeChargesEnabled: account.charges_enabled,
          stripePayoutsEnabled: account.payouts_enabled,
          stripeDetailsSubmitted: account.details_submitted,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    return NextResponse.json({
      ready,
      detailsSubmitted: account.details_submitted,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to retrieve Stripe account status" },
      { status: 500 }
    );
  }
}