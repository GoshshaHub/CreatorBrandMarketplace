"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import ProtectedRoute from "../../../components/ProtectedRoute";

import {
  auth,
  db,
} from "../../../lib/firebase";

import {
  Campaign,
  getApprovedCampaignsReadyForPayout,
  getSubmittedCampaigns,
} from "../../../lib/campaigns";

function money(value?: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function cleanString(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function ReviewStatusRow({
  label,
  confirmed,
}: {
  label: string;
  confirmed: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <div
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          confirmed
            ? "bg-green-600 text-white"
            : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        }`}
      >
        {confirmed ? "✓" : "!"}
      </div>

      <div>
        <p className="text-sm font-medium text-slate-900 dark:text-white">
          {label}
        </p>

        <p
          className={`mt-1 text-xs ${
            confirmed
              ? "text-green-700 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {confirmed
            ? "Confirmed in Brand approval snapshot"
            : "Missing from Brand approval snapshot"}
        </p>
      </div>
    </div>
  );
}

function WorkflowStatus({
  label,
  value,
  state,
}: {
  label: string;
  value: string;
  state:
    | "complete"
    | "ready"
    | "inactive"
    | "warning";
}) {
  const styles = {
    complete:
      "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300",

    ready:
      "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300",

    inactive:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",

    warning:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300",
  };

  return (
    <div
      className={`rounded-xl border p-3 ${styles[state]}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
        {label}
      </p>

      <p className="mt-1 font-semibold">
        {value}
      </p>
    </div>
  );
}

function PayoutReviewCard({
  campaign,
  working,
  onRelease,
}: {
  campaign: Campaign;
  working: boolean;
  onRelease: (
    campaign: Campaign
  ) => Promise<void>;
}) {
  const campaignData =
    campaign as any;

  const snapshot =
    campaignData
      .brandApprovalSnapshot ||
    {};

  const submission =
    snapshot.creatorSubmission ||
    {};

  const rights =
    snapshot.rightsCertification ||
    {};

  const license =
    snapshot.licenseCertification ||
    {};

  /*
   * The payout review should primarily use the frozen
   * Brand approval snapshot.
   *
   * Fallbacks remain for older campaigns created before
   * the approval snapshot was introduced.
   */
  const publishedPostUrl =
    cleanString(
      submission.publicPostUrl ||
        campaignData
          .normalizedArContentUrl ||
        campaignData
          .creatorSubmittedArContentUrl
    );

  const originalMediaUrl =
    cleanString(
      submission.originalMediaUrl ||
        campaignData
          .creatorMediaUrl
    );

  const originalMediaName =
    cleanString(
      submission.originalMediaName ||
        campaignData
          .creatorMediaOriginalName
    ) || "Creator submission";

  const mediaContentType =
    cleanString(
      submission.mediaContentType ||
        campaignData
          .creatorMediaContentType
    );

  const mediaType =
    cleanString(
      submission.mediaType
    ) ||
    (mediaContentType.startsWith(
      "video/"
    )
      ? "video"
      : mediaContentType.startsWith(
          "image/"
        )
      ? "image"
      : "");

  const contentRightsConfirmed =
    rights.contentRightsConfirmed ===
    true;

  const audioRightsConfirmed =
    rights.audioRightsConfirmed ===
    true;

  const appearanceRightsConfirmed =
    rights.appearanceRightsConfirmed ===
    true;

  const creatorRetainsCopyright =
    rights.creatorRetainsCopyright ===
    true;

  const brandUsageLicenseGranted =
    license.brandUsageLicenseGranted ===
    true;

  const goshshaDistributionLicenseGranted =
    license.goshshaDistributionLicenseGranted ===
    true;

  const postWindowRoyaltyAcknowledged =
    license.postWindowRoyaltyAcknowledged ===
    true;

  const futureRoyaltyEarningsAcknowledged =
    license.futureRoyaltyEarningsAcknowledged ===
    true;

  const futurePaidReactivationAllowed =
    license.futurePaidReactivationAllowed ===
    true;

  const automaticRenewalDisabled =
    license.automaticRenewalAllowed ===
    false;

  const licenseDurationDays =
    Number(
      license.licenseDurationDays ||
        90
    );

  const licenseHasNotStarted =
    license.startsAt == null &&
    license.expiresAt == null;

  const hasSnapshot =
    Boolean(
      campaignData
        .brandApprovalSnapshot
    );

  const snapshotComplete =
    Boolean(
      publishedPostUrl &&
        originalMediaUrl &&
        contentRightsConfirmed &&
        audioRightsConfirmed &&
        appearanceRightsConfirmed &&
        creatorRetainsCopyright &&
        brandUsageLicenseGranted &&
        goshshaDistributionLicenseGranted &&
        postWindowRoyaltyAcknowledged &&
        futureRoyaltyEarningsAcknowledged &&
        futurePaidReactivationAllowed &&
        automaticRenewalDisabled &&
        licenseHasNotStarted
    );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
            {campaign.campaignTitle ||
              "Untitled Campaign"}
          </h3>

          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Brand:{" "}
            {campaign.brandName ||
              "—"}
          </p>

          <p className="text-slate-600 dark:text-slate-400">
            Creator:{" "}
            {campaign.creatorHandle ||
              campaign.creatorId ||
              "—"}
          </p>

          <p className="text-slate-600 dark:text-slate-400">
            Product:{" "}
            {campaign.productName ||
              "—"}
          </p>
        </div>

        <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-sm font-semibold text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
          Brand approved
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <WorkflowStatus
          label="Creator Transaction"
          value="Brand Approved"
          state="complete"
        />

        <WorkflowStatus
          label="Payout"
          value="Ready to Release"
          state="ready"
        />

        <WorkflowStatus
          label="Retail Media"
          value="Not Activated"
          state="inactive"
        />

        <WorkflowStatus
          label={`${licenseDurationDays}-Day License`}
          value={
            licenseHasNotStarted
              ? "Not Started"
              : "Unexpectedly Started"
          }
          state={
            licenseHasNotStarted
              ? "inactive"
              : "warning"
          }
        />
      </div>

      <div className="mt-5 grid gap-3 text-sm text-slate-700 dark:text-slate-300 md:grid-cols-3">
        <p>
          Brand Paid:{" "}
          {money(
            campaign.agreedPrice
          )}
        </p>

        <p>
          Goshsha Fee:{" "}
          {money(
            campaign.platformFeeAmount ||
              5
          )}
        </p>

        <p>
          Creator Payout:{" "}
          {money(
            campaign.creatorPayoutAmount
          )}
        </p>
      </div>

      {!hasSnapshot && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          This appears to be an older campaign without a frozen Brand approval snapshot. Live campaign fields are being shown as a fallback. Review carefully before releasing payout.
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
          <h4 className="font-bold text-slate-900 dark:text-white">
            Published Campaign Post
          </h4>

          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            This is the published social post approved by the Brand.
          </p>

          {publishedPostUrl ? (
            <div className="mt-4">
              <a
                href={
                  publishedPostUrl
                }
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-lg bg-pink-600 px-4 py-2 font-semibold text-white hover:bg-pink-700"
              >
                View Published Post
              </a>

              <p className="mt-3 break-all text-xs text-slate-500 dark:text-slate-400">
                {publishedPostUrl}
              </p>
            </div>
          ) : (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
              Published post URL is missing.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
          <h4 className="font-bold text-slate-900 dark:text-white">
            Original Creator Media
          </h4>

          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            This is the original media file frozen in the Brand approval snapshot.
          </p>

          {originalMediaUrl ? (
            <div className="mt-4">
              {mediaType ===
                "video" && (
                <video
                  src={
                    originalMediaUrl
                  }
                  controls
                  playsInline
                  className="max-h-[420px] w-full rounded-xl bg-black"
                />
              )}

              {mediaType ===
                "image" && (
                <img
                  src={
                    originalMediaUrl
                  }
                  alt={
                    originalMediaName
                  }
                  className="max-h-[420px] w-full rounded-xl object-contain"
                />
              )}

              {!mediaType && (
                <a
                  href={
                    originalMediaUrl
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-lg border border-slate-300 px-4 py-2 font-semibold dark:border-slate-600"
                >
                  Open Original Media
                </a>
              )}

              <div className="mt-3 rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-900">
                <p>
                  <strong>
                    File:
                  </strong>{" "}
                  {originalMediaName}
                </p>

                {mediaContentType && (
                  <p className="mt-1 text-slate-600 dark:text-slate-400">
                    Type:{" "}
                    {mediaContentType}
                  </p>
                )}

                <a
                  href={
                    originalMediaUrl
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block font-semibold text-pink-600 hover:underline"
                >
                  Open file in new tab
                </a>
              </div>
            </div>
          ) : (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
              Original Creator media is missing.
            </p>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
          <h4 className="font-bold text-slate-900 dark:text-white">
            Rights Certification
          </h4>

          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            These certifications were frozen when the Brand approved the submission.
          </p>

          <div className="mt-4 grid gap-3">
            <ReviewStatusRow
              label="Content rights confirmed"
              confirmed={
                contentRightsConfirmed
              }
            />

            <ReviewStatusRow
              label="Audio rights confirmed"
              confirmed={
                audioRightsConfirmed
              }
            />

            <ReviewStatusRow
              label="Appearance permissions confirmed"
              confirmed={
                appearanceRightsConfirmed
              }
            />

            <ReviewStatusRow
              label="Creator retains copyright ownership"
              confirmed={
                creatorRetainsCopyright
              }
            />
          </div>
        </section>

        <section className="rounded-2xl border border-pink-200 bg-pink-50 p-5 text-slate-900 dark:border-pink-900 dark:bg-pink-950/20 dark:text-white">
          <h4 className="font-bold">
            Retail Media Licensing
          </h4>

          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Payout release does not activate Retail Media or start the license.
          </p>

          <div className="mt-4 grid gap-3">
            <ReviewStatusRow
              label="Brand campaign usage license granted"
              confirmed={
                brandUsageLicenseGranted
              }
            />

            <ReviewStatusRow
              label="Goshsha distribution license granted"
              confirmed={
                goshshaDistributionLicenseGranted
              }
            />

            <ReviewStatusRow
              label="Post-window paid-use acknowledgment confirmed"
              confirmed={
                postWindowRoyaltyAcknowledged
              }
            />

            <ReviewStatusRow
              label="Future Royalty Earnings acknowledged"
              confirmed={
                futureRoyaltyEarningsAcknowledged
              }
            />

            <ReviewStatusRow
              label="Future paid reactivation allowed"
              confirmed={
                futurePaidReactivationAllowed
              }
            />

            <ReviewStatusRow
              label="Automatic renewal disabled"
              confirmed={
                automaticRenewalDisabled
              }
            />

            <ReviewStatusRow
              label={`${licenseDurationDays}-day license has not started`}
              confirmed={
                licenseHasNotStarted
              }
            />
          </div>
        </section>
      </div>

      {!snapshotComplete && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          Warning: the frozen approval package is incomplete or the Retail Media license appears to have started unexpectedly. Review the campaign record before releasing payout.
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900">
        <p className="font-semibold text-slate-900 dark:text-white">
          Payout action
        </p>

        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Releasing payout completes the Creator transaction only. It does not create an AR Entry, create a Retail Asset, activate Retail Media, or start the {licenseDurationDays}-day license.
        </p>

        <button
          onClick={() =>
            onRelease(campaign)
          }
          disabled={working}
          className="mt-4 rounded-xl bg-black px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {working
            ? "Releasing..."
            : `Release ${money(
                campaign.creatorPayoutAmount
              )} Payout`}
        </button>
      </div>
    </div>
  );
}

export default function AdminReviewPage() {
  const [
    submittedCampaigns,
    setSubmittedCampaigns,
  ] =
    useState<Campaign[]>([]);

  const [
    payoutReadyCampaigns,
    setPayoutReadyCampaigns,
  ] =
    useState<Campaign[]>([]);

  const [
    firstIrlCampaigns,
    setFirstIrlCampaigns,
  ] =
    useState<Campaign[]>([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    workingCampaignId,
    setWorkingCampaignId,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    message,
    setMessage,
  ] =
    useState("");

  async function loadFirstIrlCampaigns() {
    const firstIrlQuery =
      query(
        collection(
          db,
          "campaigns"
        ),

        where(
          "campaignType",
          "==",
          "brand_first_irl_preview"
        ),

        where(
          "arStatus",
          "==",
          "needs_admin_creation"
        )
      );

    const snap =
      await getDocs(
        firstIrlQuery
      );

    return snap.docs.map(
      (campaignDoc) => ({
        id: campaignDoc.id,
        ...campaignDoc.data(),
      })
    ) as Campaign[];
  }

  async function loadCampaigns() {
    setLoading(true);
    setError("");

    try {
      const [
        submitted,
        payoutReady,
        firstIrl,
      ] =
        await Promise.all([
          getSubmittedCampaigns(),

          getApprovedCampaignsReadyForPayout(),

          loadFirstIrlCampaigns(),
        ]);

      setSubmittedCampaigns(
        submitted
      );

      setPayoutReadyCampaigns(
        payoutReady
      );

      setFirstIrlCampaigns(
        firstIrl
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to load admin review campaigns."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  const hasNoWork =
    useMemo(() => {
      return (
        submittedCampaigns.length ===
          0 &&
        payoutReadyCampaigns.length ===
          0 &&
        firstIrlCampaigns.length ===
          0
      );
    }, [
      submittedCampaigns,
      payoutReadyCampaigns,
      firstIrlCampaigns,
    ]);

  async function handleMarkArLive(
    campaignId: string
  ) {
    setWorkingCampaignId(
      campaignId
    );

    setError("");
    setMessage("");

    try {
      const user =
        auth.currentUser;

      if (!user) {
        throw new Error(
          "Please log in again."
        );
      }

      const idToken =
        await user.getIdToken();

      const res =
        await fetch(
          "/api/mark-campaign-live",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${idToken}`,
            },

            body:
              JSON.stringify({
                campaignId,
              }),
          }
        );

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Failed to mark AR live."
        );
      }

      setMessage(
        "Campaign marked as scan-ready."
      );

      await loadCampaigns();
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to mark AR live."
      );
    } finally {
      setWorkingCampaignId("");
    }
  }

  async function handleReleasePayout(
    campaign: Campaign
  ) {
    const creatorName =
      campaign.creatorHandle ||
      campaign.creatorId ||
      "Creator";

    const payoutAmount =
      money(
        campaign.creatorPayoutAmount
      );

    const confirmed =
      window.confirm(
        `Release Creator payout?\n\nCampaign:\n${
          campaign.campaignTitle ||
          "Untitled Campaign"
        }\n\nCreator:\n${creatorName}\n\nAmount:\n${payoutAmount}\n\nThis action ONLY releases the Creator payout.\n\nIt DOES NOT:\n• create an AR Entry\n• create a Retail Asset\n• activate Retail Media\n• start the 90-day license\n\nContinue?`
      );

    if (!confirmed) {
      return;
    }

    setWorkingCampaignId(
      campaign.id
    );

    setError("");
    setMessage("");

    try {
      const user =
        auth.currentUser;

      if (!user) {
        throw new Error(
          "Please log in again."
        );
      }

      const idToken =
        await user.getIdToken();

      const res =
        await fetch(
          "/api/release-campaign-payout",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${idToken}`,
            },

            body:
              JSON.stringify({
                campaignId:
                  campaign.id,
              }),
          }
        );

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Failed to release payout."
        );
      }

      setMessage(
        "Creator payout released successfully. Retail Media remains inactive and the 90-day license has not started."
      );

      await loadCampaigns();
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to release payout."
      );
    } finally {
      setWorkingCampaignId("");
    }
  }

  return (
    <ProtectedRoute allowedRole="admin">
      <main className="mx-auto min-h-screen max-w-6xl p-6 text-slate-900 dark:text-white">
        <div>
          <h1 className="text-3xl font-bold">
            Admin Review
          </h1>

          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Review first IRL campaign previews, Creator submissions, frozen Brand approvals, and payout releases.
          </p>

          <Link
            href="/admin/creators/new"
            className="mt-3 inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            Add Listed Creator
          </Link>
        </div>

        {loading && (
          <p className="mt-8">
            Loading admin queue...
          </p>
        )}

        {error && (
          <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}

        {message && (
          <p className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
            {message}
          </p>
        )}

        {!loading &&
          hasNoWork && (
            <div className="mt-8 rounded-2xl border border-slate-200 p-6 dark:border-slate-700">
              <p className="font-semibold">
                No campaigns need Admin action right now.
              </p>

              <p className="mt-1 text-slate-600 dark:text-slate-400">
                First IRL previews, submitted campaigns, and payout-ready campaigns will appear here.
              </p>
            </div>
          )}

        {!loading &&
          firstIrlCampaigns.length >
            0 && (
            <section className="mt-10">
              <h2 className="text-2xl font-semibold">
                First IRL Campaigns — Need AR Creation
              </h2>

              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                This legacy first-campaign preview workflow remains separate from Creator payout review.
              </p>

              <div className="mt-4 space-y-4">
                {firstIrlCampaigns.map(
                  (campaign) => (
                    <div
                      key={
                        campaign.id
                      }
                      className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-semibold">
                            {campaign.campaignTitle ||
                              "Untitled Campaign"}
                          </h3>

                          <p className="mt-1 text-slate-600 dark:text-slate-400">
                            Brand:{" "}
                            {campaign.brandName ||
                              "—"}
                          </p>

                          <p className="text-slate-600 dark:text-slate-400">
                            Product:{" "}
                            {campaign.productName ||
                              "—"}
                          </p>

                          <p className="text-slate-600 dark:text-slate-400">
                            Status: Preview ready — needs scan-ready AR creation
                          </p>
                        </div>

                        <span className="rounded-full border px-3 py-1 text-sm">
                          Needs AR
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        {(campaign as any)
                          .campaignContentUrl && (
                          <a
                            href={
                              (
                                campaign as any
                              )
                                .campaignContentUrl
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block rounded-lg border px-4 py-2"
                          >
                            View Campaign Content
                          </a>
                        )}

                        {(campaign as any)
                          .arTargetImageUrl && (
                          <a
                            href={
                              (
                                campaign as any
                              )
                                .arTargetImageUrl
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block rounded-lg border px-4 py-2"
                          >
                            View Target Image
                          </a>
                        )}

                        <button
                          onClick={() =>
                            handleMarkArLive(
                              campaign.id
                            )
                          }
                          disabled={
                            workingCampaignId ===
                            campaign.id
                          }
                          className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-60 dark:bg-white dark:text-black"
                        >
                          {workingCampaignId ===
                          campaign.id
                            ? "Marking..."
                            : "Mark AR Live"}
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </section>
          )}

        {!loading &&
          submittedCampaigns.length >
            0 && (
            <section className="mt-10">
              <h2 className="text-2xl font-semibold">
                Submitted — Waiting for Brand Approval
              </h2>

              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Admin can monitor these campaigns, but only the Brand can approve the Creator submission.
              </p>

              <div className="mt-4 space-y-4">
                {submittedCampaigns.map(
                  (campaign) => {
                    const campaignData =
                      campaign as any;

                    const submission =
                      campaignData
                        .creatorSubmission ||
                      {};

                    const publishedPostUrl =
                      cleanString(
                        submission.publicPostUrl ||
                          campaign.normalizedArContentUrl ||
                          campaignData
                            .creatorSubmittedArContentUrl
                      );

                    const originalMediaUrl =
                      cleanString(
                        submission.originalMediaUrl ||
                          campaignData
                            .creatorMediaUrl
                      );

                    return (
                      <div
                        key={
                          campaign.id
                        }
                        className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <h3 className="text-xl font-semibold">
                              {campaign.campaignTitle ||
                                "Untitled Campaign"}
                            </h3>

                            <p className="mt-1 text-slate-600 dark:text-slate-400">
                              Brand:{" "}
                              {campaign.brandName ||
                                "—"}
                            </p>

                            <p className="text-slate-600 dark:text-slate-400">
                              Creator:{" "}
                              {campaign.creatorHandle ||
                                campaign.creatorId ||
                                "—"}
                            </p>

                            <p className="text-slate-600 dark:text-slate-400">
                              Product:{" "}
                              {campaign.productName ||
                                "—"}
                            </p>
                          </div>

                          <span className="rounded-full border px-3 py-1 text-sm">
                            Waiting for Brand approval
                          </span>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          {publishedPostUrl && (
                            <a
                              href={
                                publishedPostUrl
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block rounded-lg border px-4 py-2"
                            >
                              View Published Post
                            </a>
                          )}

                          {originalMediaUrl && (
                            <a
                              href={
                                originalMediaUrl
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block rounded-lg border px-4 py-2"
                            >
                              View Original Media
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </section>
          )}

        {!loading &&
          payoutReadyCampaigns.length >
            0 && (
            <section className="mt-10">
              <h2 className="text-2xl font-semibold">
                Ready for Payout Release
              </h2>

              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Review the exact frozen package approved by the Brand before releasing the Creator payout.
              </p>

              <div className="mt-4 space-y-6">
                {payoutReadyCampaigns.map(
                  (campaign) => (
                    <PayoutReviewCard
                      key={
                        campaign.id
                      }
                      campaign={
                        campaign
                      }
                      working={
                        workingCampaignId ===
                        campaign.id
                      }
                      onRelease={
                        handleReleasePayout
                      }
                    />
                  )
                )}
              </div>
            </section>
          )}
      </main>
    </ProtectedRoute>
  );
}