import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
  adminStorage,
} from "../../../lib/firebase-admin";

import { sendEmail } from "../../../lib/postmark";

type SubmissionBody = {
  campaignId?: string;
  submissionUrl?: string;

  mediaStoragePath?: string;
  mediaOriginalName?: string;
  mediaContentType?: string;
  mediaSizeBytes?: number;

  contentRightsConfirmed?: boolean;
  audioRightsConfirmed?: boolean;
  appearanceRightsConfirmed?: boolean;
  creatorRetainsCopyright?: boolean;

  brandUsageLicenseGranted?: boolean;
  goshshaDistributionLicenseGranted?: boolean;
  postWindowRoyaltyAcknowledged?: boolean;
  futureRoyaltyEarningsAcknowledged?: boolean;
};

const CAMPAIGN_LICENSE_DURATION_DAYS = 90;
const RIGHTS_CERTIFICATION_VERSION = "1.0";
const LICENSE_TERMS_VERSION = "1.0";
const SUBMISSION_VERSION = 1;

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

function cleanRequiredString(
  value: unknown,
  fieldName: string
): string {
  const cleaned =
    typeof value === "string"
      ? value.trim()
      : "";

  if (!cleaned) {
    throw new Error(
      `${fieldName} is required.`
    );
  }

  return cleaned;
}

function cleanOptionalString(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned || null;
}

function isAllowedMediaType(
  contentType: string
): boolean {
  return (
    contentType.startsWith("video/") ||
    contentType.startsWith("image/")
  );
}

function isValidHttpUrl(
  value: string
): boolean {
  try {
    const parsedUrl =
      new URL(value);

    return (
      parsedUrl.protocol === "https:" ||
      parsedUrl.protocol === "http:"
    );
  } catch {
    return false;
  }
}

function escapeHtml(
  value: unknown
): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFirebaseDownloadUrl(params: {
  bucketName: string;
  objectName: string;
  downloadToken: string;
}) {
  const {
    bucketName,
    objectName,
    downloadToken,
  } = params;

  return (
    "https://firebasestorage.googleapis.com/v0/b/" +
    `${encodeURIComponent(bucketName)}/o/` +
    `${encodeURIComponent(objectName)}` +
    `?alt=media&token=${encodeURIComponent(downloadToken)}`
  );
}

function getExistingDownloadToken(
  metadata: Record<string, unknown> | undefined
): string {
  const rawToken =
    metadata?.firebaseStorageDownloadTokens;

  if (
    typeof rawToken !== "string" ||
    !rawToken.trim()
  ) {
    return "";
  }

  /*
   * Firebase Storage may store multiple tokens
   * as a comma-separated string. Use the first.
   */
  return (
    rawToken
      .split(",")
      .map((item) => item.trim())
      .find(Boolean) || ""
  );
}

export async function POST(
  req: Request
) {
  try {
    /*
     * -----------------------------------------------------
     * Authenticate Creator
     * -----------------------------------------------------
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

    /*
     * -----------------------------------------------------
     * Read and normalize request
     * -----------------------------------------------------
     */

    const body =
      (await req.json()) as SubmissionBody;

    const campaignId =
      cleanRequiredString(
        body.campaignId,
        "campaignId"
      );

    const submissionUrl =
      cleanRequiredString(
        body.submissionUrl,
        "Published post URL"
      );

    const mediaStoragePath =
      cleanRequiredString(
        body.mediaStoragePath,
        "Original media upload"
      );

    const mediaOriginalName =
      cleanOptionalString(
        body.mediaOriginalName
      );

    const submittedContentType =
      cleanRequiredString(
        body.mediaContentType,
        "Media content type"
      );

    const submittedSizeBytes =
      Number(
        body.mediaSizeBytes || 0
      );

    const contentRightsConfirmed =
      body.contentRightsConfirmed === true;

    const audioRightsConfirmed =
      body.audioRightsConfirmed === true;

    const appearanceRightsConfirmed =
      body.appearanceRightsConfirmed === true;

    const creatorRetainsCopyright =
      body.creatorRetainsCopyright === true;

    const brandUsageLicenseGranted =
      body.brandUsageLicenseGranted === true;

    const goshshaDistributionLicenseGranted =
      body.goshshaDistributionLicenseGranted ===
      true;

    const postWindowRoyaltyAcknowledged =
      body.postWindowRoyaltyAcknowledged ===
      true;

    const futureRoyaltyEarningsAcknowledged =
      body.futureRoyaltyEarningsAcknowledged ===
      true;

    /*
     * -----------------------------------------------------
     * Validate published post and uploaded media
     * -----------------------------------------------------
     */

    if (
      !isValidHttpUrl(
        submissionUrl
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Published post URL must be a valid http or https web address.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !isAllowedMediaType(
        submittedContentType
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Only image and video files are supported.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(
        submittedSizeBytes
      ) ||
      submittedSizeBytes <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "The uploaded media file appears to be empty.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * Validate rights certifications
     * -----------------------------------------------------
     */

    if (!contentRightsConfirmed) {
      return NextResponse.json(
        {
          error:
            "You must confirm that you created the content or have the right to submit and license it.",
        },
        {
          status: 400,
        }
      );
    }

    if (!audioRightsConfirmed) {
      return NextResponse.json(
        {
          error:
            "You must confirm that the audio in the submitted content is cleared for the Goshsha experience.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !appearanceRightsConfirmed
    ) {
      return NextResponse.json(
        {
          error:
            "You must confirm that you have permission from identifiable people appearing in the content.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !creatorRetainsCopyright
    ) {
      return NextResponse.json(
        {
          error:
            "You must confirm the copyright ownership statement before submitting.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * Validate licensing certifications
     * -----------------------------------------------------
     */

    if (
      !brandUsageLicenseGranted
    ) {
      return NextResponse.json(
        {
          error:
            "You must grant the Brand permission to use the approved content for this campaign.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !goshshaDistributionLicenseGranted
    ) {
      return NextResponse.json(
        {
          error:
            "You must authorize Goshsha to host and distribute the approved content through its retail media infrastructure.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !postWindowRoyaltyAcknowledged
    ) {
      return NextResponse.json(
        {
          error:
            "You must acknowledge the post-campaign licensing and royalty terms.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !futureRoyaltyEarningsAcknowledged
    ) {
      return NextResponse.json(
        {
          error:
            "You must acknowledge the future royalty earnings opportunity.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * Verify Creator controls the Storage location
     * -----------------------------------------------------
     */

    const expectedStoragePrefix =
      `creator-submissions/${authenticatedUid}/${campaignId}/`;

    if (
      !mediaStoragePath.startsWith(
        expectedStoragePrefix
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid Creator media storage path.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * Load and validate campaign
     * -----------------------------------------------------
     */

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

    if (
      campaign.creatorId !==
      authenticatedUid
    ) {
      return NextResponse.json(
        {
          error:
            "You are not assigned to this campaign.",
        },
        {
          status: 403,
        }
      );
    }

    if (
      campaign.status !== "funded" ||
      campaign.fundingStatus !==
        "funded"
    ) {
      return NextResponse.json(
        {
          error:
            "This campaign must be funded before content can be submitted.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * Verify Storage object and collect authoritative
     * immutable metadata
     * -----------------------------------------------------
     */

    const bucket =
      adminStorage.bucket();

    const mediaFile =
      bucket.file(
        mediaStoragePath
      );

    const [mediaExists] =
      await mediaFile.exists();

    if (!mediaExists) {
      return NextResponse.json(
        {
          error:
            "The uploaded media file could not be found.",
        },
        {
          status: 400,
        }
      );
    }

    const [fileMetadata] =
      await mediaFile.getMetadata();

    const storedContentType =
      String(
        fileMetadata.contentType ||
          submittedContentType
      );

    const storedSizeBytes =
      Number(
        fileMetadata.size ||
          submittedSizeBytes ||
          0
      );

    if (
      !isAllowedMediaType(
        storedContentType
      )
    ) {
      return NextResponse.json(
        {
          error:
            "The uploaded file type is not supported.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(
        storedSizeBytes
      ) ||
      storedSizeBytes <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "The uploaded media file appears to be empty.",
        },
        {
          status: 400,
        }
      );
    }

    const storageBucket =
      bucket.name;

    const storageObjectName =
      mediaFile.name;

    const storageGeneration =
      cleanOptionalString(
        fileMetadata.generation
      );

    const storageMetageneration =
      cleanOptionalString(
        fileMetadata.metageneration
      );

    const storageMd5Hash =
      cleanOptionalString(
        fileMetadata.md5Hash
      );

    const storageCrc32c =
      cleanOptionalString(
        fileMetadata.crc32c
      );

    const storageEtag =
      cleanOptionalString(
        fileMetadata.etag
      );

    /*
     * Use a Firebase download token instead of a signed URL
     * with a decade-long expiration.
     *
     * The Storage path remains the permanent authoritative
     * reference. This token-based URL can be revoked later.
     */

    const existingCustomMetadata =
      fileMetadata.metadata || {};

    const existingDownloadToken =
      getExistingDownloadToken(
        existingCustomMetadata
      );

    const downloadToken =
      existingDownloadToken ||
      randomUUID();

    if (!existingDownloadToken) {
      await mediaFile.setMetadata({
        metadata: {
          ...existingCustomMetadata,
          firebaseStorageDownloadTokens:
            downloadToken,
        },
      });
    }

    const creatorMediaUrl =
      getFirebaseDownloadUrl({
        bucketName:
          storageBucket,

        objectName:
          storageObjectName,

        downloadToken,
      });

    /*
     * -----------------------------------------------------
     * Build submission objects
     * -----------------------------------------------------
     */

    const creatorSubmission = {
      publicPostUrl:
        submissionUrl,

      originalMediaUrl:
        creatorMediaUrl,

      originalMediaStoragePath:
        mediaStoragePath,

      originalMediaName:
        mediaOriginalName,

      mediaContentType:
        storedContentType,

      mediaSizeBytes:
        storedSizeBytes,

      mediaType:
        storedContentType.startsWith(
          "video/"
        )
          ? "video"
          : "image",

      /*
       * Immutable Storage identity.
       */
      storageBucket,
      storageObjectName,
      storageGeneration,
      storageMetageneration,
      storageMd5Hash,
      storageCrc32c,
      storageEtag,

      submittedBy:
        authenticatedUid,

      submittedAt:
        FieldValue.serverTimestamp(),

      submissionVersion:
        SUBMISSION_VERSION,
    };

    const creatorRightsCertification = {
      status:
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
        RIGHTS_CERTIFICATION_VERSION,

      certifiedByUserId:
        authenticatedUid,

      certifiedAt:
        FieldValue.serverTimestamp(),
    };

    const creatorLicenseCertification = {
      status:
        "pending_brand_approval",

      licenseType:
        "campaign_window",

      licenseDurationDays:
        CAMPAIGN_LICENSE_DURATION_DAYS,

      brandUsageLicenseGranted:
        true,

      goshshaDistributionLicenseGranted:
        true,

      postWindowRoyaltyAcknowledged:
        true,

      futureRoyaltyEarningsAcknowledged:
        true,

      /*
       * Future paid use may be offered, but nothing
       * automatically renews or extends the Brand's rights.
       */
      futurePaidReactivationAllowed:
        true,

      automaticRenewalAllowed:
        false,

      renewalRequestAllowed:
        true,

      /*
       * The license begins only when Retail Media is
       * separately activated later.
       */
      startsAt:
        null,

      expiresAt:
        null,

      qualifiedViewRate:
        null,

      currency:
        "USD",

      licenseTermsVersion:
        LICENSE_TERMS_VERSION,

      acceptedByUserId:
        authenticatedUid,

      acceptedAt:
        FieldValue.serverTimestamp(),
    };

    /*
     * -----------------------------------------------------
     * Commit submission in a transaction
     * -----------------------------------------------------
     *
     * Re-read the campaign inside the transaction so a
     * concurrent status change cannot bypass validation.
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
          freshCampaign.creatorId !==
          authenticatedUid
        ) {
          throw new Error(
            "CREATOR_NOT_AUTHORIZED"
          );
        }

        if (
          freshCampaign.status !==
            "funded" ||
          freshCampaign.fundingStatus !==
            "funded"
        ) {
          throw new Error(
            "CAMPAIGN_NOT_SUBMITTABLE"
          );
        }

        transaction.update(
          campaignRef,
          {
            /*
             * Legacy compatibility fields.
             */
            creatorSubmittedArContentUrl:
              submissionUrl,

            normalizedArContentUrl:
              submissionUrl,

            creatorMediaUrl,

            creatorMediaStoragePath:
              mediaStoragePath,

            creatorMediaOriginalName:
              mediaOriginalName,

            creatorMediaContentType:
              storedContentType,

            creatorMediaSizeBytes:
              storedSizeBytes,

            /*
             * Authoritative Creator deliverable package.
             */
            creatorSubmission,

            creatorRightsCertification,

            creatorLicenseCertification,

            /*
             * Creator collaboration workflow.
             */
            status:
              "submitted",

            completionStatus:
              "not_completed",

            brandApprovalStatus:
              "pending",

            payoutStatus:
              "not_ready",

            payoutReleaseStatus:
              "not_started",

            creatorSubmittedAt:
              FieldValue.serverTimestamp(),

            /*
             * Retail Media has not begun.
             *
             * Submission and Brand approval must not create
             * or activate AR or Retail Media infrastructure.
             */
            arStatus:
              "not_started",

            retailAssetCreationStatus:
              "not_created",

            retailMediaStatus:
              "not_activated",

            retailAssetId:
              null,

            publishedArEntryId:
              null,

            arEntryId:
              null,

            activationStart:
              null,

            activationEnd:
              null,

            brandApprovalSnapshot:
              null,

            updatedAt:
              FieldValue.serverTimestamp(),
          }
        );
      }
    );

    /*
     * -----------------------------------------------------
     * URLs used in notifications
     * -----------------------------------------------------
     */

    const appUrl =
      process.env
        .NEXT_PUBLIC_APP_URL ||
      "https://irl.goshsha.com";

    const brandCampaignUrl =
      `${appUrl}/brand/campaign/${campaignId}`;

    const loginUrl =
      `${appUrl}/login`;

    /*
     * Notification or email failures must not reverse a
     * successfully stored Creator submission.
     */

    try {
      await Promise.all([
        adminDb
          .collection(
            "notifications"
          )
          .add({
            userId:
              campaign.brandId,

            role:
              "brand",

            type:
              "campaign_submitted",

            title:
              "Creator submitted content",

            message:
              `${
                campaign.creatorHandle ||
                "A Creator"
              } submitted the complete deliverable package for "${
                campaign.campaignTitle ||
                "your campaign"
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
              "campaign_submitted_admin",

            title:
              "Campaign submitted",

            message:
              `${
                campaign.creatorHandle ||
                "A Creator"
              } submitted "${
                campaign.campaignTitle ||
                "a campaign"
              }" for Brand review.`,

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
        "Submission succeeded, but notification creation failed:",
        notificationError
      );
    }

    /*
     * -----------------------------------------------------
     * Notify Brand by email
     * -----------------------------------------------------
     */

    try {
      const brandSnap =
        campaign.brandId
          ? await adminDb
              .collection("brands")
              .doc(
                campaign.brandId
              )
              .get()
          : null;

      const brand =
        brandSnap?.exists
          ? brandSnap.data()
          : null;

      const brandEmail =
        brand?.contactEmail ||
        brand?.email ||
        campaign.brandEmail ||
        campaign.contactEmail ||
        "";

      if (brandEmail) {
        const safeCreatorHandle =
          escapeHtml(
            campaign.creatorHandle ||
              "Your Creator"
          );

        const safeCampaignTitle =
          escapeHtml(
            campaign.campaignTitle ||
              "Campaign"
          );

        const safeSubmissionUrl =
          escapeHtml(
            submissionUrl
          );

        const safeCreatorMediaUrl =
          escapeHtml(
            creatorMediaUrl
          );

        await sendEmail({
          to:
            brandEmail,

          subject:
            "Creator submission ready for review",

          htmlBody: `
            <h2>Creator submission ready for review</h2>

            <p>
              <strong>${safeCreatorHandle}</strong>
              submitted the complete campaign deliverable.
            </p>

            <p>
              <strong>Campaign:</strong>
              ${safeCampaignTitle}
            </p>

            <p>
              <strong>Published content:</strong>
              <a href="${safeSubmissionUrl}">
                View published post
              </a>
            </p>

            <p>
              <a href="${safeCreatorMediaUrl}">
                View original submitted media
              </a>
            </p>

            <p>
              The Creator also submitted the required content,
              audio, appearance, copyright, Brand usage, Goshsha
              distribution, and future royalty certifications.
            </p>

            <p>
              Please review the published post, original media,
              rights certifications, and licensing terms before
              approving the submission.
            </p>

            <p>
              Brand approval will make the Creator payout ready
              for Admin release. It will not activate Retail Media
              or begin the 90-day license.
            </p>

            <p>
              <a href="${brandCampaignUrl}">
                Review campaign submission
              </a>
            </p>

            <p>
              <a href="${loginUrl}">
                Log in to Goshsha IRL Campaign Network
              </a>
            </p>
          `,

          textBody: `
Creator submission ready for review.

Creator:
${campaign.creatorHandle || "Your Creator"}

Campaign:
${campaign.campaignTitle || "Campaign"}

Published content:
${submissionUrl}

Original submitted media:
${creatorMediaUrl}

The Creator submitted the required content, audio, appearance, copyright, Brand usage, Goshsha distribution, and future royalty certifications.

Please review the complete submission before approving it.

Brand approval will make the Creator payout ready for Admin release. It will not activate Retail Media or begin the 90-day license.

Review campaign submission:
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
        "Submission succeeded, but Brand email failed:",
        brandEmailError
      );
    }

    return NextResponse.json({
      ok:
        true,

      creatorMediaUrl,

      mediaStoragePath,

      storageGeneration,

      storageMd5Hash,

      submissionStatus:
        "submitted",

      brandApprovalStatus:
        "pending",

      payoutStatus:
        "not_ready",

      retailAssetCreationStatus:
        "not_created",

      retailMediaStatus:
        "not_activated",

      arStatus:
        "not_started",

      licenseStatus:
        "pending_brand_approval",

      licenseStarted:
        false,
    });
  } catch (err: any) {
    console.error(
      "Submit campaign content error:",
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
      "CREATOR_NOT_AUTHORIZED"
    ) {
      return NextResponse.json(
        {
          error:
            "You are not assigned to this campaign.",
        },
        {
          status: 403,
        }
      );
    }

    if (
      errorMessage ===
      "CAMPAIGN_NOT_SUBMITTABLE"
    ) {
      return NextResponse.json(
        {
          error:
            "This campaign is no longer available for submission.",
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
              "Failed to submit campaign content.",
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