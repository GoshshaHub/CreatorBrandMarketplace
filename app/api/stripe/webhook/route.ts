import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminDb,
} from "../../../../lib/firebase-admin";

import { sendEmail } from "../../../../lib/postmark";
import { stripe } from "../../../../lib/stripe";

type StripeWebhookEvent =
  ReturnType<
    typeof stripe.webhooks.constructEvent
  >;

type StripeCheckoutSession =
  Awaited<
    ReturnType<
      typeof stripe.checkout.sessions.retrieve
    >
  >;

async function claimWebhookEvent(
  event: StripeWebhookEvent
): Promise<boolean> {
  const eventRef =
    adminDb
      .collection(
        "stripeWebhookEvents"
      )
      .doc(event.id);

  return adminDb.runTransaction(
    async (transaction) => {
      const eventSnap =
        await transaction.get(
          eventRef
        );

      if (eventSnap.exists) {
        const existingEvent =
          eventSnap.data() as {
            status?: string;
          };

        if (
          existingEvent.status ===
            "processed" ||
          existingEvent.status ===
            "processing"
        ) {
          return false;
        }

        /*
         * A failed event may be retried by Stripe.
         */
        transaction.update(
          eventRef,
          {
            status:
              "processing",

            error:
              null,

            retryStartedAt:
              FieldValue.serverTimestamp(),

            updatedAt:
              FieldValue.serverTimestamp(),
          }
        );

        return true;
      }

      transaction.create(
        eventRef,
        {
          eventId:
            event.id,

          type:
            event.type,

          status:
            "processing",

          createdAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        }
      );

      return true;
    }
  );
}

async function markWebhookEvent(
  eventId: string,
  status:
    | "processed"
    | "failed",
  error?: string
) {
  await adminDb
    .collection(
      "stripeWebhookEvents"
    )
    .doc(eventId)
    .set(
      {
        status,

        error:
          error || null,

        processedAt:
          status === "processed"
            ? FieldValue.serverTimestamp()
            : null,

        failedAt:
          status === "failed"
            ? FieldValue.serverTimestamp()
            : null,

        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      }
    );
}

export async function POST(
  req: Request
) {
  const body =
    await req.text();

  const signature =
    req.headers.get(
      "stripe-signature"
    );

  if (!signature) {
    return NextResponse.json(
      {
        error:
          "Missing Stripe signature.",
      },
      {
        status: 400,
      }
    );
  }

  const webhookSecret =
    process.env
      .STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      {
        error:
          "Missing STRIPE_WEBHOOK_SECRET.",
      },
      {
        status: 500,
      }
    );
  }

  let event:
    StripeWebhookEvent;

  try {
    event =
      stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      );
  } catch (err: any) {
    console.error(
      "Stripe webhook signature error:",
      err?.message
    );

    return NextResponse.json(
      {
        error:
          `Webhook Error: ${
            err?.message ||
            "Invalid signature"
          }`,
      },
      {
        status: 400,
      }
    );
  }

  let claimed = false;

  try {
    claimed =
      await claimWebhookEvent(
        event
      );

    if (!claimed) {
      return NextResponse.json({
        received: true,
        alreadyProcessed:
          true,
      });
    }

    if (
      event.type !==
      "checkout.session.completed"
    ) {
      await markWebhookEvent(
        event.id,
        "processed"
      );

      return NextResponse.json({
        received: true,
      });
    }

    const session =
      event.data
        .object as StripeCheckoutSession;

    /*
     * -----------------------------------------------------
     * Brand subscription flow
     * -----------------------------------------------------
     */

    const uid =
      session.metadata?.uid;

    if (
      uid &&
      session.mode ===
        "subscription"
    ) {
      await Promise.all([
        adminDb
          .collection("users")
          .doc(uid)
          .set(
            {
              isActive:
                true,

              subscriptionStatus:
                "trialing",

              stripeCustomerId:
                session.customer ||
                null,

              stripeSubscriptionId:
                session.subscription ||
                null,

              stripeCheckoutSessionId:
                session.id,

              updatedAt:
                FieldValue.serverTimestamp(),
            },
            {
              merge: true,
            }
          ),

        adminDb
          .collection("brands")
          .doc(uid)
          .set(
            {
              isActive:
                true,

              subscriptionStatus:
                "trialing",

              stripeCustomerId:
                session.customer ||
                null,

              stripeSubscriptionId:
                session.subscription ||
                null,

              stripeCheckoutSessionId:
                session.id,

              updatedAt:
                FieldValue.serverTimestamp(),
            },
            {
              merge: true,
            }
          ),
      ]);

      await markWebhookEvent(
        event.id,
        "processed"
      );

      return NextResponse.json({
        received: true,
      });
    }

    /*
     * -----------------------------------------------------
     * Campaign funding flow
     * -----------------------------------------------------
     */

    const campaignId =
      session.metadata
        ?.campaignId;

    if (!campaignId) {
      await markWebhookEvent(
        event.id,
        "processed"
      );

      return NextResponse.json({
        received: true,
      });
    }

    if (
      session.mode !== "payment" ||
      session.payment_status !==
        "paid"
    ) {
      throw new Error(
        `Campaign funding session is not paid. mode=${session.mode}, payment_status=${session.payment_status}`
      );
    }

    const campaignRef =
      adminDb
        .collection("campaigns")
        .doc(campaignId);

    const result =
      await adminDb.runTransaction(
        async (transaction) => {
          const campaignSnap =
            await transaction.get(
              campaignRef
            );

          if (
            !campaignSnap.exists
          ) {
            return {
              shouldNotify:
                false,

              campaign:
                null,
            };
          }

          const campaign =
            campaignSnap.data() as Record<
              string,
              any
            >;

          /*
           * The exact Checkout session was already handled.
           */
          if (
            campaign.fundingStatus ===
              "funded" &&
            campaign
              .stripeCheckoutSessionId ===
              session.id
          ) {
            return {
              shouldNotify:
                false,

              campaign,
            };
          }

          /*
           * Never allow a later Checkout session to fund an
           * already-funded campaign again.
           */
          if (
            campaign.fundingStatus ===
              "funded" ||
            campaign.checkoutStatus ===
              "paid"
          ) {
            return {
              shouldNotify:
                false,

              campaign,
            };
          }

          if (
            session.metadata
              ?.brandId &&
            campaign.brandId !==
              session.metadata
                .brandId
          ) {
            throw new Error(
              "Stripe session Brand does not match campaign Brand."
            );
          }

          if (
            session.metadata
              ?.creatorId &&
            campaign.creatorId !==
              session.metadata
                .creatorId
          ) {
            throw new Error(
              "Stripe session Creator does not match campaign Creator."
            );
          }

          const expectedAmountCents =
            Math.round(
              Number(
                campaign.agreedPrice ||
                  0
              ) * 100
            );

          if (
            expectedAmountCents <=
            0
          ) {
            throw new Error(
              "Campaign funding amount is invalid."
            );
          }

          if (
            typeof session.amount_total ===
              "number" &&
            session.amount_total !==
              expectedAmountCents
          ) {
            throw new Error(
              "Stripe session amount does not match the campaign amount."
            );
          }

          const paymentIntentId =
            typeof session.payment_intent ===
            "string"
              ? session.payment_intent
              : session
                  .payment_intent
                  ?.id ||
                null;

          transaction.update(
            campaignRef,
            {
              status:
                "funded",

              fundingStatus:
                "funded",

              checkoutStatus:
                "paid",

              stripeCheckoutSessionId:
                session.id,

              stripePaymentIntentId:
                paymentIntentId,

              stripeAmountTotalCents:
                session.amount_total ||
                expectedAmountCents,

              stripeCurrency:
                session.currency ||
                "usd",

              fundedAt:
                FieldValue.serverTimestamp(),

              updatedAt:
                FieldValue.serverTimestamp(),
            }
          );

          return {
            shouldNotify:
              true,

            campaign,
          };
        }
      );

    if (
      result.shouldNotify &&
      result.campaign
    ) {
      const campaign =
        result.campaign;

      const appUrl =
        process.env
          .NEXT_PUBLIC_APP_URL ||
        "https://irl.goshsha.com";

      const creatorCampaignUrl =
        `${appUrl}/creator/campaign/${campaignId}`;

      try {
        await Promise.all([
          adminDb
            .collection(
              "notifications"
            )
            .add({
              userId:
                campaign.creatorId,

              role:
                "creator",

              type:
                "campaign_funded",

              title:
                "Campaign funded",

              message:
                `${
                  campaign.brandName ||
                  "A Brand"
                } funded "${
                  campaign.campaignTitle ||
                  "your campaign"
                }". You can start now.`,

              campaignId,

              isRead:
                false,

              read:
                false,

              createdAt:
                FieldValue.serverTimestamp(),

              updatedAt:
                FieldValue.serverTimestamp(),
            }),

          adminDb
            .collection(
              "notifications"
            )
            .add({
              userId:
                "admin",

              role:
                "admin",

              type:
                "campaign_funded_admin",

              title:
                "Campaign funded",

              message:
                `${
                  campaign.brandName ||
                  "A Brand"
                } funded "${
                  campaign.campaignTitle ||
                  "a campaign"
                }".`,

              campaignId,

              isRead:
                false,

              read:
                false,

              createdAt:
                FieldValue.serverTimestamp(),

              updatedAt:
                FieldValue.serverTimestamp(),
            }),
        ]);
      } catch (
        notificationError
      ) {
        console.error(
          "Campaign funded, but notification creation failed:",
          notificationError
        );
      }

      try {
        const [
          creatorSnap,
          userCreatorSnap,
        ] =
          await Promise.all([
            adminDb
              .collection(
                "creators"
              )
              .doc(
                campaign.creatorId
              )
              .get(),

            adminDb
              .collection("users")
              .doc(
                campaign.creatorId
              )
              .get(),
          ]);

        const creator =
          creatorSnap.exists
            ? creatorSnap.data()
            : null;

        const userCreator =
          userCreatorSnap.exists
            ? userCreatorSnap.data()
            : null;

        const creatorEmail =
          userCreator?.contactEmail ||
          userCreator?.email ||
          creator?.contactEmail ||
          creator?.email ||
          campaign.creatorEmail ||
          "";

        if (creatorEmail) {
          await sendEmail({
            to:
              creatorEmail,

            subject:
              "Your campaign is funded",

            htmlBody: `
              <h2>Your campaign is funded</h2>

              <p>
                <strong>${
                  campaign.brandName ||
                  "A Brand"
                }</strong>
                funded your campaign.
              </p>

              <p>
                <strong>Campaign:</strong>
                ${
                  campaign.campaignTitle ||
                  ""
                }
              </p>

              <p>
                <strong>Product:</strong>
                ${
                  campaign.productName ||
                  ""
                }
              </p>

              <p>
                <a href="${creatorCampaignUrl}">
                  View campaign and submit your content
                </a>
              </p>
            `,

            textBody: `
Your campaign is funded.

Brand:
${campaign.brandName || "A Brand"}

Campaign:
${campaign.campaignTitle || ""}

Product:
${campaign.productName || ""}

View campaign:
${creatorCampaignUrl}
            `.trim(),
          });
        }
      } catch (emailError) {
        console.error(
          "Campaign funded, but Creator email failed:",
          emailError
        );
      }
    }

    await markWebhookEvent(
      event.id,
      "processed"
    );

    return NextResponse.json({
      received: true,
    });
  } catch (err: any) {
    console.error(
      "Stripe webhook handler error:",
      err
    );

    if (claimed) {
      try {
        await markWebhookEvent(
          event.id,
          "failed",
          String(
            err?.message ||
              "Webhook handler failed"
          )
        );
      } catch (recordError) {
        console.error(
          "Failed to record webhook error:",
          recordError
        );
      }
    }

    return NextResponse.json(
      {
        error:
          err?.message ||
          "Webhook handler failed.",
      },
      {
        status: 500,
      }
    );
  }
}