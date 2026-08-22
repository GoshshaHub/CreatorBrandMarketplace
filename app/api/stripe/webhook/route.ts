import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminDb,
} from "../../../../lib/firebase-admin";

import { sendEmail } from "../../../../lib/postmark";
import { stripe } from "../../../../lib/stripe";

import {
  createActivationCreditDefaults,
  getRetailMediaPurchaseDefinition,
  RetailMediaPurchaseDefinitionKey,
} from "../../../../lib/retail-media/activation-commerce";


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
    * Retail Media Activation Commerce
    * -----------------------------------------------------
    *
    * Handles:
    *
    * Product 1 additional activation
    * Product 2 single activation
    * Product 2 volume packs
    *
    * IMPORTANT:
    *
    * Opening Checkout does NOT create activation credits.
    * Credits are created only after Stripe confirms that
    * the Checkout Session is paid.
    */

    const commerceType =
      session.metadata?.commerceType;

    const commerceId =
      session.metadata?.commerceId;

    if (
      commerceType ===
        "retail_media_activation" &&
      commerceId
    ) {
      if (
        session.mode !==
          "payment" ||
        session.payment_status !==
          "paid"
      ) {
        throw new Error(
          `Retail Media Checkout session is not paid. mode=${session.mode}, payment_status=${session.payment_status}`
        );
      }

      const commerceRef =
        adminDb
          .collection(
            "retailMediaCommerce"
          )
          .doc(commerceId);

      /*
      * -----------------------------------------------------
      * Complete purchase transaction
      * -----------------------------------------------------
      *
      * The transaction:
      *
      * 1. verifies the purchase
      * 2. prevents duplicate fulfillment
      * 3. marks payment paid
      * 4. creates activation credits
      */

      const fulfillmentResult =
        await adminDb.runTransaction(
          async (transaction) => {
            const commerceSnap =
              await transaction.get(
                commerceRef
              );

            if (
              !commerceSnap.exists
            ) {
              throw new Error(
                "Retail Media commerce record not found."
              );
            }

            const commerce =
              commerceSnap.data() as Record<
                string,
                any
              >;

            /*
            * Exact purchase already fulfilled.
            *
            * This is additional protection beyond the
            * webhook event idempotency layer.
            */
            if (
              commerce.paymentStatus ===
                "paid" &&
              commerce.fulfillmentStatus ===
                "fulfilled"
            ) {
              return {
                alreadyFulfilled:
                  true,

                brandId:
                  commerce.brandId ||
                  "",

                retailAssetId:
                  commerce.retailAssetId ||
                  null,

                purchaseDefinitionKey:
                  commerce.purchaseDefinitionKey ||
                  "",

                creditIds:
                  Array.isArray(
                    commerce.activationCreditIds
                  )
                    ? commerce.activationCreditIds
                    : [],
              };
            }

            const metadataBrandId =
              session.metadata
                ?.brandId ||
              "";

            if (
              !metadataBrandId ||
              metadataBrandId !==
                commerce.brandId
            ) {
              throw new Error(
                "Stripe Retail Media Brand does not match the commerce record."
              );
            }

            const purchaseDefinitionKey =
              commerce.purchaseDefinitionKey as
                RetailMediaPurchaseDefinitionKey;

            if (
              !purchaseDefinitionKey
            ) {
              throw new Error(
                "Retail Media purchase definition is missing."
              );
            }

            const definition =
              getRetailMediaPurchaseDefinition(
                purchaseDefinitionKey
              );

            /*
            * Compare Stripe metadata with the authoritative
            * Firestore purchase.
            */
            if (
              session.metadata
                ?.purchaseDefinitionKey &&
              session.metadata
                .purchaseDefinitionKey !==
                purchaseDefinitionKey
            ) {
              throw new Error(
                "Stripe Retail Media purchase definition does not match the commerce record."
              );
            }

            if (
              definition.customPricing
            ) {
              throw new Error(
                "Custom-priced Retail Media purchases cannot be fulfilled through standard Checkout."
              );
            }

            const expectedAmountCents =
              Math.round(
                Number(
                  commerce
                    .purchaseSnapshot
                    ?.amountUsd ??
                    commerce.amountUsd ??
                    definition.amountUsd ??
                    0
                ) * 100
              );

            if (
              expectedAmountCents <=
              0
            ) {
              throw new Error(
                "Retail Media purchase amount is invalid."
              );
            }

            if (
              typeof session.amount_total ===
                "number" &&
              session.amount_total !==
                expectedAmountCents
            ) {
              throw new Error(
                "Stripe Retail Media payment amount does not match the commerce record."
              );
            }

            const activationCredits =
              Number(
                commerce
                  .purchaseSnapshot
                  ?.activationCredits ??
                  definition.activationCredits ??
                  0
              );

            if (
              !Number.isInteger(
                activationCredits
              ) ||
              activationCredits <
                1
            ) {
              throw new Error(
                "Retail Media activation credit quantity is invalid."
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

            /*
            * Create deterministic credit IDs.
            *
            * Because they are based on commerceId + index,
            * even an unexpected retry cannot generate a
            * second set of credits.
            */

            const creditIds:
              string[] = [];

            for (
              let index = 0;
              index <
              activationCredits;
              index += 1
            ) {
              const creditId =
                `${commerceId}_credit_${
                  index + 1
                }`;

              creditIds.push(
                creditId
              );

              const creditRef =
                adminDb
                  .collection(
                    "retailMediaActivationCredits"
                  )
                  .doc(
                    creditId
                  );

              const credit =
                createActivationCreditDefaults({
                  creditId,

                  brandId:
                    commerce.brandId,

                  purchaseDefinitionKey,

                  sourcePurchaseId:
                    commerceId,

                  createdAt:
                    FieldValue.serverTimestamp(),

                  updatedAt:
                    FieldValue.serverTimestamp(),
                });

              transaction.set(
                creditRef,
                {
                  ...credit,

                  commerceId,

                  packPurchaseId:
                    activationCredits >
                    1
                      ? commerceId
                      : null,

                  creditNumber:
                    index + 1,

                  totalCreditsInPurchase:
                    activationCredits,

                  stripeCheckoutSessionId:
                    session.id,

                  stripePaymentIntentId:
                    paymentIntentId,

                  /*
                  * If a Brand purchased a single activation
                  * against an already-created Retail Asset,
                  * associate that asset with the first credit.
                  *
                  * We do NOT consume it yet.
                  */
                  retailAssetId:
                    index === 0
                      ? commerce.retailAssetId ||
                        null
                      : null,
                },
                {
                  merge: false,
                }
              );
            }

            /*
            * -------------------------------------------------
            * Volume pack record
            * -------------------------------------------------
            */

            let packPurchaseId:
              string | null =
              null;

            if (
              activationCredits >
              1
            ) {
              packPurchaseId =
                commerceId;

              const packRef =
                adminDb
                  .collection(
                    "retailMediaVolumePacks"
                  )
                  .doc(
                    packPurchaseId
                  );

              transaction.set(
                packRef,
                {
                  packId:
                    packPurchaseId,

                  commerceId,

                  brandId:
                    commerce.brandId,

                  product:
                    definition.product,

                  purchaseDefinitionKey,

                  totalCredits:
                    activationCredits,

                  remainingCredits:
                    activationCredits,

                  amountUsd:
                    commerce
                      .purchaseSnapshot
                      ?.amountUsd ??
                    commerce.amountUsd ??
                    definition.amountUsd ??
                    null,

                  currency:
                    "USD",

                  paymentStatus:
                    "paid",

                  stripeCheckoutSessionId:
                    session.id,

                  stripePaymentIntentId:
                    paymentIntentId,

                  activationCreditIds:
                    creditIds,

                  createdAt:
                    FieldValue.serverTimestamp(),

                  updatedAt:
                    FieldValue.serverTimestamp(),
                },
                {
                  merge: false,
                }
              );
            }

            /*
            * -------------------------------------------------
            * Mark commerce purchase paid + fulfilled
            * -------------------------------------------------
            */

            transaction.update(
              commerceRef,
              {
                paymentStatus:
                  "paid",

                checkoutStatus:
                  "paid",

                fulfillmentStatus:
                  "fulfilled",

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

                activationCreditIds:
                  creditIds,

                activationCreditsIssued:
                  activationCredits,

                packPurchaseId,

                paidAt:
                  FieldValue.serverTimestamp(),

                fulfilledAt:
                  FieldValue.serverTimestamp(),

                updatedAt:
                  FieldValue.serverTimestamp(),
              }
            );

            return {
              alreadyFulfilled:
                false,

              brandId:
                commerce.brandId,

              retailAssetId:
                commerce.retailAssetId ||
                null,

              purchaseDefinitionKey,

              creditIds,
            };
          }
        );

      /*
      * -----------------------------------------------------
      * Brand notification
      * -----------------------------------------------------
      *
      * Notification failure must never undo payment
      * fulfillment.
      */

      if (
        !fulfillmentResult
          .alreadyFulfilled
      ) {
        try {
          const creditCount =
            fulfillmentResult
              .creditIds.length;

          await adminDb
            .collection(
              "notifications"
            )
            .add({
              userId:
                fulfillmentResult
                  .brandId,

              role:
                "brand",

              type:
                "retail_media_activation_purchased",

              title:
                creditCount === 1
                  ? "Retail Media activation ready"
                  : `${creditCount} Retail Media activations ready`,

              message:
                creditCount === 1
                  ? "Your Retail Media activation payment was successful. Your activation credit is ready to use."
                  : `Your Retail Media payment was successful. ${creditCount} activation credits are ready to use.`,

              retailAssetId:
                fulfillmentResult
                  .retailAssetId,

              commerceId,

              isRead:
                false,

              read:
                false,

              createdAt:
                FieldValue.serverTimestamp(),

              updatedAt:
                FieldValue.serverTimestamp(),
            });
        } catch (
          notificationError
        ) {
          console.error(
            "Retail Media purchase fulfilled, but Brand notification failed:",
            notificationError
          );
        }
      }

      /*
      * -----------------------------------------------------
      * Webhook complete
      * -----------------------------------------------------
      */

      await markWebhookEvent(
        event.id,
        "processed"
      );

      return NextResponse.json({
        received:
          true,

        retailMediaCommerce:
          true,

        commerceId,

        alreadyFulfilled:
          fulfillmentResult
            .alreadyFulfilled,

        activationCreditsIssued:
          fulfillmentResult
            .creditIds.length,
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