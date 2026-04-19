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

    const { sessionId }: { sessionId: string } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return NextResponse.json({
      id: session.id,
      paymentStatus: session.payment_status,
      status: session.status,
      metadata: session.metadata || {},
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to retrieve checkout session" },
      { status: 500 }
    );
  }
}