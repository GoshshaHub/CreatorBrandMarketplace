import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  adminAuth,
  adminDb,
} from "../../../../../lib/firebase-admin";

/*
 * =========================================================
 * Product 2 — Retail Media Activation Status
 * =========================================================
 *
 * This endpoint answers:
 *
 * - Does the Retail Asset belong to this Brand?
 * - Was a Retail Media purchase completed?
 * - Did the Stripe webhook fulfill it?
 * - Was an activation credit issued?
 * - Is that credit still available?
 *
 * IMPORTANT:
 *
 * The browser query string:
 *
 *   ?checkout=success
 *
 * is NOT payment authority.
 *
 * Firestore commerce + webhook fulfillment are authoritative.
 */

function cleanString(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function getBearerToken(
  request: Request
): string {
  const authorization =
    request.headers.get(
      "authorization"
    ) || "";

  if (
    !authorization.startsWith(
      "Bearer "
    )
  ) {
    return "";
  }

  return authorization
    .slice(
      "Bearer ".length
    )
    .trim();
}

export async function GET(
  request: NextRequest
) {
  try {
    /*
     * =====================================================
     * 1. Authenticate Brand
     * =====================================================
     */

    const idToken =
      getBearerToken(
        request
      );

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
     * 2. Read Retail Asset ID
     * =====================================================
     */

    const retailAssetId =
      cleanString(
        request.nextUrl
          .searchParams
          .get(
            "retailAssetId"
          )
      );

    if (!retailAssetId) {
      return NextResponse.json(
        {
          error:
            "retailAssetId is required.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * 3. Verify Retail Asset ownership
     * =====================================================
     */

    const retailAssetRef =
      adminDb
        .collection(
          "retailAssets"
        )
        .doc(
          retailAssetId
        );

    const retailAssetSnap =
      await retailAssetRef.get();

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
            "You do not have permission to view this Retail Media activation.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * This endpoint is specifically for Product 2.
     */
    const commercialProduct =
      cleanString(
        retailAsset
          .commercialSource
          ?.product ||
        retailAsset
          .monetization
          ?.product ||
        retailAsset
          .audit
          ?.sourceProduct
      );

    const isProduct2 =
      commercialProduct ===
        "product_2" ||
      retailAsset.campaignId ==
        null;

    if (!isProduct2) {
      return NextResponse.json(
        {
          error:
            "This Retail Asset is not a Product 2 direct activation.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * =====================================================
     * 4. Find commerce purchase attached to this asset
     * =====================================================
     *
     * We intentionally query by Retail Asset instead of
     * trusting a commerceId received from the browser.
     */

    const commerceSnapshot =
      await adminDb
        .collection(
          "retailMediaCommerce"
        )
        .where(
          "retailAssetId",
          "==",
          retailAssetId
        )
        .get();

    if (
      commerceSnapshot.empty
    ) {
      return NextResponse.json({
        ok: true,

        retailAssetId,

        payment: {
          status:
            "not_started",

          paid:
            false,

          commerceId:
            null,

          fulfillmentStatus:
            "not_started",
        },

        credit: {
          issued:
            false,

          available:
            false,

          creditId:
            null,

          status:
            null,
        },

        activation: {
          canPublish:
            false,

          status:
            retailAsset
              .activation
              ?.status ||
            "draft",

          startsAt:
            retailAsset
              .activation
              ?.startsAt ||
            null,

          endsAt:
            retailAsset
              .activation
              ?.endsAt ||
            null,
        },

        distribution: {
          published:
            retailAsset
              .distribution
              ?.publishedToPlaylist ===
            true,

          status:
            retailAsset
              .distribution
              ?.status ||
            "draft",
        },
      });
    }

    /*
     * =====================================================
     * 5. Select the authoritative purchase
     * =====================================================
     *
     * There may be an abandoned Checkout record followed by
     * a later successful attempt.
     *
     * Prefer:
     *
     *   paid + fulfilled
     *
     * over:
     *
     *   pending / cancelled / failed
     */

    const commerceRecords =
      commerceSnapshot.docs.map(
        (doc) => ({
          id:
            doc.id,

          ...doc.data(),
        })
      ) as Array<
        Record<
          string,
          any
        >
      >;

    const paidCommerce =
      commerceRecords.find(
        (commerce) =>
          commerce.paymentStatus ===
            "paid" &&
          commerce.fulfillmentStatus ===
            "fulfilled"
      );

    /*
     * If payment has not completed, use the most relevant
     * existing Checkout record for status display.
     */
    const commerce =
      paidCommerce ||
      commerceRecords.find(
        (record) =>
          record.checkoutStatus ===
          "open"
      ) ||
      commerceRecords[
        commerceRecords.length -
          1
      ];

    const commerceId =
      cleanString(
        commerce?.commerceId ||
        commerce?.id
      );

    const paymentStatus =
      cleanString(
        commerce?.paymentStatus
      ) ||
      "pending";

    const fulfillmentStatus =
      cleanString(
        commerce
          ?.fulfillmentStatus
      ) ||
      "pending";

    const paymentPaid =
      paymentStatus ===
        "paid" &&
      fulfillmentStatus ===
        "fulfilled";

    /*
     * =====================================================
     * 6. Resolve issued activation credit
     * =====================================================
     */

    const activationCreditIds =
      Array.isArray(
        commerce
          ?.activationCreditIds
      )
        ? commerce.activationCreditIds
            .map(
              cleanString
            )
            .filter(Boolean)
        : [];

    /*
     * Product 2 single activation should normally have
     * exactly one credit.
     *
     * We still tolerate the generic commerce structure.
     */

    let credit:
      Record<
        string,
        any
      > | null =
      null;

    let creditId:
      string | null =
      null;

    for (
      const candidateCreditId of
      activationCreditIds
    ) {
      const creditSnapshot =
        await adminDb
          .collection(
            "retailMediaActivationCredits"
          )
          .doc(
            candidateCreditId
          )
          .get();

      if (
        !creditSnapshot.exists
      ) {
        continue;
      }

      const candidate =
        creditSnapshot.data() as Record<
          string,
          any
        >;

      /*
       * Never expose another Brand's credit.
       */
      if (
        cleanString(
          candidate.brandId
        ) !== brandId
      ) {
        continue;
      }

      /*
       * Prefer the credit specifically associated with
       * this Retail Asset.
       */
      const candidateAssetId =
        cleanString(
          candidate
            .retailAssetId
        );

      if (
        candidateAssetId &&
        candidateAssetId !==
          retailAssetId
      ) {
        continue;
      }

      credit =
        candidate;

      creditId =
        candidateCreditId;

      break;
    }

    /*
     * Defensive fallback:
     *
     * Older/newer fulfillment logic may have stored the
     * credit ID directly on the commerce record.
     */

    if (
      !credit &&
      commerce
        ?.activationCreditId
    ) {
      const fallbackCreditId =
        cleanString(
          commerce
            .activationCreditId
        );

      if (
        fallbackCreditId
      ) {
        const fallbackSnapshot =
          await adminDb
            .collection(
              "retailMediaActivationCredits"
            )
            .doc(
              fallbackCreditId
            )
            .get();

        if (
          fallbackSnapshot.exists
        ) {
          const fallbackCredit =
            fallbackSnapshot.data() as Record<
              string,
              any
            >;

          if (
            cleanString(
              fallbackCredit
                .brandId
            ) === brandId
          ) {
            credit =
              fallbackCredit;

            creditId =
              fallbackCreditId;
          }
        }
      }
    }

    const creditStatus =
      cleanString(
        credit?.status
      ) ||
      null;

    const creditIssued =
      Boolean(
        creditId &&
        credit
      );

    /*
     * Before publication, the credit should normally be:
     *
     * available
     *
     * Later we will atomically transition:
     *
     * available
     *     ↓
     * consumed
     *
     * during publication.
     */

    const creditAvailable =
      creditIssued &&
      creditStatus ===
        "available";

    const alreadyPublished =
      retailAsset
        .distribution
        ?.publishedToPlaylist ===
        true &&
      retailAsset
        .activation
        ?.status ===
        "active";

    /*
     * An already-published asset remains valid even though
     * its credit will eventually be marked consumed.
     */
    const canPublish =
      alreadyPublished ||
      (
        paymentPaid &&
        creditAvailable
      );

    /*
     * =====================================================
     * 7. Return authoritative status
     * =====================================================
     */

    return NextResponse.json({
      ok:
        true,

      retailAssetId,

      product:
        "product_2",

      payment: {
        status:
          paymentStatus,

        paid:
          paymentPaid,

        commerceId:
          commerceId ||
          null,

        fulfillmentStatus,

        checkoutStatus:
          cleanString(
            commerce
              ?.checkoutStatus
          ) ||
          null,

        amountUsd:
          commerce
            ?.purchaseSnapshot
            ?.amountUsd ??
          commerce
            ?.amountUsd ??
          99,

        currency:
          commerce
            ?.currency ||
          "USD",

        stripeCheckoutSessionId:
          cleanString(
            commerce
              ?.stripeCheckoutSessionId
          ) ||
          null,
      },

      credit: {
        issued:
          creditIssued,

        available:
          creditAvailable,

        creditId,

        status:
          creditStatus,

        includedQualifiedViews:
          credit
            ?.entitlement
            ?.includedQualifiedViews ??
          commerce
            ?.includedQualifiedViews ??
          1000,

        activationDays:
          credit
            ?.entitlement
            ?.activationDays ??
          commerce
            ?.activationDays ??
          90,
      },

      activation: {
        canPublish,

        alreadyPublished,

        status:
          retailAsset
            .activation
            ?.status ||
          "draft",

        startsAt:
          retailAsset
            .activation
            ?.startsAt ||
          null,

        endsAt:
          retailAsset
            .activation
            ?.endsAt ||
          null,
      },

      distribution: {
        published:
          retailAsset
            .distribution
            ?.publishedToPlaylist ===
          true,

        status:
          retailAsset
            .distribution
            ?.status ||
          "draft",

        masterPlaylistId:
          cleanString(
            retailAsset
              .distribution
              ?.masterPlaylistId ||
            retailAsset
              .masterPlaylistId
          ) ||
          null,
      },

      /*
       * Useful simple state for the Product 2 UI.
       */
      state:
        alreadyPublished
          ? "active"
          : paymentPaid &&
            creditAvailable
          ? "ready_to_publish"
          : paymentPaid &&
            !creditIssued
          ? "payment_confirmed_waiting_for_credit"
          : paymentStatus ===
            "paid"
          ? "payment_processing"
          : paymentStatus ===
            "failed"
          ? "payment_failed"
          : "payment_required",
    });
  } catch (
    error: any
  ) {
    console.error(
      "Product 2 activation status error:",
      error
    );

    const authenticationError =
      error?.code ===
        "auth/id-token-expired" ||
      error?.code ===
        "auth/invalid-id-token" ||
      error?.code ===
        "auth/argument-error";

    return NextResponse.json(
      {
        error:
          authenticationError
            ? "Your login session expired. Please log in again."
            : error?.message ||
              "Failed to load Retail Media activation status.",
      },
      {
        status:
          authenticationError
            ? 401
            : 500,
      }
    );
  }
}