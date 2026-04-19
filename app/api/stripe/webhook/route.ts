import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../../../lib/firebase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return new NextResponse("Missing STRIPE_SECRET_KEY", { status: 500 });
    }

    if (!webhookSecret) {
      return new NextResponse("Missing STRIPE_WEBHOOK_SECRET", { status: 500 });
    }

    const body = await req.text();
    const signature = (await headers()).get("stripe-signature");

    if (!signature) {
      return new NextResponse("Missing stripe-signature header", { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as {
        id: string;
        payment_status?: string;
        payment_intent?: string | { id?: string } | null;
        metadata?: {
          campaignId?: string;
          [key: string]: string | undefined;
        };
      };

      const campaignId = session.metadata?.campaignId;

      if (campaignId && session.payment_status === "paid") {
        const campaignRef = doc(db, "campaigns", campaignId);
        const snap = await getDoc(campaignRef);

        if (snap.exists()) {
          const current = snap.data();

          if (current.fundingStatus !== "funded") {
            await setDoc(
              campaignRef,
              {
                status: "funded",
                fundingStatus: "funded",
                fundedAt: serverTimestamp(),
                stripeCheckoutSessionId: session.id,
                stripePaymentIntentId:
                  typeof session.payment_intent === "string"
                    ? session.payment_intent
                    : session.payment_intent?.id || null,
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return new NextResponse(
      `Webhook Error: ${err?.message || "Unknown error"}`,
      { status: 400 }
    );
  }
}