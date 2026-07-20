import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
} from "../../../lib/firebase-admin";

import { sendEmail } from "../../../lib/postmark";

type ApprovalBody = {
  campaignId?: string;
};

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

function isValidHttpUrl(value: unknown): boolean {
  const cleanedValue =
    typeof value === "string"
      ? value.trim()
      : "";

  if (!cleanedValue) {
    return false;
  }

  try {
    const parsedUrl =
      new URL(cleanedValue);

    return (
      parsedUrl.protocol === "https:" ||
      parsedUrl.protocol === "http:"
    );
  } catch {
    return false;
  }
}

function cleanString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

export async function POST(req: Request) {
  try {
    /*
     * Require Brand authentication.
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

    const authenticatedUid =
      decodedToken.uid;

    const body =
      (await req.json()) as ApprovalBody;

    const campaignId =
      cleanString(body.campaignId);

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

    const adminReviewUrl =
      `${appUrl}/admin/review`;

    const campaignRef =
      adminDb
        .collection("campaigns")
        .doc(campaignId);

    /*
     * Validate and approve inside a transaction so the
     * submission cannot change between validation and approval.
     */
    const approvalResult =
      await adminDb.runTransaction(
        async (transaction) => {
          const campaignSnap =
            await transaction.get(
              campaignRef
            );

          if (!campaignSnap.exists) {
            throw new Error(
              "CAMPAIGN_NOT_FOUND"
            );
          }

          const campaign =
            campaignSnap.data() as Record<
              string,
              any
            >;

          /*
           * Only the Brand that owns this campaign
           * can approve the submission.
           */
          if (
            !campaign.brandId ||
            campaign.brandId !==
              authenticatedUid
          ) {
            throw new Error(
              "NOT_CAMPAIGN_BRAND"
            );
          }

          /*
           * Make repeated requests safely idempotent.
           */
          if (
            campaign.brandApprovalStatus ===
              "approved" &&
            campaign.status ===
              "approved"
          ) {
            return {
              campaign,
              alreadyApproved: true,
            };
          }

          if (
            campaign.status !==
              "submitted" ||
            campaign.brandApprovalStatus !==
              "pending"
          ) {
            throw new Error(
              "CAMPAIGN_NOT_READY"
            );
          }

          const creatorSubmission =
            campaign.creatorSubmission ||
            {};

          const rightsCertification =
            campaign
              .creatorRightsCertification ||
            {};

          const licenseCertification =
            campaign
              .creatorLicenseCertification ||
            {};

          const submittedPostUrl =
            cleanString(
              creatorSubmission
                .publicPostUrl ||
                campaign
                  .normalizedArContentUrl ||
                campaign
                  .creatorSubmittedArContentUrl
            );

          const submittedMediaUrl =
            cleanString(
              creatorSubmission
                .originalMediaUrl ||
                campaign.creatorMediaUrl
            );

          const submittedMediaStoragePath =
            cleanString(
              creatorSubmission
                .originalMediaStoragePath ||
                campaign
                  .creatorMediaStoragePath
            );

          const submittedMediaName =
            cleanString(
              creatorSubmission
                .originalMediaName ||
                campaign
                  .creatorMediaOriginalName
            );

          const submittedMediaContentType =
            cleanString(
              creatorSubmission
                .mediaContentType ||
                campaign
                  .creatorMediaContentType
            );

          const submittedMediaSizeBytes =
            Number(
              creatorSubmission
                .mediaSizeBytes ||
                campaign
                  .creatorMediaSizeBytes ||
                0
            );

          /*
           * Required Creator submission entries.
           */
          const hasRequiredPostUrl =
            isValidHttpUrl(
              submittedPostUrl
            );

          const hasRequiredMedia =
            Boolean(
              submittedMediaUrl &&
                submittedMediaStoragePath &&
                submittedMediaContentType &&
                submittedMediaSizeBytes >
                  0
            );

          const contentRightsConfirmed =
            rightsCertification
              .contentRightsConfirmed ===
            true;

          const audioRightsConfirmed =
            rightsCertification
              .audioRightsConfirmed ===
            true;

          const appearanceRightsConfirmed =
            rightsCertification
              .appearanceRightsConfirmed ===
            true;

          const creatorRetainsCopyright =
            rightsCertification
              .creatorRetainsCopyright ===
            true;

          const brandUsageLicenseGranted =
            licenseCertification
              .brandUsageLicenseGranted ===
            true;

          const goshshaDistributionLicenseGranted =
            licenseCertification
              .goshshaDistributionLicenseGranted ===
            true;

          const postWindowRoyaltyAcknowledged =
            licenseCertification
              .postWindowRoyaltyAcknowledged ===
            true;

          const futureRoyaltyEarningsAcknowledged =
            licenseCertification
              .futureRoyaltyEarningsAcknowledged ===
            true;

          const futurePaidReactivationAllowed =
            licenseCertification
              .futurePaidReactivationAllowed ===
            true;

          const automaticRenewalAllowed =
            licenseCertification
              .automaticRenewalAllowed ===
            false;

          const licenseType =
            cleanString(
              licenseCertification
                .licenseType
            );

          const licenseDurationDays =
            Number(
              licenseCertification
                .licenseDurationDays ||
                0
            );

          const validLicenseStructure =
            licenseType ===
              "campaign_window" &&
            licenseDurationDays === 90 &&
            licenseCertification
              .startsAt == null &&
            licenseCertification
              .expiresAt == null;

          const missingRequirements: string[] =
            [];

          if (!hasRequiredPostUrl) {
            missingRequirements.push(
              "valid published post URL"
            );
          }

          if (!hasRequiredMedia) {
            missingRequirements.push(
              "original Creator media"
            );
          }

          if (
            !contentRightsConfirmed
          ) {
            missingRequirements.push(
              "content rights certification"
            );
          }

          if (
            !audioRightsConfirmed
          ) {
            missingRequirements.push(
              "audio rights certification"
            );
          }

          if (
            !appearanceRightsConfirmed
          ) {
            missingRequirements.push(
              "appearance rights certification"
            );
          }

          if (
            !creatorRetainsCopyright
          ) {
            missingRequirements.push(
              "copyright ownership certification"
            );
          }

          if (
            !brandUsageLicenseGranted
          ) {
            missingRequirements.push(
              "Brand usage license"
            );
          }

          if (
            !goshshaDistributionLicenseGranted
          ) {
            missingRequirements.push(
              "Goshsha distribution license"
            );
          }

          if (
            !postWindowRoyaltyAcknowledged
          ) {
            missingRequirements.push(
              "post-window royalty acknowledgment"
            );
          }

          if (
            !futureRoyaltyEarningsAcknowledged
          ) {
            missingRequirements.push(
              "Future Royalty Earnings acknowledgment"
            );
          }

          if (
            !futurePaidReactivationAllowed
          ) {
            missingRequirements.push(
              "future paid reactivation permission"
            );
          }

          if (
            !automaticRenewalAllowed
          ) {
            missingRequirements.push(
              "confirmation that automatic renewal is disabled"
            );
          }

          if (
            !validLicenseStructure
          ) {
            missingRequirements.push(
              "valid 90-day campaign license structure"
            );
          }

          if (
            missingRequirements.length >
            0
          ) {
            throw new Error(
              `INCOMPLETE_SUBMISSION:${missingRequirements.join(
                "|"
              )}`
            );
          }

          /*
           * Freeze the exact submission, rights, and license
           * terms that the Brand approved.
           *
           * This snapshot should remain unchanged even if
           * another field is edited later.
           */
          const brandApprovalSnapshot = {
            snapshotVersion: 1,

            campaignId,

            creatorId:
              campaign.creatorId ||
              null,

            brandId:
              authenticatedUid,

            campaignTitle:
              campaign.campaignTitle ||
              null,

            productName:
              campaign.productName ||
              null,

            creatorSubmission: {
              publicPostUrl:
                submittedPostUrl,

              originalMediaUrl:
                submittedMediaUrl,

              originalMediaStoragePath:
                submittedMediaStoragePath,

              originalMediaName:
                submittedMediaName ||
                null,

              mediaContentType:
                submittedMediaContentType,

              mediaSizeBytes:
                submittedMediaSizeBytes,

              mediaType:
                creatorSubmission
                  .mediaType ||
                (submittedMediaContentType.startsWith(
                  "video/"
                )
                  ? "video"
                  : "image"),

              submittedBy:
                creatorSubmission
                  .submittedBy ||
                campaign.creatorId ||
                null,

              submittedAt:
                creatorSubmission
                  .submittedAt ||
                campaign
                  .creatorSubmittedAt ||
                null,

              submissionVersion:
                creatorSubmission
                  .submissionVersion ||
                1,
            },

            rightsCertification: {
              status:
                rightsCertification
                  .status ||
                "certified",

              contentRightsConfirmed:
                true,

              audioRightsConfirmed:
                true,

              appearanceRightsConfirmed:
                true,

              creatorRetainsCopyright:
                true,

              certificationVersion:
                rightsCertification
                  .certificationVersion ||
                "1.0",

              certifiedByUserId:
                rightsCertification
                  .certifiedByUserId ||
                campaign.creatorId ||
                null,

              certifiedAt:
                rightsCertification
                  .certifiedAt ||
                null,
            },

            licenseCertification: {
              status:
                "brand_approved_pending_activation",

              licenseType:
                "campaign_window",

              licenseDurationDays:
                90,

              brandUsageLicenseGranted:
                true,

              goshshaDistributionLicenseGranted:
                true,

              postWindowRoyaltyAcknowledged:
                true,

              futureRoyaltyEarningsAcknowledged:
                true,

              futurePaidReactivationAllowed:
                true,

              automaticRenewalAllowed:
                false,

              renewalRequestAllowed:
                licenseCertification
                  .renewalRequestAllowed ===
                true,

              /*
               * These remain null because Brand approval
               * does not activate retail media distribution.
               */
              startsAt: null,
              expiresAt: null,

              qualifiedViewRate:
                licenseCertification
                  .qualifiedViewRate ??
                null,

              currency:
                licenseCertification
                  .currency ||
                "USD",

              licenseTermsVersion:
                licenseCertification
                  .licenseTermsVersion ||
                "1.0",

              acceptedByUserId:
                licenseCertification
                  .acceptedByUserId ||
                campaign.creatorId ||
                null,

              acceptedAt:
                licenseCertification
                  .acceptedAt ||
                null,
            },

            approvedByBrandId:
              authenticatedUid,

            approvedAt:
              FieldValue.serverTimestamp(),
          };

          transaction.update(
            campaignRef,
            {
              status: "approved",

              brandApprovalStatus:
                "approved",

              payoutStatus:
                "ready_to_release",

              completionStatus:
                "brand_approved",

              /*
               * Creator payout is now ready for Admin.
               */
              payoutReadyAt:
                FieldValue.serverTimestamp(),

              brandApprovedByUserId:
                authenticatedUid,

              brandApprovedAt:
                FieldValue.serverTimestamp(),

              brandApprovalSnapshot,

              /*
               * Approval does not create or activate
               * an AR Entry or Retail Asset.
               */
              arStatus:
                "awaiting_retail_activation",

              retailAssetCreationStatus:
                "not_created",

              /*
               * The initial 90-day license still has not begun.
               * Its dates will be set only when a Retail Asset
               * is activated.
               */
              "creatorLicenseCertification.status":
                "brand_approved_pending_activation",

              "creatorLicenseCertification.startsAt":
                null,

              "creatorLicenseCertification.expiresAt":
                null,

              updatedAt:
                FieldValue.serverTimestamp(),
            }
          );

          return {
            campaign: {
              ...campaign,

              brandApprovalSnapshot,
            },

            alreadyApproved: false,
          };
        }
      );

    const campaign =
      approvalResult.campaign;

    /*
     * If the campaign was already approved, return success
     * without duplicating notifications or emails.
     */
    if (
      approvalResult.alreadyApproved
    ) {
      return NextResponse.json({
        ok: true,

        alreadyApproved: true,

        payoutStatus:
          "ready_to_release",

        adminReviewUrl,
      });
    }

    /*
     * Notifications happen only after the approval
     * transaction succeeds.
     */
    if (campaign.creatorId) {
      await adminDb
        .collection("notifications")
        .add({
          userId:
            campaign.creatorId,

          role: "creator",

          type:
            "campaign_approved_creator",

          title:
            "Submission approved",

          message:
            `Your submission for "${
              campaign.campaignTitle ||
              "your campaign"
            }" was approved. Payout is pending Admin release. Connect your Stripe payout account if you have not already.`,

          campaignId,

          read: false,
          isRead: false,

          createdAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        });
    }

    await adminDb
      .collection("notifications")
      .add({
        userId: "admin",

        role: "admin",

        type:
          "campaign_approved_admin",

        title:
          "Brand approved submission",

        message:
          `"${
            campaign.campaignTitle ||
            "Campaign"
          }" was approved by the Brand and is ready for payout release.`,

        campaignId,

        read: false,
        isRead: false,

        createdAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      });

    /*
     * Find the Creator email.
     */
    const [
      userCreatorSnap,
      legacyCreatorSnap,
    ] = campaign.creatorId
      ? await Promise.all([
          adminDb
            .collection("users")
            .doc(
              campaign.creatorId
            )
            .get(),

          adminDb
            .collection("creators")
            .doc(
              campaign.creatorId
            )
            .get(),
        ])
      : [null, null];

    const userCreator =
      userCreatorSnap?.exists
        ? userCreatorSnap.data()
        : null;

    const legacyCreator =
      legacyCreatorSnap?.exists
        ? legacyCreatorSnap.data()
        : null;

    const creatorEmail =
      userCreator?.contactEmail ||
      userCreator?.email ||
      legacyCreator?.contactEmail ||
      legacyCreator?.email ||
      campaign.creatorEmail;

    if (creatorEmail) {
      await sendEmail({
        to: creatorEmail,

        subject:
          `Submission approved: ${
            campaign.campaignTitle ||
            "Campaign"
          }`,

        htmlBody: `
          <h2>Submission approved</h2>

          <p>
            Your complete submission for
            <strong>${
              campaign.campaignTitle ||
              "your campaign"
            }</strong>
            was approved by the Brand.
          </p>

          <p>
            Your payout is now pending Admin release.
          </p>

          <p>
            Retail media activation is a separate step.
            The initial 90-day retail media license has
            not started yet.
          </p>

          <p>
            <a href="${creatorCampaignUrl}">
              View campaign
            </a>
          </p>
        `,

        textBody: `
Submission approved.

Campaign:
${campaign.campaignTitle || ""}

Your complete submission was approved by the Brand.

Your payout is now pending Admin release.

Retail media activation is a separate step. The initial 90-day retail media license has not started yet.

View campaign:
${creatorCampaignUrl}
        `.trim(),
      });
    }

    const adminEmail =
      process.env.ADMIN_EMAIL ||
      process.env
        .NEXT_PUBLIC_ADMIN_EMAIL ||
      "athenaycp@gmail.com";

    if (adminEmail) {
      await sendEmail({
        to: adminEmail,

        subject:
          `Payout ready to release: ${
            campaign.campaignTitle ||
            "Campaign"
          }`,

        htmlBody: `
          <h2>Payout ready to release</h2>

          <p>
            The Brand approved the Creator’s complete submission package.
          </p>

          <p>
            <strong>Campaign:</strong>
            ${
              campaign.campaignTitle ||
              "Campaign"
            }
          </p>

          <p>
            <strong>Product:</strong>
            ${
              campaign.productName ||
              "Not listed"
            }
          </p>

          <p>
            The approved submission snapshot includes the public post,
            original media, rights certifications, and retail media
            licensing acknowledgments.
          </p>

          <p>
            Please review and release the Creator payout.
          </p>

          <p>
            <a href="${adminReviewUrl}">
              Open Admin Review
            </a>
          </p>
        `,

        textBody: `
Payout ready to release.

The Brand approved the Creator's complete submission package.

Campaign:
${campaign.campaignTitle || "Campaign"}

Product:
${campaign.productName || "Not listed"}

The approved snapshot includes the public post, original media, rights certifications, and retail media licensing acknowledgments.

Open Admin Review:
${adminReviewUrl}
        `.trim(),
      });
    }

    return NextResponse.json({
      ok: true,

      alreadyApproved: false,

      brandApprovalStatus:
        "approved",

      payoutStatus:
        "ready_to_release",

      licenseStatus:
        "brand_approved_pending_activation",

      retailAssetCreationStatus:
        "not_created",

      adminReviewUrl,
    });
  } catch (err: any) {
    console.error(
      "Approve campaign submission error:",
      err
    );

    const errorMessage =
      String(
        err?.message || ""
      );

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
      "NOT_CAMPAIGN_BRAND"
    ) {
      return NextResponse.json(
        {
          error:
            "You are not authorized to approve this campaign.",
        },
        {
          status: 403,
        }
      );
    }

    if (
      errorMessage ===
      "CAMPAIGN_NOT_READY"
    ) {
      return NextResponse.json(
        {
          error:
            "This campaign is not ready for Brand approval.",
        },
        {
          status: 409,
        }
      );
    }

    if (
      errorMessage.startsWith(
        "INCOMPLETE_SUBMISSION:"
      )
    ) {
      const missingItems =
        errorMessage
          .replace(
            "INCOMPLETE_SUBMISSION:",
            ""
          )
          .split("|")
          .filter(Boolean);

      return NextResponse.json(
        {
          error:
            "The Creator submission is incomplete and cannot be approved.",

          missingRequirements:
            missingItems,
        },
        {
          status: 400,
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
        error: isInvalidToken
          ? "Your login session expired. Please log in again."
          : errorMessage ||
            "Failed to approve campaign submission.",
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