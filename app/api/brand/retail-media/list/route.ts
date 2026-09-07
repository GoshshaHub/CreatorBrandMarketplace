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
 * IRL Retail Media — Brand Library
 * =========================================================
 *
 * Returns Product 2 Retail Assets owned by the
 * authenticated Brand.
 *
 * retailAssets remains the permanent source of truth.
 *
 * This route does NOT:
 *
 * - create Retail Assets
 * - modify Retail Assets
 * - create AR Entries
 * - publish content
 * - consume activation credits
 * - change the iOS / Master Playlist architecture
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

function serializeTimestamp(
  value: any
): string | null {
  if (!value) {
    return null;
  }

  /*
   * Firebase Admin Timestamp
   */
  if (
    typeof value.toDate ===
    "function"
  ) {
    try {
      return value
        .toDate()
        .toISOString();
    } catch {
      return null;
    }
  }

  /*
   * Already a Date
   */
  if (value instanceof Date) {
    return value.toISOString();
  }

  /*
   * Already serialized
   */
  if (
    typeof value === "string"
  ) {
    return value;
  }

  return null;
}

type LibraryState =
  | "active"
  | "expired"
  | "ready_to_publish"
  | "payment_processing"
  | "payment_required";

function getLibraryState(
  asset: Record<string, any>
): LibraryState {
  const activationStatus =
    cleanString(
      asset.activation?.status
    ).toLowerCase();

  const distributionPublished =
    asset.distribution
      ?.publishedToPlaylist === true;

  /*
   * Active takes priority.
   */
  if (
    activationStatus ===
      "active" &&
    distributionPublished
  ) {
    return "active";
  }

  /*
   * Future-proof expired state.
   */
  if (
    activationStatus ===
      "expired" ||
    asset.activation?.expiredAt
  ) {
    return "expired";
  }

  const commerceStatus =
    cleanString(
      asset.monetization
        ?.commerceStatus
    ).toLowerCase();

  const paymentStatus =
    cleanString(
      asset.monetization
        ?.paymentStatus
    ).toLowerCase();

  const activationCreditId =
    cleanString(
      asset.monetization
        ?.activationCreditId
    );

  /*
   * A paid asset with an issued credit can proceed
   * to publication.
   */
  if (
    (
      paymentStatus === "paid" ||
      commerceStatus === "paid" ||
      commerceStatus ===
        "fulfilled"
    ) &&
    activationCreditId
  ) {
    return "ready_to_publish";
  }

  /*
   * Payment may be complete while webhook fulfillment
   * is still catching up.
   */
  if (
    paymentStatus === "paid" ||
    commerceStatus ===
      "processing" ||
    commerceStatus ===
      "pending_fulfillment"
  ) {
    return "payment_processing";
  }

  return "payment_required";
}

function stateLabel(
  state: LibraryState
): string {
  switch (state) {
    case "active":
      return "Active & Scan-Ready";

    case "expired":
      return "Expired";

    case "ready_to_publish":
      return "Ready to Publish";

    case "payment_processing":
      return "Confirming Payment";

    default:
      return "Payment Required";
  }
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
      getBearerToken(request);

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
     * 2. Load Brand-owned Retail Assets
     * =====================================================
     *
     * Only query by brandId here.
     *
     * We deliberately avoid adding orderBy or another
     * Firestore condition so this route does not require
     * a new composite index.
     */

    const snapshot =
      await adminDb
        .collection(
          "retailAssets"
        )
        .where(
          "brandId",
          "==",
          brandId
        )
        .get();

    /*
     * =====================================================
     * 3. Keep Product 2 only
     * =====================================================
     */

    const assets =
      snapshot.docs
        .map((document) => {
          const asset =
            document.data() as Record<
              string,
              any
            >;

          const commercialProduct =
            cleanString(
              asset
                .commercialSource
                ?.product ||
              asset
                .monetization
                ?.product ||
              asset
                .audit
                ?.sourceProduct
            );

          const isProduct2 =
            commercialProduct ===
              "product_2" ||
            (
              asset.campaignId ==
                null &&
              asset.sourceProduct ===
                "retail_media"
            );

          if (!isProduct2) {
            return null;
          }

          const state =
            getLibraryState(
              asset
            );

          return {
            retailAssetId:
              document.id,

            brandName:
              cleanString(
                asset.brandName
              ),

            productName:
              cleanString(
                asset.productName ||
                asset.recognition
                  ?.productName
              ),

            canonicalName:
              cleanString(
                asset.recognition
                  ?.canonicalName
              ),

            state,

            stateLabel:
              stateLabel(state),

            targetImage: {
              url:
                cleanString(
                  asset.targetImage
                    ?.url
                ) || null,
            },

            activation: {
              status:
                cleanString(
                  asset.activation
                    ?.status
                ) ||
                "draft",

              startsAt:
                serializeTimestamp(
                  asset.activation
                    ?.startsAt
                ),

              endsAt:
                serializeTimestamp(
                  asset.activation
                    ?.endsAt
                ),

              publishedAt:
                serializeTimestamp(
                  asset.activation
                    ?.publishedAt
                ),

              expiredAt:
                serializeTimestamp(
                  asset.activation
                    ?.expiredAt
                ),
            },

            distribution: {
              published:
                asset.distribution
                  ?.publishedToPlaylist ===
                true,

              status:
                cleanString(
                  asset.distribution
                    ?.status
                ) ||
                "draft",
            },

            metrics: {
              qualifiedViews:
                Number(
                  asset.metrics
                    ?.qualifiedViews ||
                    0
                ),

              views:
                Number(
                  asset.metrics
                    ?.views ||
                    0
                ),
            },

            commerce: {
              paymentStatus:
                cleanString(
                  asset.monetization
                    ?.paymentStatus
                ) ||
                "pending",

              commerceStatus:
                cleanString(
                  asset.monetization
                    ?.commerceStatus
                ) ||
                "unpaid",

              priceUsd:
                Number(
                  asset.monetization
                    ?.activationPriceUsd ??
                    99
                ),

              includedQualifiedViews:
                Number(
                  asset.monetization
                    ?.includedQualifiedViews ??
                    1000
                ),
            },

            createdAt:
              serializeTimestamp(
                asset.createdAt ||
                  asset.audit
                    ?.createdAt
              ),

            updatedAt:
              serializeTimestamp(
                asset.updatedAt ||
                  asset.audit
                    ?.updatedAt
              ),
          };
        })
        .filter(
          (
            asset
          ): asset is NonNullable<
            typeof asset
          > => Boolean(asset)
        );

    /*
     * Newest first.
     *
     * Sorting happens in memory so Firestore does not
     * require a brandId + createdAt composite index.
     */
    assets.sort(
      (first, second) => {
        const firstTime =
          first.createdAt
            ? new Date(
                first.createdAt
              ).getTime()
            : 0;

        const secondTime =
          second.createdAt
            ? new Date(
                second.createdAt
              ).getTime()
            : 0;

        return (
          secondTime -
          firstTime
        );
      }
    );

    /*
     * =====================================================
     * 4. Library summary
     * =====================================================
     */

    const summary = {
      total:
        assets.length,

      active:
        assets.filter(
          (asset) =>
            asset.state ===
            "active"
        ).length,

      readyToPublish:
        assets.filter(
          (asset) =>
            asset.state ===
            "ready_to_publish"
        ).length,

      paymentRequired:
        assets.filter(
          (asset) =>
            asset.state ===
            "payment_required"
        ).length,

      paymentProcessing:
        assets.filter(
          (asset) =>
            asset.state ===
            "payment_processing"
        ).length,

      expired:
        assets.filter(
          (asset) =>
            asset.state ===
            "expired"
        ).length,
    };

    return NextResponse.json({
      ok: true,

      summary,

      assets,
    });
  } catch (error: any) {
    console.error(
      "IRL Retail Media library error:",
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
              "Failed to load your Retail Media.",
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