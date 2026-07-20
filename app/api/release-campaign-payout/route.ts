import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
} from "../../../lib/firebase-admin";

import { sendEmail } from "../../../lib/postmark";
import { stripe } from "../../../lib/stripe";

type ReleasePayoutBody = {
  campaignId?: string;
};

function cleanString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function getBearerToken(req: Request): string {
  const authorization =
    req.headers.get("authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return "";
  }

  return authorization
    .slice("Bearer ".length)
    .trim();
}

async function verifyAdminAuthorization(req: Request) {
  const idToken =
    getBearerToken(req);

  if (!idToken) {
    throw new Error(
      "AUTHENTICATION_REQUIRED"
    );
  }

  const decodedToken =
    await adminAuth.verifyIdToken(
      idToken
    );

  const authenticatedUid =
    decodedToken.uid;

  /*
   * Support either a Firebase custom claim or
   * an Admin role stored in the users collection.
   */
  const hasAdminClaim =
    decodedToken.admin === true ||
    decodedToken.role === "admin";

  if (hasAdminClaim) {
    return authenticatedUid;
  }

  const userSnap =
    await adminDb
      .collection("users")
      .doc(authenticatedUid)
      .get();

  const userData =
    userSnap.exists
      ? userSnap.data()
      : null;

  if (
    userData?.role !== "admin" &&
    userData?.isAdmin !== true
  ) {
    throw new Error(
      "ADMIN_AUTHORIZATION_REQUIRED"
    );
  }

  return authenticatedUid;
}

export async function POST(req: Request) {
  try {
    const adminUserId =
      await verifyAdminAuthorization(
        req
      );

    const body =
      (await req.json()) as ReleasePayoutBody;

    const campaignId =
      cleanString(
        body.campaignId
      );

    if (!campaignId) {
      return NextResponse.json(
        {
          error:
            "Missing campaignId.",
        },
        {
          status: 400,
        }
      );
    }

    const appUrl =
      process.env
        .NEXT_PUBLIC_APP_URL ||
      "https://irl.goshsha.com";

    const creatorCampaignUrl =
      `${appUrl}/creator/campaign/${campaignId}`;

    const creatorProfileUrl =
      `${appUrl}/creator/profile`;

    const brandCampaignUrl =
      `${appUrl}/brand/campaign/${campaignId}`;

    const loginUrl =
      `${appUrl}/login`;

    const campaignRef =
      adminDb
        .collection("campaigns")
        .doc(campaignId);

    const campaignSnap =
      await campaignRef.get();

    if (!campaignSnap.exists) {
      return NextResponse.json(
        {
          error:
            "Campaign not found.",
        },
        {
          status: 404,
        }
      );
    }

    const campaign =
      campaignSnap.data() as Record<
        string,
        any
      >;

    /*
     * Idempotent success for a payout that was
     * previously completed.
     */
    if (
      campaign.payoutStatus ===
      "released"
    ) {
      return NextResponse.json({
        ok: true,
        alreadyReleased: true,
        transferId:
          campaign.stripeTransferId ||
          null,
        amount:
          Number(
            campaign.creatorPayoutAmount ||
              0
          ),
        message:
          "Payout was already released.",
      });
    }

    /*
     * Admin may only release payouts that passed
     * Brand approval and are explicitly ready.
     */
    if (
      campaign.status !==
        "approved" ||
      campaign.brandApprovalStatus !==
        "approved" ||
      campaign.payoutStatus !==
        "ready_to_release"
    ) {
      return NextResponse.json(
        {
          error:
            "This campaign is not ready for payout release.",
        },
        {
          status: 409,
        }
      );
    }

    if (
      !campaign
        .brandApprovalSnapshot
    ) {
      return NextResponse.json(
        {
          error:
            "The frozen Brand approval snapshot is missing. Review the campaign before releasing payout.",
        },
        {
          status: 409,
        }
      );
    }

    const creatorId =
      cleanString(
        campaign.creatorId
      );

    if (!creatorId) {
      return NextResponse.json(
        {
          error:
            "Campaign Creator ID is missing.",
        },
        {
          status: 400,
        }
      );
    }

    const creatorPayoutAmount =
      Number(
        campaign.creatorPayoutAmount ||
          0
      );

    if (
      !Number.isFinite(
        creatorPayoutAmount
      ) ||
      creatorPayoutAmount <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Creator payout amount is missing or invalid.",
        },
        {
          status: 400,
        }
      );
    }

    const [
      userCreatorSnap,
      legacyCreatorSnap,
    ] =
      await Promise.all([
        adminDb
          .collection("users")
          .doc(creatorId)
          .get(),

        adminDb
          .collection("creators")
          .doc(creatorId)
          .get(),
      ]);

    const userCreator =
      userCreatorSnap.exists
        ? userCreatorSnap.data()
        : null;

    const legacyCreator =
      legacyCreatorSnap.exists
        ? legacyCreatorSnap.data()
        : null;

    const creatorEmail =
      userCreator?.contactEmail ||
      userCreator?.email ||
      legacyCreator?.contactEmail ||
      legacyCreator?.email ||
      campaign.creatorEmail ||
      "";

    const stripeAccountId =
      userCreator?.stripeAccountId ||
      userCreator
        ?.stripeConnectedAccountId ||
      legacyCreator?.stripeAccountId ||
      legacyCreator
        ?.stripeConnectedAccountId ||
      campaign
        .creatorStripeAccountId ||
      "";

    if (!stripeAccountId) {
      return NextResponse.json(
        {
          error:
            "Creator Stripe account not found. The Creator must complete Stripe setup before payout can be released.",
        },
        {
          status: 400,
        }
      );
    }

    const stripeAccount =
      await stripe.accounts.retrieve(
        stripeAccountId
      );

    if (
      !stripeAccount.details_submitted ||
      !stripeAccount.payouts_enabled
    ) {
      return NextResponse.json(
        {
          error:
            "Creator Stripe setup is incomplete. Ask the Creator to finish Stripe onboarding.",
        },
        {
          status: 400,
        }
      );
    }

    const amountInCents =
      Math.round(
        creatorPayoutAmount * 100
      );

    /*
     * Mark the payout as processing before calling Stripe.
     *
     * The transaction prevents two simultaneous Admin requests
     * from both beginning a payout operation.
     */
    await adminDb.runTransaction(
      async (transaction) => {
        const freshCampaignSnap =
          await transaction.get(
            campaignRef
          );

        if (
          !freshCampaignSnap.exists
        ) {
          throw new Error(
            "CAMPAIGN_NOT_FOUND"
          );
        }

        const freshCampaign =
          freshCampaignSnap.data() as Record<
            string,
            any
          >;

        if (
          freshCampaign.payoutStatus ===
          "released"
        ) {
          throw new Error(
            "PAYOUT_ALREADY_RELEASED"
          );
        }

        if (
          freshCampaign.payoutStatus ===
            "processing" &&
          freshCampaign
            .payoutProcessingStartedAt
        ) {
          throw new Error(
            "PAYOUT_ALREADY_PROCESSING"
          );
        }

        if (
          freshCampaign.payoutStatus !==
            "ready_to_release" ||
          freshCampaign
            .brandApprovalStatus !==
            "approved"
        ) {
          throw new Error(
            "PAYOUT_NOT_READY"
          );
        }

        transaction.update(
          campaignRef,
          {
            payoutStatus:
              "processing",

            payoutReleaseStatus:
              "processing",

            payoutProcessingStartedAt:
              FieldValue.serverTimestamp(),

            payoutProcessingStartedBy:
              adminUserId,

            payoutLastError:
              FieldValue.delete(),

            updatedAt:
              FieldValue.serverTimestamp(),
          }
        );
      }
    );

    let transfer;

    try {
      /*
       * The stable idempotency key ensures retries for this
       * campaign reuse the same Stripe transfer operation.
       */
      transfer =
        await stripe.transfers.create(
          {
            amount:
              amountInCents,

            currency:
              "usd",

            destination:
              stripeAccountId,

            description:
              `Goshsha Creator payout: ${
                campaign.campaignTitle ||
                campaignId
              }`,

            metadata: {
              campaignId,

              creatorId,

              brandId:
                cleanString(
                  campaign.brandId
                ),

              payoutType:
                "creator_campaign_payout",
            },
          },
          {
            idempotencyKey:
              `campaign-payout-${campaignId}`,
          }
        );
    } catch (stripeError: any) {
      /*
       * Restore the payout to ready state if Stripe fails,
       * allowing Admin to retry safely.
       */
      await campaignRef.update({
        payoutStatus:
          "ready_to_release",

        payoutReleaseStatus:
          "failed",

        payoutLastError:
          String(
            stripeError?.message ||
              "Stripe transfer failed."
          ),

        payoutLastFailedAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      });

      throw stripeError;
    }

    /*
     * Complete only the Creator transaction.
     *
     * Do not update:
     * - AR Entry fields
     * - Retail Asset fields
     * - activation dates
     * - license startsAt
     * - license expiresAt
     */
    await campaignRef.update({
      status:
        "completed",

      completionStatus:
        "creator_transaction_completed",

      payoutStatus:
        "released",

      payoutReleaseStatus:
        "released",

      payoutReleasedAt:
        FieldValue.serverTimestamp(),

      payoutReleasedBy:
        adminUserId,

      creatorTransactionCompletedAt:
        FieldValue.serverTimestamp(),

      stripeTransferId:
        transfer.id,

      stripeTransferAmount:
        creatorPayoutAmount,

      stripeTransferAmountCents:
        amountInCents,

      stripeTransferCurrency:
        transfer.currency,

      stripeTransferDestination:
        stripeAccountId,

      payoutProcessingStartedAt:
        FieldValue.delete(),

      payoutLastError:
        FieldValue.delete(),

      updatedAt:
        FieldValue.serverTimestamp(),
    });

    /*
     * Notification failures should not undo a successful
     * Stripe payout.
     */
    try {
      await Promise.all([
        adminDb
          .collection(
            "notifications"
          )
          .add({
            userId:
              creatorId,

            role:
              "creator",

            type:
              "payout_released",

            title:
              "Payout released",

            message:
              `Your payout for "${
                campaign.campaignTitle ||
                "your campaign"
              }" has been released.`,

            campaignId,

            read:
              false,

            isRead:
              false,

            createdAt:
              FieldValue.serverTimestamp(),

            updatedAt:
              FieldValue.serverTimestamp(),
          }),

        campaign.brandId
          ? adminDb
              .collection(
                "notifications"
              )
              .add({
                userId:
                  campaign.brandId,

                role:
                  "brand",

                type:
                  "creator_transaction_completed",

                title:
                  "Creator payout released",

                message:
                  `The Creator payout for "${
                    campaign.campaignTitle ||
                    "your campaign"
                  }" has been released. Retail Media activation remains a separate step.`,

                campaignId,

                read:
                  false,

                isRead:
                  false,

                createdAt:
                  FieldValue.serverTimestamp(),

                updatedAt:
                  FieldValue.serverTimestamp(),
              })
          : Promise.resolve(),
      ]);
    } catch (
      notificationError
    ) {
      console.error(
        "Payout succeeded, but notification creation failed:",
        notificationError
      );
    }

    if (creatorEmail) {
      try {
        await sendEmail({
          to:
            creatorEmail,

          subject:
            "Payout released",

          htmlBody: `
            <h2>Payout released</h2>

            <p>
              Your payout for
              <strong>${
                campaign.campaignTitle ||
                "your campaign"
              }</strong>
              has been released.
            </p>

            <p>
              <strong>Amount:</strong>
              $${creatorPayoutAmount.toFixed(
                2
              )}
            </p>

            <p>
              <strong>Stripe transfer ID:</strong>
              ${transfer.id}
            </p>

            <p>
              This completes the Creator payment portion of the campaign.
              Retail Media activation and the initial 90-day license are
              handled separately.
            </p>

            <p>
              <a href="${creatorCampaignUrl}">
                View campaign
              </a>
            </p>

            <p>
              <a href="${creatorProfileUrl}">
                Manage payout account
              </a>
            </p>

            <p>
              <a href="${loginUrl}">
                Log in to Goshsha IRL Campaign Network
              </a>
            </p>
          `,

          textBody: `
Payout released.

Your payout for ${
            campaign.campaignTitle ||
            "your campaign"
          } has been released.

Amount: $${creatorPayoutAmount.toFixed(
            2
          )}
Stripe transfer ID: ${transfer.id}

This completes the Creator payment portion of the campaign.

Retail Media activation and the initial 90-day license are handled separately.

View campaign:
${creatorCampaignUrl}

Manage payout account:
${creatorProfileUrl}

Log in:
${loginUrl}
          `.trim(),
        });
      } catch (
        creatorEmailError
      ) {
        console.error(
          "Payout succeeded, but Creator email failed:",
          creatorEmailError
        );
      }
    }

    if (campaign.brandId) {
      try {
        const brandSnap =
          await adminDb
            .collection("brands")
            .doc(
              campaign.brandId
            )
            .get();

        const brand =
          brandSnap.exists
            ? brandSnap.data()
            : null;

        const brandEmail =
          brand?.contactEmail ||
          brand?.email ||
          campaign.contactEmail ||
          campaign.brandEmail ||
          "";

        if (brandEmail) {
          await sendEmail({
            to:
              brandEmail,

            subject:
              `Creator payout released: ${
                campaign.campaignTitle ||
                "Campaign"
              }`,

            htmlBody: `
              <h2>Creator payout released</h2>

              <p>
                The Creator transaction for your campaign has been completed.
              </p>

              <p>
                <strong>Campaign:</strong>
                ${
                  campaign.campaignTitle ||
                  "Campaign"
                }
              </p>

              <p>
                <strong>Creator:</strong>
                ${
                  campaign.creatorHandle ||
                  "Creator"
                }
              </p>

              <p>
                <strong>Creator payout:</strong>
                $${creatorPayoutAmount.toFixed(
                  2
                )}
              </p>

              <p>
                The payout was successfully released through Stripe.
              </p>

              <p>
                Retail Media activation is a separate workflow. The content
                has not been activated through this payout action, and the
                initial 90-day license has not started.
              </p>

              <p>
                <a href="${brandCampaignUrl}">
                  View campaign
                </a>
              </p>

              <p>
                <a href="${loginUrl}">
                  Log in to Goshsha IRL Campaign Network
                </a>
              </p>
            `,

            textBody: `
Creator payout released.

The Creator transaction for your campaign has been completed.

Campaign:
${campaign.campaignTitle || "Campaign"}

Creator:
${campaign.creatorHandle || "Creator"}

Creator payout:
$${creatorPayoutAmount.toFixed(2)}

The payout was successfully released through Stripe.

Retail Media activation is a separate workflow. The content was not activated by this payout action, and the initial 90-day license has not started.

View campaign:
${brandCampaignUrl}

Log in:
${loginUrl}
            `.trim(),
          });
        }
      } catch (
        brandEmailError
      ) {
        console.error(
          "Payout succeeded, but Brand email failed:",
          brandEmailError
        );
      }
    }

    return NextResponse.json({
      ok: true,

      alreadyReleased:
        false,

      transferId:
        transfer.id,

      amount:
        creatorPayoutAmount,

      payoutStatus:
        "released",

      completionStatus:
        "creator_transaction_completed",

      retailMediaStatus:
        "not_activated",

      licenseStarted:
        false,
    });
  } catch (err: any) {
    console.error(
      "Release campaign payout error:",
      err
    );

    const errorMessage =
      String(
        err?.message || ""
      );

    if (
      errorMessage ===
      "AUTHENTICATION_REQUIRED"
    ) {
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

    if (
      errorMessage ===
      "ADMIN_AUTHORIZATION_REQUIRED"
    ) {
      return NextResponse.json(
        {
          error:
            "Admin authorization required.",
        },
        {
          status: 403,
        }
      );
    }

    if (
      errorMessage ===
      "CAMPAIGN_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          error:
            "Campaign not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      errorMessage ===
      "PAYOUT_ALREADY_RELEASED"
    ) {
      return NextResponse.json({
        ok: true,
        alreadyReleased:
          true,
        message:
          "Payout was already released.",
      });
    }

    if (
      errorMessage ===
      "PAYOUT_ALREADY_PROCESSING"
    ) {
      return NextResponse.json(
        {
          error:
            "This payout is already being processed. Wait a moment before trying again.",
        },
        {
          status: 409,
        }
      );
    }

    if (
      errorMessage ===
      "PAYOUT_NOT_READY"
    ) {
      return NextResponse.json(
        {
          error:
            "This payout is not ready to be released.",
        },
        {
          status: 409,
        }
      );
    }

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
            : errorMessage ||
              "Failed to release campaign payout.",
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