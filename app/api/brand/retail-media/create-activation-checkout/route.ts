import { randomUUID } from "crypto";

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
} from "../../../../../lib/firebase-admin";

import {
  stripe,
} from "../../../../../lib/stripe";

import {
  createRetailMediaCommerceRecordDefaults,
  getRetailMediaPurchaseDefinition,
  RetailMediaPurchaseDefinitionKey,
} from "../../../../../lib/retail-media/activation-commerce";

type CheckoutBody = {
  purchaseDefinitionKey?:
    RetailMediaPurchaseDefinitionKey;

  retailAssetId?:
    string | null;

  campaignId?:
    string | null;
};

const ALLOWED_CHECKOUT_KEYS =
  new Set<RetailMediaPurchaseDefinitionKey>([
    /*
     * Product 1:
     * $49 additional activation.
     *
     * We are not using this yet, but the shared commerce
     * infrastructure will be ready for it.
     */
    "product_1_additional_activation",

    /*
     * Product 2:
     * Pay-as-you-go activation and fixed volume packs.
     */
    "product_2_single_activation",
    "product_2_pack_5",
    "product_2_pack_10",
    "product_2_pack_25",
  ]);

function getBearerToken(
  req: Request
): string {
  const authorization =
    req.headers.get(
      "authorization"
    ) || "";

  return authorization.startsWith(
    "Bearer "
  )
    ? authorization
        .slice(
          "Bearer ".length
        )
        .trim()
    : "";
}

function cleanString(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function isPurchaseDefinitionKey(
  value: string
): value is RetailMediaPurchaseDefinitionKey {
  return [
    "product_1_monthly_credit",
    "product_1_additional_activation",
    "product_2_single_activation",
    "product_2_pack_5",
    "product_2_pack_10",
    "product_2_pack_25",
    "product_2_pack_50_plus",
    "enterprise_custom",
  ].includes(value);
}

function dollarsToCents(
  amountUsd: number
): number {
  return Math.round(
    amountUsd * 100
  );
}

export async function POST(
  req: Request
) {
  try {
    /*
     * =====================================================
     * 1. Authenticate Brand
     * =====================================================
     */

    const idToken =
      getBearerToken(req);

    if (!idToken) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    const decodedToken =
      await adminAuth.verifyIdToken(
        idToken
      );

    const brandId =
      decodedToken.uid;

    /*
     * =====================================================
     * 2. Parse requested purchase
     * =====================================================
     */

    const body =
      (await req.json()) as CheckoutBody;

    const rawPurchaseDefinitionKey =
      cleanString(
        body.purchaseDefinitionKey
      );

    if (
      !rawPurchaseDefinitionKey
    ) {
      return NextResponse.json(
        {
          error:
            "Select a Retail Media activation option.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !isPurchaseDefinitionKey(
        rawPurchaseDefinitionKey
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid Retail Media purchase option.",
        },
        {
          status: 400,
        }
      );
    }

    const purchaseDefinitionKey =
      rawPurchaseDefinitionKey;

    /*
     * Only fixed-price options can go through automated
     * Stripe Checkout.
     *
     * Product 1 included monthly credit requires no payment.
     * 50+ Product 2 and Enterprise are custom-priced.
     */
    if (
      !ALLOWED_CHECKOUT_KEYS.has(
        purchaseDefinitionKey
      )
    ) {
      return NextResponse.json(
        {
          error:
            purchaseDefinitionKey ===
              "product_2_pack_50_plus" ||
            purchaseDefinitionKey ===
              "enterprise_custom"
              ? "This Retail Media option requires custom pricing. Please contact Goshsha."
              : "This Retail Media option does not require Stripe Checkout.",
        },
        {
          status: 400,
        }
      );
    }

    const definition =
      getRetailMediaPurchaseDefinition(
        purchaseDefinitionKey
      );

    if (
      !definition.requiresPayment
    ) {
      return NextResponse.json(
        {
          error:
            "This activation entitlement does not require payment.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      definition.customPricing
    ) {
      return NextResponse.json(
        {
          error:
            "This activation option requires custom pricing.",
        },
        {
          status: 400,
        }
      );
    }

    const amountUsd =
      Number(
        definition.amountUsd
      );

    if (
      !Number.isFinite(
        amountUsd
      ) ||
      amountUsd <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Retail Media activation price is invalid.",
        },
        {
          status: 500,
        }
      );
    }

    const amountInCents =
      dollarsToCents(
        amountUsd
      );

    const retailAssetId =
      cleanString(
        body.retailAssetId
      ) || null;

    const campaignId =
      cleanString(
        body.campaignId
      ) || null;

    /*
     * =====================================================
     * 3. Confirm authenticated user is a Brand
     * =====================================================
     */

    const [
      brandSnap,
      userSnap,
    ] =
      await Promise.all([
        adminDb
          .collection("brands")
          .doc(brandId)
          .get(),

        adminDb
          .collection("users")
          .doc(brandId)
          .get(),
      ]);

    const brandData =
      brandSnap.exists
        ? brandSnap.data()
        : null;

    const userData =
      userSnap.exists
        ? userSnap.data()
        : null;

    /*
     * Existing Goshsha Brand records are authoritative.
     * Some older Brand accounts may have their role stored
     * in /users, so retain that compatibility.
     */
    const userRole =
      cleanString(
        userData?.role
      );

    if (
      !brandSnap.exists &&
      userRole !== "brand"
    ) {
      return NextResponse.json(
        {
          error:
            "A Brand account is required to purchase Retail Media activations.",
        },
        {
          status: 403,
        }
      );
    }

    const brandEmail =
      cleanString(
        brandData?.contactEmail
      ) ||
      cleanString(
        brandData?.email
      ) ||
      cleanString(
        userData?.contactEmail
      ) ||
      cleanString(
        userData?.email
      ) ||
      cleanString(
        decodedToken.email
      );

    const brandName =
      cleanString(
        brandData?.brandName
      ) ||
      cleanString(
        brandData?.displayName
      ) ||
      cleanString(
        userData?.brandName
      ) ||
      cleanString(
        userData?.displayName
      ) ||
      "Brand";

    /*
     * =====================================================
     * 4. If a Retail Asset was supplied, verify ownership
     * =====================================================
     *
     * Product 2 will normally create its draft BEFORE
     * payment. This prevents Brands from purchasing an
     * activation for an invalid or unresolved asset.
     */

    if (retailAssetId) {
      const retailAssetSnap =
        await adminDb
          .collection(
            "retailAssets"
          )
          .doc(
            retailAssetId
          )
          .get();

      if (
        !retailAssetSnap.exists
      ) {
        return NextResponse.json(
          {
            error:
              "Retail Media draft not found.",
          },
          {
            status: 404,
          }
        );
      }

      const retailAsset =
        retailAssetSnap.data() as Record<
          string,
          any
        >;

      if (
        cleanString(
          retailAsset.brandId
        ) !== brandId
      ) {
        return NextResponse.json(
          {
            error:
              "You are not authorized to purchase an activation for this Retail Asset.",
          },
          {
            status: 403,
          }
        );
      }

      /*
       * Never charge again for an already-active Retail Asset.
       */
      if (
        retailAsset.activation
          ?.status === "active"
      ) {
        return NextResponse.json(
          {
            error:
              "This Retail Asset is already active.",
          },
          {
            status: 409,
          }
        );
      }
    }

    /*
     * =====================================================
     * 5. Create authoritative commerce record
     * =====================================================
     *
     * PAYMENT IS NOT YET COMPLETE.
     *
     * Stripe webhook confirmation will later move this
     * record from:
     *
     * pending -> paid
     *
     * and create the activation credit(s).
     */

    const commerceId =
      `rmc_${randomUUID()}`;

    const commerceRecord =
      createRetailMediaCommerceRecordDefaults({
        commerceId,

        brandId,

        purchaseDefinitionKey,

        retailAssetId,

        campaignId,

        createdAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      });

    const commerceRef =
      adminDb
        .collection(
          "retailMediaCommerce"
        )
        .doc(
          commerceId
        );

    await commerceRef.set({
      ...commerceRecord,

      brandName,

      brandEmail:
        brandEmail || null,

      /*
       * Helpful immutable purchase snapshot.
       *
       * If pricing changes later, historical purchases
       * still retain exactly what the Brand bought.
       */
      purchaseSnapshot: {
        product:
          definition.product,

        purchaseType:
          definition.purchaseType,

        label:
          definition.label,

        amountUsd,

        currency:
          "USD",

        activationCredits:
          definition.activationCredits,

        entitlement: {
          ...definition.entitlement,
        },

        customPricing:
          definition.customPricing,
      },

      checkoutStatus:
        "creating",

      createdBy:
        brandId,

      createdByRole:
        "brand",
    });

    /*
     * =====================================================
     * 6. Create Stripe Checkout Session
     * =====================================================
     */

    const appUrl =
      process.env
        .NEXT_PUBLIC_APP_URL ||
      "https://irl.goshsha.com";

    const successUrl =
      `${appUrl}/brand/retail-media/direct` +
      `?checkout=success` +
      `&session_id={CHECKOUT_SESSION_ID}` +
      `&commerce_id=${encodeURIComponent(
        commerceId
      )}` +
      (
        retailAssetId
          ? `&retail_asset_id=${encodeURIComponent(
              retailAssetId
            )}`
          : ""
      );

    const cancelUrl =
      `${appUrl}/brand/retail-media/direct` +
      `?checkout=cancelled` +
      `&commerce_id=${encodeURIComponent(
        commerceId
      )}` +
      (
        retailAssetId
          ? `&retail_asset_id=${encodeURIComponent(
              retailAssetId
            )}`
          : ""
      );

    let session;

    try {
      session =
        await stripe.checkout.sessions.create(
          {
            mode:
              "payment",

            payment_method_types: [
              "card",
            ],

            customer_email:
              brandEmail ||
              undefined,

            line_items: [
              {
                quantity: 1,

                price_data: {
                  currency:
                    "usd",

                  unit_amount:
                    amountInCents,

                  product_data: {
                    name:
                      definition.label,

                  description:
                    definition.activationCredits ===
                    1
                      ? "Activate 1 video for 1 product for 90 days, including the first 1,000 qualified views."
                      : `${definition.activationCredits} IRL Retail Media activations. Each activation includes 1 video, 1 product, 90 days, and the first 1,000 qualified views.`,

                    metadata: {
                      goshshaProduct:
                        definition.product,

                      purchaseDefinitionKey,
                    },
                  },
                },
              },
            ],

            metadata: {
              commerceId,

              brandId,

              purchaseDefinitionKey,

              product:
                definition.product,

              purchaseType:
                definition.purchaseType,

              activationCredits:
                String(
                  definition.activationCredits
                ),

              retailAssetId:
                retailAssetId ||
                "",

              campaignId:
                campaignId ||
                "",

              commerceType:
                "retail_media_activation",
            },

            payment_intent_data: {
              metadata: {
                commerceId,

                brandId,

                purchaseDefinitionKey,

                product:
                  definition.product,

                commerceType:
                  "retail_media_activation",
              },
            },

            success_url:
              successUrl,

            cancel_url:
              cancelUrl,
          },
          {
            /*
             * Stable for this particular commerce record.
             *
             * If the Stripe request times out and this route
             * retries internally for the same record, Stripe
             * will not accidentally create duplicate sessions.
             */
            idempotencyKey:
              `retail-media-checkout-${commerceId}`,
          }
        );
    } catch (
      stripeError: any
    ) {
      await commerceRef.update({
        checkoutStatus:
          "failed",

        paymentStatus:
          "failed",

        checkoutLastError:
          String(
            stripeError?.message ||
              "Stripe Checkout creation failed."
          ),

        checkoutFailedAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      });

      throw stripeError;
    }

    /*
     * =====================================================
     * 7. Link Stripe session to commerce record
     * =====================================================
     */

    await commerceRef.update({
      checkoutStatus:
        "open",

      stripeCheckoutSessionId:
        session.id,

      checkoutUrl:
        session.url || null,

      stripeCheckoutCreatedAt:
        FieldValue.serverTimestamp(),

      updatedAt:
        FieldValue.serverTimestamp(),
    });

    /*
     * =====================================================
     * 8. Return Checkout URL
     * =====================================================
     */

    return NextResponse.json({
      ok: true,

      commerceId,

      purchaseDefinitionKey,

      product:
        definition.product,

      purchaseType:
        definition.purchaseType,

      amountUsd,

      activationCredits:
        definition.activationCredits,

      includedQualifiedViewsPerActivation:
        definition.entitlement
          .includedQualifiedViews,

      activationDays:
        definition.entitlement
          .activationDays,

      checkoutSessionId:
        session.id,

      checkoutUrl:
        session.url,
    });
  } catch (err: any) {
    console.error(
      "Create Retail Media activation Checkout error:",
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
        error:
          isInvalidToken
            ? "Your login session expired. Please log in again."
            : err?.message ||
              "Failed to start Retail Media activation checkout.",
      },
      {
        status:
          isInvalidToken
            ? 401
            : 500,
      }
    );
  }
}