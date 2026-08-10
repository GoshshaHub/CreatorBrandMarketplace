import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
} from "../../../lib/firebase-admin";

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

export async function POST(
  request: Request
) {
  try {
    /*
     * -----------------------------------------------------
     * Authenticate Brand
     * -----------------------------------------------------
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

    const brandUserId =
      decodedToken.uid;

    const body =
      await request.json();

    const campaignId =
      cleanRequiredString(
        body.campaignId,
        "campaignId"
      );

    /*
     * -----------------------------------------------------
     * Load campaign
     * -----------------------------------------------------
     */

    const campaignRef =
      adminDb
        .collection("campaigns")
        .doc(campaignId);

    const campaignSnap =
      await campaignRef.get();

    if (
      !campaignSnap.exists
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

    const campaign =
      campaignSnap.data() as Record<
        string,
        any
      >;

    /*
     * Only the Brand that owns this campaign can reject it.
     */
    if (
      campaign.brandId !==
      brandUserId
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to reject this submission.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * Only a submitted package can be rejected.
     */
    if (
      campaign.status !==
      "submitted"
    ) {
      return NextResponse.json(
        {
          error:
            "This campaign is no longer awaiting Brand review.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * Return campaign to Creator revision stage
     * -----------------------------------------------------
     *
     * IMPORTANT:
     *
     * Funding remains intact.
     * Stripe funding is untouched.
     * Creator payout is NOT released.
     * Retail Media is NOT activated.
     *
     * Setting status back to funded allows the Creator to
     * upload and submit a corrected package.
     */

    await campaignRef.update({
      status:
        "funded",

      brandApprovalStatus:
        "rejected",

      completionStatus:
        "not_completed",

      payoutStatus:
        "not_ready",

      payoutReleaseStatus:
        "not_started",

      brandRejectedAt:
        FieldValue.serverTimestamp(),

      brandRejectedBy:
        brandUserId,

      /*
       * Do not destroy the previous submission.
       *
       * Keeping it gives us an audit trail and allows the
       * Creator and Brand to see what was rejected.
       */
      arStatus:
        "not_started",

      retailAssetCreationStatus:
        "not_created",

      retailMediaStatus:
        "not_activated",

      updatedAt:
        FieldValue.serverTimestamp(),
    });

    /*
     * -----------------------------------------------------
     * Notify Creator
     * -----------------------------------------------------
     */

    if (campaign.creatorId) {
      await adminDb
        .collection(
          "notifications"
        )
        .add({
          userId:
            campaign.creatorId,

          role:
            "creator",

          type:
            "campaign_submission_rejected",

          title:
            "Submission needs revision",

          message:
            `Your submission for "${
              campaign.campaignTitle ||
              "the campaign"
            }" was not approved by the Brand. Please review your deliverable and submit an updated package.`,

          campaignId,

          isRead:
            false,

          read:
            false,

          createdAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        });
    }

    return NextResponse.json({
      ok: true,

      campaignId,

      status:
        "funded",

      brandApprovalStatus:
        "rejected",

      resubmissionAllowed:
        true,

      fundingPreserved:
        true,

      payoutReleased:
        false,

      message:
        "Submission rejected. The Creator may now submit a revised package.",
    });
  } catch (error: any) {
    console.error(
      "Reject campaign submission error:",
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
              "Failed to reject Creator submission.",
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