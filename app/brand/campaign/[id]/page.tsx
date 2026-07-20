"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import ProtectedRoute from "../../../../components/ProtectedRoute";

import {
  Campaign,
  getCampaignById,
} from "../../../../lib/campaigns";

import {
  auth,
  db,
} from "../../../../lib/firebase";

function isSubscribed(
  status?: string
) {
  return (
    status === "trialing" ||
    status === "active"
  );
}

function isValidHttpUrl(
  value?: string | null
): boolean {
  if (!value) {
    return false;
  }

  try {
    const parsedUrl =
      new URL(value);

    return (
      parsedUrl.protocol ===
        "https:" ||
      parsedUrl.protocol ===
        "http:"
    );
  } catch {
    return false;
  }
}

function Step({
  title,
  description,
  state,
}: {
  title: string;
  description: string;
  state:
    | "done"
    | "current"
    | "upcoming";
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className={`h-5 w-5 rounded-full border ${
            state === "done"
              ? "border-slate-900 bg-slate-900 dark:border-white dark:bg-white"
              : state === "current"
              ? "border-slate-900 bg-white dark:border-white dark:bg-slate-900"
              : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800"
          }`}
        />

        <div className="h-full w-px bg-slate-200 dark:bg-slate-700" />
      </div>

      <div className="pb-6">
        <p className="font-semibold text-slate-900 dark:text-white">
          {title}
        </p>

        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {description}
        </p>
      </div>
    </div>
  );
}

function getStepState(
  campaign: Campaign,
  step: string
) {
  const status =
    campaign.status as
      | string
      | undefined;

  const payoutStatus =
    (campaign as any)
      .payoutStatus as
      | string
      | undefined;

  if (step === "completed") {
    if (
      status === "completed" ||
      payoutStatus === "released"
    ) {
      return "done";
    }

    return "upcoming";
  }

  const order = [
    "invited",
    "accepted",
    "funded",
    "submitted",
    "approved",
  ];

  const currentIndex =
    order.indexOf(
      status || "invited"
    );

  const stepIndex =
    order.indexOf(step);

  if (
    stepIndex <
    currentIndex
  ) {
    return "done";
  }

  if (
    stepIndex ===
    currentIndex
  ) {
    return "current";
  }

  return "upcoming";
}

function CertificationRow({
  label,
  confirmed,
}: {
  label: string;
  confirmed: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
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
        <p className="text-sm font-medium">
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
            ? "Confirmed by Creator"
            : "Required confirmation missing"}
        </p>
      </div>
    </div>
  );
}

export default function BrandCampaignDetailPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const router =
    useRouter();

  const campaignId =
    params?.id || "";

  const [
    campaign,
    setCampaign,
  ] =
    useState<Campaign | null>(
      null
    );

  const [
    subscriptionStatus,
    setSubscriptionStatus,
  ] =
    useState("none");

  const [
    brandName,
    setBrandName,
  ] =
    useState("Brand");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    working,
    setWorking,
  ] =
    useState(false);

  const [
    paywallLoading,
    setPaywallLoading,
  ] =
    useState(false);

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

  const [
    showInviteBox,
    setShowInviteBox,
  ] =
    useState(false);

  const [
    creatorName,
    setCreatorName,
  ] =
    useState("");

  const [
    creatorHandle,
    setCreatorHandle,
  ] =
    useState("");

  const [
    platform,
    setPlatform,
  ] =
    useState("TikTok");

  const [
    externalInviteMessage,
    setExternalInviteMessage,
  ] =
    useState("");

  const [
    externalInviteUrl,
    setExternalInviteUrl,
  ] =
    useState("");

  async function loadCampaign() {
    setLoading(true);
    setError("");

    try {
      const data =
        await getCampaignById(
          campaignId
        );

      setCampaign(data);

      if (
        (data as any)
          ?.campaignType ===
          "brand_first_irl_preview" ||
        (data as any)
          ?.isFirstFreeIRLLaunch
      ) {
        router.replace(
          `/brand/campaign/${campaignId}/live`
        );

        return;
      }

      const user =
        auth.currentUser;

      if (user) {
        const brandSnap =
          await getDoc(
            doc(
              db,
              "brands",
              user.uid
            )
          );

        const brandData =
          brandSnap.exists()
            ? brandSnap.data()
            : null;

        setSubscriptionStatus(
          String(
            brandData
              ?.subscriptionStatus ||
              "none"
          )
        );

        setBrandName(
          String(
            brandData?.brandName ||
              brandData
                ?.displayName ||
              user.displayName ||
              "Brand"
          )
        );
      }
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to load campaign."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (campaignId) {
      loadCampaign();
    }
  }, [campaignId]);

  const subscribed =
    isSubscribed(
      subscriptionStatus
    );

  const campaignData =
    campaign as any;

  const creatorSubmission =
    campaignData
      ?.creatorSubmission ||
    {};

  const rightsCertification =
    campaignData
      ?.creatorRightsCertification ||
    {};

  const licenseCertification =
    campaignData
      ?.creatorLicenseCertification ||
    {};

  const submittedPostUrl =
    String(
      creatorSubmission
        ?.publicPostUrl ||
        campaignData
          ?.normalizedArContentUrl ||
        campaignData
          ?.creatorSubmittedArContentUrl ||
        ""
    ).trim();

  const submittedMediaUrl =
    String(
      creatorSubmission
        ?.originalMediaUrl ||
        campaignData
          ?.creatorMediaUrl ||
        ""
    ).trim();

  const submittedMediaName =
    String(
      creatorSubmission
        ?.originalMediaName ||
        campaignData
          ?.creatorMediaOriginalName ||
        "Creator submission"
    );

  const submittedMediaType =
    String(
      creatorSubmission
        ?.mediaContentType ||
        campaignData
          ?.creatorMediaContentType ||
        ""
    );

  const submittedMediaCategory =
    creatorSubmission
      ?.mediaType ||
    (submittedMediaType.startsWith(
      "video/"
    )
      ? "video"
      : submittedMediaType.startsWith(
          "image/"
        )
      ? "image"
      : "");

  const hasRequiredPostUrl =
    isValidHttpUrl(
      submittedPostUrl
    );

  const hasRequiredMedia =
    Boolean(
      submittedMediaUrl
    );

  const contentRightsConfirmed =
    rightsCertification
      ?.contentRightsConfirmed ===
    true;

  const audioRightsConfirmed =
    rightsCertification
      ?.audioRightsConfirmed ===
    true;

  const appearanceRightsConfirmed =
    rightsCertification
      ?.appearanceRightsConfirmed ===
    true;

  const creatorRetainsCopyright =
    rightsCertification
      ?.creatorRetainsCopyright ===
    true;

  const brandUsageLicenseGranted =
    licenseCertification
      ?.brandUsageLicenseGranted ===
    true;

  const goshshaDistributionLicenseGranted =
    licenseCertification
      ?.goshshaDistributionLicenseGranted ===
    true;

  const postWindowRoyaltyAcknowledged =
    licenseCertification
      ?.postWindowRoyaltyAcknowledged ===
    true;

  const futureRoyaltyEarningsAcknowledged =
    licenseCertification
      ?.futureRoyaltyEarningsAcknowledged ===
    true;

  const futurePaidReactivationAllowed =
    licenseCertification
      ?.futurePaidReactivationAllowed ===
    true;

  const automaticRenewalAllowed =
    licenseCertification
      ?.automaticRenewalAllowed ===
    true;

  const licenseDurationDays =
    Number(
      licenseCertification
        ?.licenseDurationDays ||
        90
    );

  const submissionPackageComplete =
    hasRequiredPostUrl &&
    hasRequiredMedia &&
    contentRightsConfirmed &&
    audioRightsConfirmed &&
    appearanceRightsConfirmed &&
    creatorRetainsCopyright &&
    brandUsageLicenseGranted &&
    goshshaDistributionLicenseGranted &&
    postWindowRoyaltyAcknowledged &&
    futureRoyaltyEarningsAcknowledged &&
    futurePaidReactivationAllowed &&
    automaticRenewalAllowed ===
      false;

  const nextAction =
    useMemo(() => {
      if (!campaign) {
        return "";
      }

      const status =
        campaign.status as
          | string
          | undefined;

      if (status === "invited") {
        return "Waiting for the Creator to accept the invite.";
      }

      if (
        status === "accepted" &&
        campaign.fundingStatus !==
          "funded"
      ) {
        return "Creator accepted. Fund the campaign so they can begin.";
      }

      if (status === "funded") {
        return "Campaign is funded. Waiting for the Creator to submit the complete deliverable package.";
      }

      if (
        status === "submitted" &&
        !submissionPackageComplete
      ) {
        return "The Creator submission is incomplete. Approval is blocked until every required item is present.";
      }

      if (status === "submitted") {
        return "Review the original media, published post, rights certifications, and licensing acknowledgments before approval.";
      }

      if (status === "approved") {
        return "Submission approved. Waiting for Admin to release the Creator payout.";
      }

      if (
        status === "completed" ||
        status === "live" ||
        status === "ar_live"
      ) {
        return "Creator transaction completed.";
      }

      return "";
    }, [
      campaign,
      submissionPackageComplete,
    ]);

  async function startStripeCheckout() {
    const user =
      auth.currentUser;

    if (
      !user ||
      !user.email
    ) {
      alert(
        "Please log in again before starting your trial."
      );

      return;
    }

    setPaywallLoading(true);

    try {
      const res =
        await fetch(
          "/api/brand/create-subscription-checkout",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                uid: user.uid,
                email: user.email,
                brandName,
              }),
          }
        );

      const data =
        await res.json();

      if (
        !res.ok ||
        !data.checkoutUrl
      ) {
        throw new Error(
          data.error ||
            "Unable to start Stripe checkout."
        );
      }

      window.location.href =
        data.checkoutUrl;
    } catch (err: any) {
      alert(
        err?.message ||
          "Unable to start trial."
      );
    } finally {
      setPaywallLoading(false);
    }
  }

  async function handleFundCampaign() {
    setWorking(true);
    setError("");
    setMessage("");

    try {
      const res =
        await fetch(
          "/api/fund-campaign",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
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
            "Failed to start Stripe Checkout."
        );
      }

      if (!data.checkoutUrl) {
        throw new Error(
          "Stripe Checkout URL was not returned."
        );
      }

      window.location.href =
        data.checkoutUrl;
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to start Stripe Checkout."
      );

      setWorking(false);
    }
  }

  async function handleApproveSubmission() {
    if (
      !submissionPackageComplete
    ) {
      setError(
        "This submission cannot be approved because one or more required deliverables, rights certifications, or licensing acknowledgments are missing."
      );

      return;
    }

    setWorking(true);
    setError("");
    setMessage("");

    try {
      if (
        !campaignId ||
        !submittedPostUrl
      ) {
        throw new Error(
          "Missing campaign ID or required published post URL."
        );
      }

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
          "/api/approve-campaign-submission",
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

                submissionUrl:
                  submittedPostUrl,
              }),
          }
        );

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Failed to approve submission."
        );
      }

      setMessage(
        "Submission approved. Admin has been notified to release the Creator payout."
      );

      await loadCampaign();
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to approve submission."
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleGenerateExternalInvite() {
    if (!campaign) {
      return;
    }

    if (!subscribed) {
      setShowInviteBox(false);
      setMessage("");
      setError("");

      await startStripeCheckout();

      return;
    }

    setWorking(true);
    setError("");
    setMessage("");
    setExternalInviteMessage("");
    setExternalInviteUrl("");

    try {
      const res =
        await fetch(
          "/api/brand/external-creator-invite",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                campaignId,

                brandId:
                  campaignData
                    ?.brandId ||
                  "",

                brandName:
                  campaignData
                    ?.brandName ||
                  "our brand",

                creatorName,
                creatorHandle,
                platform,
              }),
          }
        );

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Failed to generate invite."
        );
      }

      setExternalInviteMessage(
        data.message
      );

      setExternalInviteUrl(
        data.inviteUrl
      );

      setMessage(
        "Creator invite generated. Copy and send it by DM."
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to generate external Creator invite."
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleCopyInvite() {
    if (
      !externalInviteMessage
    ) {
      return;
    }

    await navigator.clipboard.writeText(
      externalInviteMessage
    );

    setMessage(
      "Invite message copied."
    );
  }

  return (
    <ProtectedRoute allowedRole="brand">
      <main className="mx-auto min-h-screen max-w-4xl bg-white p-6 text-slate-900 dark:bg-slate-950 dark:text-white">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              Campaign Details
            </h1>

            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Follow the campaign from invite to Creator payout.
            </p>
          </div>

          <Link
            href="/brand/dashboard"
            className="rounded-lg border px-4 py-2"
          >
            Back
          </Link>
        </div>

        {loading && (
          <p className="mt-8">
            Loading campaign...
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

        {campaign && (
          <div className="mt-8 grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-2xl font-semibold">
                {campaign.campaignTitle ||
                  "Untitled Campaign"}
              </h2>

              <p className="mt-1 text-slate-600 dark:text-slate-400">
                Product:{" "}
                {campaign.productName ||
                  "—"}
              </p>

              <p className="mt-4 text-slate-700 dark:text-slate-300">
                {campaign.campaignBrief ||
                  "No brief added."}
              </p>

              {campaignData
                ?.campaignContentUrl && (
                <a
                  href={
                    campaignData
                      .campaignContentUrl
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-block rounded-lg border px-4 py-2"
                >
                  View IRL Campaign Content
                </a>
              )}

              <div className="mt-6 rounded-xl bg-slate-100 p-4 dark:bg-slate-800">
                <p className="font-semibold">
                  Next step
                </p>

                <p className="mt-1 text-slate-700 dark:text-slate-300">
                  {nextAction}
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    if (!subscribed) {
                      startStripeCheckout();

                      return;
                    }

                    setShowInviteBox(
                      (previous) =>
                        !previous
                    );
                  }}
                  disabled={
                    paywallLoading
                  }
                  className="rounded-lg bg-pink-600 px-4 py-2 font-semibold text-white hover:bg-pink-700 disabled:opacity-60"
                >
                  {paywallLoading
                    ? "Starting trial..."
                    : "Invite My Own Creator"}
                </button>

                {campaign.status ===
                  "accepted" &&
                  campaign.fundingStatus !==
                    "funded" && (
                    <button
                      onClick={
                        handleFundCampaign
                      }
                      disabled={
                        working
                      }
                      className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                    >
                      {working
                        ? "Funding..."
                        : "Fund Campaign"}
                    </button>
                  )}

                {campaign.status ===
                  "submitted" &&
                  campaignData
                    ?.brandApprovalStatus !==
                    "approved" && (
                    <button
                      onClick={() => {
                        if (
                          !submissionPackageComplete
                        ) {
                          setError(
                            "Approval is blocked because the Creator submission package is incomplete."
                          );

                          return;
                        }

                        const confirmed =
                          window.confirm(
                            "Approve this complete Creator submission?\n\nThis confirms that you reviewed the published post, original media, rights certifications, and retail media licensing acknowledgments. The Creator payout will move to Admin release review."
                          );

                        if (!confirmed) {
                          return;
                        }

                        handleApproveSubmission();
                      }}
                      disabled={
                        working ||
                        !submissionPackageComplete
                      }
                      className="rounded-lg bg-black px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {working
                        ? "Approving..."
                        : "Approve Complete Submission"}
                    </button>
                  )}
              </div>

              {!subscribed && (
                <div className="mt-5 rounded-2xl border border-pink-200 bg-pink-50 p-5 text-slate-900">
                  <p className="font-bold">
                    Creator invites are locked.
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    Start your 14-day free trial to invite Creators and scale this campaign.
                  </p>

                  <button
                    onClick={
                      startStripeCheckout
                    }
                    disabled={
                      paywallLoading
                    }
                    className="mt-4 rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-60"
                  >
                    {paywallLoading
                      ? "Starting trial..."
                      : "Start 14-Day Free Trial"}
                  </button>
                </div>
              )}

              {showInviteBox &&
                subscribed && (
                  <div className="mt-6 rounded-2xl border border-pink-200 bg-pink-50 p-5 text-slate-900">
                    <h3 className="text-lg font-bold">
                      Invite a Creator you already know
                    </h3>

                    <p className="mt-1 text-sm text-slate-600">
                      Generate a DM invite they can use to join this campaign inside Goshsha.
                    </p>

                    <div className="mt-4 grid gap-4">
                      <input
                        value={
                          creatorName
                        }
                        onChange={(
                          event
                        ) =>
                          setCreatorName(
                            event
                              .target
                              .value
                          )
                        }
                        className="rounded-xl border px-4 py-3"
                        placeholder="Creator name optional"
                      />

                      <input
                        value={
                          creatorHandle
                        }
                        onChange={(
                          event
                        ) =>
                          setCreatorHandle(
                            event
                              .target
                              .value
                          )
                        }
                        className="rounded-xl border px-4 py-3"
                        placeholder="@creatorhandle optional"
                      />

                      <select
                        value={
                          platform
                        }
                        onChange={(
                          event
                        ) =>
                          setPlatform(
                            event
                              .target
                              .value
                          )
                        }
                        className="rounded-xl border px-4 py-3"
                      >
                        <option>
                          TikTok
                        </option>

                        <option>
                          Instagram
                        </option>

                        <option>
                          YouTube
                        </option>

                        <option>
                          Other
                        </option>
                      </select>

                      <button
                        onClick={
                          handleGenerateExternalInvite
                        }
                        disabled={
                          working
                        }
                        className="rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-60"
                      >
                        {working
                          ? "Generating..."
                          : "Generate Invite Message"}
                      </button>

                      {externalInviteMessage && (
                        <div className="rounded-xl bg-white p-4">
                          <p className="mb-2 text-sm font-semibold">
                            Copy this DM:
                          </p>

                          <textarea
                            readOnly
                            value={
                              externalInviteMessage
                            }
                            className="min-h-48 w-full rounded-lg border px-3 py-2 text-sm"
                          />

                          <button
                            onClick={
                              handleCopyInvite
                            }
                            className="mt-3 rounded-lg bg-pink-600 px-4 py-2 font-semibold text-white"
                          >
                            Copy DM Invite
                          </button>

                          {externalInviteUrl && (
                            <p className="mt-3 break-all text-xs text-slate-500">
                              Invite link:{" "}
                              {
                                externalInviteUrl
                              }
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              {campaign.status ===
                "submitted" ||
              campaign.status ===
                "approved" ||
              campaign.status ===
                "completed" ? (
                <div className="mt-8 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-bold">
                        Creator Submission Review
                      </h3>

                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        Review every required item before approving the Creator’s work.
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-sm font-semibold ${
                        submissionPackageComplete
                          ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300"
                          : "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                      }`}
                    >
                      {submissionPackageComplete
                        ? "Complete"
                        : "Incomplete"}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
                    <h4 className="font-bold">
                      Published Campaign Post
                    </h4>

                    {hasRequiredPostUrl ? (
                      <div className="mt-3">
                        <a
                          href={
                            submittedPostUrl
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-lg bg-pink-600 px-4 py-2 font-semibold text-white hover:bg-pink-700"
                        >
                          View Published Post
                        </a>

                        <p className="mt-3 break-all text-sm text-slate-500 dark:text-slate-400">
                          {
                            submittedPostUrl
                          }
                        </p>
                      </div>
                    ) : (
                      <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                        Required published post URL is missing or invalid.
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
                    <h4 className="font-bold">
                      Original Creator Media
                    </h4>

                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      This is the original file submitted for Brand review and potential Goshsha retail media distribution.
                    </p>

                    {hasRequiredMedia ? (
                      <div className="mt-4">
                        {submittedMediaCategory ===
                          "video" && (
                          <video
                            src={
                              submittedMediaUrl
                            }
                            controls
                            playsInline
                            className="max-h-[500px] w-full rounded-xl bg-black"
                          />
                        )}

                        {submittedMediaCategory ===
                          "image" && (
                          <img
                            src={
                              submittedMediaUrl
                            }
                            alt={
                              submittedMediaName
                            }
                            className="max-h-[500px] w-full rounded-xl object-contain"
                          />
                        )}

                        {!submittedMediaCategory && (
                          <a
                            href={
                              submittedMediaUrl
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex rounded-lg border px-4 py-2 font-semibold"
                          >
                            Open Original Media
                          </a>
                        )}

                        <div className="mt-3 rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800">
                          <p>
                            <strong>
                              File:
                            </strong>{" "}
                            {
                              submittedMediaName
                            }
                          </p>

                          {submittedMediaType && (
                            <p className="mt-1 text-slate-600 dark:text-slate-400">
                              Type:{" "}
                              {
                                submittedMediaType
                              }
                            </p>
                          )}

                          <a
                            href={
                              submittedMediaUrl
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-block font-semibold text-pink-600 hover:underline"
                          >
                            Open media in new tab
                          </a>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                        Required original media file is missing.
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
                    <h4 className="font-bold">
                      Creator Rights Certification
                    </h4>

                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      Every certification is required before approval.
                    </p>

                    <div className="mt-4 grid gap-3">
                      <CertificationRow
                        label="Creator created the content or has the authority to submit and license it."
                        confirmed={
                          contentRightsConfirmed
                        }
                      />

                      <CertificationRow
                        label="Audio is cleared for the Goshsha retail media and AR experience."
                        confirmed={
                          audioRightsConfirmed
                        }
                      />

                      <CertificationRow
                        label="Permission was obtained from all identifiable people appearing in the content."
                        confirmed={
                          appearanceRightsConfirmed
                        }
                      />

                      <CertificationRow
                        label="Creator retains ownership of the content unless a separate written agreement states otherwise."
                        confirmed={
                          creatorRetainsCopyright
                        }
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-pink-200 bg-pink-50 p-5 text-slate-900">
                    <h4 className="font-bold">
                      Retail Media Licensing
                    </h4>

                    <div className="mt-4 rounded-xl bg-white p-4">
                      <p className="font-semibold">
                        Initial{" "}
                        {
                          licenseDurationDays
                        }
                        -Day Retail Media License
                      </p>

                      <p className="mt-2 text-sm text-slate-600">
                        The license period begins only when the Creator content becomes active in the Goshsha retail media experience. It does not begin at submission or Brand approval.
                      </p>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <CertificationRow
                        label="Creator granted the Brand campaign usage rights during the applicable license period."
                        confirmed={
                          brandUsageLicenseGranted
                        }
                      />

                      <CertificationRow
                        label="Creator authorized Goshsha to host, process, display, and distribute the content."
                        confirmed={
                          goshshaDistributionLicenseGranted
                        }
                      />

                      <CertificationRow
                        label="Creator acknowledged that continued use after the initial license requires a new paid arrangement."
                        confirmed={
                          postWindowRoyaltyAcknowledged
                        }
                      />

                      <CertificationRow
                        label="Creator acknowledged eligibility for future royalty earnings from paid retail media reactivation."
                        confirmed={
                          futureRoyaltyEarningsAcknowledged
                        }
                      />

                      <CertificationRow
                        label="Future paid reactivation is permitted through a new license, renewal, or qualified-view royalty arrangement."
                        confirmed={
                          futurePaidReactivationAllowed
                        }
                      />

                      <CertificationRow
                        label="No automatic or free renewal is granted after the initial license period."
                        confirmed={
                          automaticRenewalAllowed ===
                          false
                        }
                      />
                    </div>

                    <div className="mt-4 rounded-xl border border-pink-200 bg-white p-4">
                      <p className="font-semibold">
                        Future Royalty Earnings
                      </p>

                      <p className="mt-2 text-sm text-slate-600">
                        After the initial license expires, the content can be deactivated. It may later be reactivated only through a new paid license, renewal, or qualified-view royalty arrangement.
                      </p>

                      <p className="mt-2 text-sm font-medium">
                        Brand approval today does not grant automatic or indefinite post-window usage rights.
                      </p>
                    </div>
                  </div>

                  {!submissionPackageComplete && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                      Approval is disabled because the Creator submission package is missing one or more required items. The Creator submission record must be corrected before this campaign can move to payout review.
                    </div>
                  )}

                  {campaign.status ===
                    "submitted" &&
                    campaignData
                      ?.brandApprovalStatus !==
                      "approved" && (
                      <button
                        onClick={() => {
                          if (
                            !submissionPackageComplete
                          ) {
                            setError(
                              "Approval is blocked because the Creator submission package is incomplete."
                            );

                            return;
                          }

                          const confirmed =
                            window.confirm(
                              "Approve this complete Creator submission?\n\nYou are confirming that you reviewed the published post, original media, rights certifications, 90-day retail media license, and Future Royalty Earnings acknowledgment.\n\nThis will move the Creator payout to Admin release review."
                            );

                          if (
                            !confirmed
                          ) {
                            return;
                          }

                          handleApproveSubmission();
                        }}
                        disabled={
                          working ||
                          !submissionPackageComplete
                        }
                        className="w-full rounded-xl bg-black px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {working
                          ? "Approving..."
                          : "Approve Complete Creator Submission"}
                      </button>
                    )}
                </div>
              ) : null}

              <div className="mt-8 grid gap-3 text-sm text-slate-700 dark:text-slate-300">
                <p>
                  Creator:{" "}
                  {campaign.creatorHandle ||
                    "—"}
                </p>

                <p>
                  Agreed Price: $
                  {campaign.agreedPrice ??
                    0}
                </p>

                <p>
                  Goshsha Fee: $
                  {campaign.platformFeeAmount ??
                    5}
                </p>

                <p>
                  Creator Payout: $
                  {campaign.creatorPayoutAmount ??
                    0}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border p-6">
              <h3 className="mb-6 text-xl font-semibold">
                Campaign Timeline
              </h3>

              <Step
                title="Invite Sent"
                description="Creator was invited."
                state={getStepState(
                  campaign,
                  "invited"
                )}
              />

              <Step
                title="Creator Accepted"
                description="Creator accepts the campaign."
                state={getStepState(
                  campaign,
                  "accepted"
                )}
              />

              <Step
                title="Campaign Funded"
                description="Brand funds the campaign so Creator work can begin."
                state={getStepState(
                  campaign,
                  "funded"
                )}
              />

              <Step
                title="Complete Package Submitted"
                description="Creator submits the public post URL, original media, rights certifications, and licensing acknowledgments."
                state={getStepState(
                  campaign,
                  "submitted"
                )}
              />

              <Step
                title="Brand Approved"
                description="Brand reviews and approves the complete Creator deliverable package."
                state={getStepState(
                  campaign,
                  "approved"
                )}
              />

              <Step
                title="Payout Released"
                description="Admin releases the Creator payout and completes the Creator transaction."
                state={getStepState(
                  campaign,
                  "completed"
                )}
              />
            </section>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}