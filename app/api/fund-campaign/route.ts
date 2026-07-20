import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
} from "../../../lib/firebase-admin";
import { stripe } from "../../../lib/stripe";

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
    const authenticatedUid = decodedToken.uid;

    const { campaignId } = (await req.json()) as {
      campaignId?: string;
    };

    if (!campaignId || typeof campaignId !== "string") {
      return NextResponse.json(
        { error: "Missing campaignId." },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_APP_URL." },
        { status: 500 }
      );
    }

    const campaignRef = adminDb.collection("campaigns").doc(campaignId);
    const campaignSnap = await campaignRef.get();

    if (!campaignSnap.exists) {
      return NextResponse.json(
        { error: "Campaign not found." },
        { status: 404 }
      );
    }

    const campaign = campaignSnap.data() as Record<string, any>;

    if (campaign.brandId !== authenticatedUid) {
      return NextResponse.json(
        { error: "You are not authorized to fund this campaign." },
        { status: 403 }
      );
    }

    if (campaign.status !== "accepted") {
      return NextResponse.json(
        { error: "The Creator must accept this campaign before funding." },
        { status: 409 }
      );
    }

    if (
      campaign.fundingStatus === "funded" ||
      campaign.checkoutStatus === "paid"
    ) {
      return NextResponse.json(
        { error: "This campaign has already been funded." },
        { status: 409 }
      );
    }

    const amount = Number(campaign.agreedPrice || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Campaign amount must be greater than $0." },
        { status: 400 }
      );
    }

    const amountInCents = Math.round(amount * 100);
    const fundingAttempt = Number(campaign.fundingAttempt || 0) + 1;

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        customer_email:
          campaign.brandEmail || campaign.contactEmail || undefined,
        client_reference_id: campaignId,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: amountInCents,
              product_data: {
                name:
                  campaign.campaignTitle || "Goshsha Creator Campaign",
                description: campaign.productName
                  ? `Product: ${campaign.productName}`
                  : "Creator campaign funding",
              },
            },
          },
        ],
        payment_intent_data: {
          metadata: {
            campaignId,
            brandId: campaign.brandId || "",
            creatorId: campaign.creatorId || "",
            paymentType: "campaign_funding",
          },
        },
        metadata: {
          campaignId,
          brandId: campaign.brandId || "",
          creatorId: campaign.creatorId || "",
          paymentType: "campaign_funding",
          fundingAttempt: String(fundingAttempt),
        },
        success_url: `${appUrl}/brand/campaign/${campaignId}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/brand/campaign/${campaignId}?checkout=cancelled`,
      },
      {
        idempotencyKey: `campaign-funding-${campaignId}-${fundingAttempt}`,
      }
    );

    await campaignRef.update({
      stripeCheckoutSessionId: session.id,
      checkoutStatus: "created",
      fundingAttempt,
      fundingCheckoutCreatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      ok: true,
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (err: any) {
    console.error("Fund campaign checkout error:", err);

    const isInvalidToken =
      err?.code === "auth/id-token-expired" ||
      err?.code === "auth/invalid-id-token" ||
      err?.code === "auth/argument-error";

    return NextResponse.json(
      {
        error: isInvalidToken
          ? "Your login session expired. Please log in again."
          : err?.message || "Failed to create Stripe Checkout session.",
      },
      { status: isInvalidToken ? 401 : 500 }
    );
  }
}
