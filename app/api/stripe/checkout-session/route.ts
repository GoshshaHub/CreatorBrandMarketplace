import { NextResponse } from "next/server";

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

    const { sessionId } = (await req.json()) as {
      sessionId?: string;
    };

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId." },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const campaignId = session.metadata?.campaignId || "";

    if (!campaignId) {
      return NextResponse.json(
        { error: "This Checkout session is not linked to a campaign." },
        { status: 400 }
      );
    }

    const campaignSnap = await adminDb
      .collection("campaigns")
      .doc(campaignId)
      .get();

    if (!campaignSnap.exists) {
      return NextResponse.json(
        { error: "Campaign not found." },
        { status: 404 }
      );
    }

    const campaign = campaignSnap.data() as Record<string, any>;

    if (
      campaign.brandId !== uid ||
      (session.metadata?.brandId && session.metadata.brandId !== uid)
    ) {
      return NextResponse.json(
        { error: "You are not authorized to view this Checkout session." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      ok: true,
      id: session.id,
      campaignId,
      paymentStatus: session.payment_status,
      status: session.status,
      amountTotal: session.amount_total,
      currency: session.currency,
    });
  } catch (err: any) {
    console.error("Retrieve Checkout session error:", err);

    const isInvalidToken =
      err?.code === "auth/id-token-expired" ||
      err?.code === "auth/invalid-id-token" ||
      err?.code === "auth/argument-error";

    return NextResponse.json(
      {
        error: isInvalidToken
          ? "Your login session expired. Please log in again."
          : err?.message || "Failed to retrieve Checkout session.",
      },
      { status: isInvalidToken ? 401 : 500 }
    );
  }
}
