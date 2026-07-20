"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";
import { useParams } from "next/navigation";

import ProtectedRoute from "../../../../components/ProtectedRoute";

import {
  Campaign,
  getCampaignById,
} from "../../../../lib/campaigns";

import {
  ref,
  uploadBytesResumable,
} from "firebase/storage";

import {
  auth,
  storage,
} from "../../../../lib/firebase";

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
    campaign.payoutStatus as
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

  if (stepIndex < currentIndex) {
    return "done";
  }

  if (stepIndex === currentIndex) {
    return "current";
  }

  return "upcoming";
}

function isAllowedMediaFile(
  file: File
): boolean {
  return (
    file.type.startsWith("video/") ||
    file.type.startsWith("image/")
  );
}

function isValidHttpUrl(
  value: string
): boolean {
  try {
    const parsedUrl = new URL(value);

    return (
      parsedUrl.protocol === "https:" ||
      parsedUrl.protocol === "http:"
    );
  } catch {
    return false;
  }
}

export default function CreatorCampaignDetailPage() {
  const params =
    useParams<{
      id: string;
    }>();

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
    submissionUrl,
    setSubmissionUrl,
  ] =
    useState("");

  const [
    originalMedia,
    setOriginalMedia,
  ] =
    useState<File | null>(
      null
    );

  const [
    uploadProgress,
    setUploadProgress,
  ] =
    useState(0);

  const [
    contentRightsConfirmed,
    setContentRightsConfirmed,
  ] =
    useState(false);

  const [
    audioRightsConfirmed,
    setAudioRightsConfirmed,
  ] =
    useState(false);

  const [
    appearanceRightsConfirmed,
    setAppearanceRightsConfirmed,
  ] =
    useState(false);

  const [
    creatorRetainsCopyright,
    setCreatorRetainsCopyright,
  ] =
    useState(false);

  const [
    brandUsageLicenseGranted,
    setBrandUsageLicenseGranted,
  ] =
    useState(false);

  const [
    goshshaDistributionLicenseGranted,
    setGoshshaDistributionLicenseGranted,
  ] =
    useState(false);

  const [
    postWindowRoyaltyAcknowledged,
    setPostWindowRoyaltyAcknowledged,
  ] =
    useState(false);

  const [
    futureRoyaltyEarningsAcknowledged,
    setFutureRoyaltyEarningsAcknowledged,
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

  async function loadCampaign() {
    setLoading(true);
    setError("");

    try {
      const data =
        await getCampaignById(
          campaignId
        );

      setCampaign(data);

      setSubmissionUrl(
        data?.normalizedArContentUrl ||
          ""
      );
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
        return "Review the campaign and accept or reject the invite.";
      }

      if (status === "accepted") {
        return "You accepted. Waiting for the Brand to fund the campaign.";
      }

      if (status === "funded") {
        return "Campaign is funded. Upload your original content, add the published post URL, and complete all rights and licensing acknowledgments.";
      }

      if (status === "submitted") {
        return "Submission received. Waiting for Brand approval.";
      }

      if (status === "approved") {
        return "The Brand approved your work. Waiting for Admin to release payout.";
      }

      if (status === "completed") {
        return "Payout released. Campaign completed.";
      }

      if (status === "rejected") {
        return "Campaign rejected.";
      }

      return "";
    }, [campaign]);

  const requiredSubmissionTermsAccepted =
    contentRightsConfirmed &&
    audioRightsConfirmed &&
    appearanceRightsConfirmed &&
    creatorRetainsCopyright &&
    brandUsageLicenseGranted &&
    goshshaDistributionLicenseGranted &&
    postWindowRoyaltyAcknowledged &&
    futureRoyaltyEarningsAcknowledged;

  const validSubmissionUrl =
    submissionUrl.trim().length > 0 &&
    isValidHttpUrl(
      submissionUrl.trim()
    );

  const submissionReady =
    Boolean(originalMedia) &&
    validSubmissionUrl &&
    requiredSubmissionTermsAccepted;

  async function handleStatus(
    status:
      | "accepted"
      | "rejected"
  ) {
    setWorking(true);
    setError("");
    setMessage("");

    try {
      const res =
        await fetch(
          "/api/update-campaign-status",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                campaignId,
                status,
              }),
          }
        );

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Failed to update campaign."
        );
      }

      setMessage(
        status === "accepted"
          ? "Campaign accepted."
          : "Campaign rejected."
      );

      await loadCampaign();
    } catch (err: any) {
      setError(
        err?.message ||
          "Could not update campaign."
      );
    } finally {
      setWorking(false);
    }
  }

  async function uploadCreatorMedia(
    file: File
  ): Promise<string> {
    const user =
      auth.currentUser;

    if (!user) {
      throw new Error(
        "Please log in again."
      );
    }

    if (
      !isAllowedMediaFile(file)
    ) {
      throw new Error(
        "Only image and video files are supported."
      );
    }

    const safeFileName =
      file.name
        .replace(
          /[^a-zA-Z0-9._-]/g,
          "-"
        )
        .replace(
          /-+/g,
          "-"
        );

    const timestamp =
      Date.now();

    const storagePath =
      `creator-submissions/` +
      `${user.uid}/` +
      `${campaignId}/` +
      `${timestamp}-` +
      `${safeFileName}`;

    const storageRef =
      ref(
        storage,
        storagePath
      );

    const uploadTask =
      uploadBytesResumable(
        storageRef,
        file,
        {
          contentType:
            file.type ||
            "application/octet-stream",

          customMetadata: {
            campaignId,
            creatorId:
              user.uid,
            originalFileName:
              file.name,
          },
        }
      );

    await new Promise<void>(
      (
        resolve,
        reject
      ) => {
        uploadTask.on(
          "state_changed",

          (snapshot) => {
            const percentage =
              snapshot.totalBytes > 0
                ? Math.round(
                    (snapshot.bytesTransferred /
                      snapshot.totalBytes) *
                      100
                  )
                : 0;

            setUploadProgress(
              percentage
            );
          },

          (uploadError) => {
            reject(
              uploadError
            );
          },

          () => {
            resolve();
          }
        );
      }
    );

    return storagePath;
  }

  async function handleSubmitContent() {
    const user =
      auth.currentUser;

    if (!user) {
      setError(
        "Please log in again."
      );

      return;
    }

    if (!originalMedia) {
      setError(
        "Please upload your original image or video."
      );

      return;
    }

    if (
      !isAllowedMediaFile(
        originalMedia
      )
    ) {
      setError(
        "Only image and video files are supported."
      );

      return;
    }

    const cleanedSubmissionUrl =
      submissionUrl.trim();

    if (!cleanedSubmissionUrl) {
      setError(
        "Please enter the published post URL."
      );

      return;
    }

    if (
      !isValidHttpUrl(
        cleanedSubmissionUrl
      )
    ) {
      setError(
        "Please enter a valid published post URL beginning with http:// or https://."
      );

      return;
    }

    if (
      !contentRightsConfirmed
    ) {
      setError(
        "Please confirm that you created the content or have the right to submit and license it."
      );

      return;
    }

    if (
      !audioRightsConfirmed
    ) {
      setError(
        "Please confirm that the included audio is cleared for the Goshsha experience."
      );

      return;
    }

    if (
      !appearanceRightsConfirmed
    ) {
      setError(
        "Please confirm that you have permission from identifiable people appearing in the content."
      );

      return;
    }

    if (
      !creatorRetainsCopyright
    ) {
      setError(
        "Please confirm the copyright ownership statement."
      );

      return;
    }

    if (
      !brandUsageLicenseGranted
    ) {
      setError(
        "Please grant the Brand permission to use the approved content for this campaign."
      );

      return;
    }

    if (
      !goshshaDistributionLicenseGranted
    ) {
      setError(
        "Please authorize Goshsha to distribute the approved content through its retail media infrastructure."
      );

      return;
    }

    if (
      !postWindowRoyaltyAcknowledged
    ) {
      setError(
        "Please acknowledge the post-campaign licensing and royalty terms."
      );

      return;
    }

    if (
      !futureRoyaltyEarningsAcknowledged
    ) {
      setError(
        "Please acknowledge the future royalty earnings opportunity."
      );

      return;
    }

    setWorking(true);
    setUploadProgress(0);
    setError("");
    setMessage("");

    try {
      const mediaStoragePath =
        await uploadCreatorMedia(
          originalMedia
        );

      const idToken =
        await user.getIdToken();

      const res =
        await fetch(
          "/api/submit-campaign-link",
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
                  cleanedSubmissionUrl,

                mediaStoragePath,

                mediaOriginalName:
                  originalMedia.name,

                mediaContentType:
                  originalMedia.type ||
                  "application/octet-stream",

                mediaSizeBytes:
                  originalMedia.size,

                contentRightsConfirmed,

                audioRightsConfirmed,

                appearanceRightsConfirmed,

                creatorRetainsCopyright,

                brandUsageLicenseGranted,

                goshshaDistributionLicenseGranted,

                postWindowRoyaltyAcknowledged,

                futureRoyaltyEarningsAcknowledged,
              }),
          }
        );

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Failed to submit content."
        );
      }

      setMessage(
        "Content, published URL, rights, and licensing information submitted. The Brand has been notified."
      );

      setOriginalMedia(null);
      setUploadProgress(0);

      await loadCampaign();
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to submit content."
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <ProtectedRoute allowedRole="creator">
      <main className="min-h-screen max-w-4xl mx-auto bg-white p-6 text-slate-900 dark:bg-slate-950 dark:text-white">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              Campaign
            </h1>

            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Track what is done and what is next.
            </p>
          </div>

          <Link
            href="/creator/dashboard"
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
          <p className="mt-6 text-red-600">
            {error}
          </p>
        )}

        {message && (
          <p className="mt-6 text-green-600">
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

              <div className="mt-6 rounded-xl bg-slate-100 p-4 dark:bg-slate-800">
                <p className="font-semibold">
                  Next step
                </p>

                <p className="mt-1 text-slate-700 dark:text-slate-300">
                  {nextAction}
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {campaign.status ===
                  "invited" && (
                  <>
                    <button
                      onClick={() =>
                        handleStatus(
                          "accepted"
                        )
                      }
                      disabled={
                        working
                      }
                      className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                    >
                      Accept Campaign
                    </button>

                    <button
                      onClick={() =>
                        handleStatus(
                          "rejected"
                        )
                      }
                      disabled={
                        working
                      }
                      className="rounded-lg border px-4 py-2"
                    >
                      Reject
                    </button>
                  </>
                )}

                {campaign.status ===
                  "funded" && (
                  <div className="w-full space-y-6">
                    <div>
                      <label className="block font-semibold">
                        Upload your original content
                      </label>

                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        Required. Upload the original image or video file created for this campaign.
                      </p>

                      <input
                        type="file"
                        accept="video/*,image/*"
                        required
                        onChange={(
                          event
                        ) => {
                          const file =
                            event
                              .target
                              .files?.[0] ||
                            null;

                          if (
                            file &&
                            !isAllowedMediaFile(
                              file
                            )
                          ) {
                            setOriginalMedia(
                              null
                            );

                            setError(
                              "Only image and video files are supported."
                            );

                            return;
                          }

                          setError("");
                          setOriginalMedia(
                            file
                          );
                          setUploadProgress(
                            0
                          );
                        }}
                        className="mt-3 w-full rounded-lg border px-3 py-2"
                      />

                      {originalMedia && (
                        <div className="mt-3 rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800">
                          <p>
                            <strong>
                              Selected:
                            </strong>{" "}
                            {
                              originalMedia.name
                            }
                          </p>

                          <p className="mt-1 text-slate-600 dark:text-slate-400">
                            Type:{" "}
                            {originalMedia.type ||
                              "Unknown"}
                          </p>

                          <p className="text-slate-600 dark:text-slate-400">
                            Size:{" "}
                            {(
                              originalMedia.size /
                              1024 /
                              1024
                            ).toFixed(
                              2
                            )}{" "}
                            MB
                          </p>
                        </div>
                      )}

                      {working &&
                        uploadProgress >
                          0 && (
                          <div className="mt-3">
                            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                              <div
                                className="h-full bg-slate-900 dark:bg-white"
                                style={{
                                  width:
                                    `${uploadProgress}%`,
                                }}
                              />
                            </div>

                            <p className="mt-1 text-sm">
                              Uploading:{" "}
                              {
                                uploadProgress
                              }
                              %
                            </p>
                          </div>
                        )}
                    </div>

                    <div>
                      <label className="block font-semibold">
                        Published post URL
                      </label>

                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        Required. Enter the public TikTok, Instagram, YouTube, or other published campaign post link.
                      </p>

                      <input
                        type="url"
                        required
                        className="mt-2 w-full rounded-lg border px-3 py-2"
                        placeholder="https://..."
                        value={
                          submissionUrl
                        }
                        onChange={(
                          event
                        ) =>
                          setSubmissionUrl(
                            event
                              .target
                              .value
                          )
                        }
                      />

                      {submissionUrl.trim() &&
                        !validSubmissionUrl && (
                          <p className="mt-2 text-sm text-red-600">
                            Enter a valid URL beginning with http:// or https://.
                          </p>
                        )}
                    </div>

                    <div className="space-y-4 rounded-xl border border-slate-200 p-5 dark:border-slate-700">
                      <div>
                        <p className="font-semibold">
                          Rights certification
                        </p>

                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                          Every certification below is required.
                        </p>
                      </div>

                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={
                            contentRightsConfirmed
                          }
                          onChange={(
                            event
                          ) =>
                            setContentRightsConfirmed(
                              event
                                .target
                                .checked
                            )
                          }
                          className="mt-1"
                        />

                        <span className="text-sm">
                          <strong>
                            Required.
                          </strong>{" "}
                          I created this content or otherwise have the right to submit and license it for this campaign.
                        </span>
                      </label>

                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={
                            audioRightsConfirmed
                          }
                          onChange={(
                            event
                          ) =>
                            setAudioRightsConfirmed(
                              event
                                .target
                                .checked
                            )
                          }
                          className="mt-1"
                        />

                        <span className="text-sm">
                          <strong>
                            Required.
                          </strong>{" "}
                          I confirm that the audio included in this content is cleared for use in the Goshsha retail media and AR experience.
                        </span>
                      </label>

                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={
                            appearanceRightsConfirmed
                          }
                          onChange={(
                            event
                          ) =>
                            setAppearanceRightsConfirmed(
                              event
                                .target
                                .checked
                            )
                          }
                          className="mt-1"
                        />

                        <span className="text-sm">
                          <strong>
                            Required.
                          </strong>{" "}
                          I have permission from all identifiable people appearing in the submitted content.
                        </span>
                      </label>

                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={
                            creatorRetainsCopyright
                          }
                          onChange={(
                            event
                          ) =>
                            setCreatorRetainsCopyright(
                              event
                                .target
                                .checked
                            )
                          }
                          className="mt-1"
                        />

                        <span className="text-sm">
                          <strong>
                            Required.
                          </strong>{" "}
                          I retain ownership of the submitted content unless a separate written agreement states otherwise.
                        </span>
                      </label>
                    </div>

                    <div className="space-y-4 rounded-xl border border-pink-200 bg-pink-50 p-5 text-slate-900">
                      <div>
                        <p className="font-semibold">
                          Retail media licensing
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          Every acknowledgment below is required.
                        </p>
                      </div>

                      <div className="rounded-lg bg-white p-4 text-sm">
                        <p className="font-semibold">
                          Initial 90-Day Retail Media License
                        </p>

                        <p className="mt-1 text-slate-600">
                          The initial license covers 90 days of active Goshsha retail media distribution. The 90-day period begins only when the content becomes active in the Goshsha experience—not when you submit it and not when the Brand approves it.
                        </p>
                      </div>

                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={
                            brandUsageLicenseGranted
                          }
                          onChange={(
                            event
                          ) =>
                            setBrandUsageLicenseGranted(
                              event
                                .target
                                .checked
                            )
                          }
                          className="mt-1"
                        />

                        <span className="text-sm">
                          <strong>
                            Required.
                          </strong>{" "}
                          I grant the Brand permission to use the approved content for this campaign and its connected Goshsha product experience during the applicable license period.
                        </span>
                      </label>

                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={
                            goshshaDistributionLicenseGranted
                          }
                          onChange={(
                            event
                          ) =>
                            setGoshshaDistributionLicenseGranted(
                              event
                                .target
                                .checked
                            )
                          }
                          className="mt-1"
                        />

                        <span className="text-sm">
                          <strong>
                            Required.
                          </strong>{" "}
                          I authorize Goshsha to host, process, display, and distribute the approved content through its retail media and AR infrastructure during the applicable license period.
                        </span>
                      </label>

                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={
                            postWindowRoyaltyAcknowledged
                          }
                          onChange={(
                            event
                          ) =>
                            setPostWindowRoyaltyAcknowledged(
                              event
                                .target
                                .checked
                            )
                          }
                          className="mt-1"
                        />

                        <span className="text-sm">
                          <strong>
                            Required.
                          </strong>{" "}
                          I understand that the Brand’s initial usage rights end when the 90-day active license period expires. Continued use requires a new paid license, renewal, or qualified-view royalty arrangement.
                        </span>
                      </label>

                      <div className="rounded-lg border border-pink-200 bg-white p-4">
                        <p className="font-semibold">
                          Future Royalty Earnings
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          After the initial license period ends, approved content may become eligible for future paid retail media use through Goshsha.
                        </p>
                      </div>

                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={
                            futureRoyaltyEarningsAcknowledged
                          }
                          onChange={(
                            event
                          ) =>
                            setFutureRoyaltyEarningsAcknowledged(
                              event
                                .target
                                .checked
                            )
                          }
                          className="mt-1"
                        />

                        <span className="text-sm">
                          <strong>
                            Required—Future Royalty Earnings Acknowledgment.
                          </strong>{" "}
                          I understand that after the initial 90-day license ends, my content may become eligible for future paid retail media use through Goshsha. Any reactivation requires a new paid license, renewal, or qualified-view royalty arrangement and does not automatically extend the Brand’s usage rights.
                        </span>
                      </label>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800">
                      <p className="font-semibold">
                        What the Brand will review
                      </p>

                      <p className="mt-2 text-slate-600 dark:text-slate-300">
                        The Brand will review your published post URL, original media, rights certifications, and retail media licensing acknowledgments before approving the campaign deliverable.
                      </p>

                      <p className="mt-2 text-slate-600 dark:text-slate-300">
                        Brand approval makes your payout ready for Admin release. Your payout does not depend on when the Brand later uploads its product target image or activates the AR experience.
                      </p>
                    </div>

                    <button
                      onClick={
                        handleSubmitContent
                      }
                      disabled={
                        working ||
                        !submissionReady
                      }
                      className="rounded-lg bg-black px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {working
                        ? uploadProgress < 100
                          ? `Uploading ${uploadProgress}%`
                          : "Submitting..."
                        : "Submit Complete Package for Brand Approval"}
                    </button>

                    {!submissionReady && (
                      <p className="text-sm text-slate-500">
                        Upload the original media, enter a valid published post URL, and accept every required rights and licensing acknowledgment before submitting.
                      </p>
                    )}
                  </div>
                )}

                {campaign.normalizedArContentUrl && (
                  <a
                    href={
                      campaign.normalizedArContentUrl
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border px-4 py-2"
                  >
                    View Submitted URL
                  </a>
                )}

                {(campaign as any)
                  .creatorMediaUrl && (
                  <a
                    href={
                      (campaign as any)
                        .creatorMediaUrl
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border px-4 py-2"
                  >
                    View Submitted Media
                  </a>
                )}
              </div>

              <div className="mt-8 grid gap-3 text-sm text-slate-700 dark:text-slate-300">
                <p>
                  Brand:{" "}
                  {campaign.brandName ||
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
                  Your Payout: $
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
                title="Invited"
                description="You were invited to this campaign."
                state={getStepState(
                  campaign,
                  "invited"
                )}
              />

              <Step
                title="Accepted"
                description="You accepted the campaign."
                state={getStepState(
                  campaign,
                  "accepted"
                )}
              />

              <Step
                title="Funded"
                description="The Brand funded the campaign so work can begin."
                state={getStepState(
                  campaign,
                  "funded"
                )}
              />

              <Step
                title="Submitted"
                description="You submitted the published URL, original media, rights certifications, and licensing acknowledgments."
                state={getStepState(
                  campaign,
                  "submitted"
                )}
              />

              <Step
                title="Brand Approved"
                description="The Brand approves your complete campaign deliverable."
                state={getStepState(
                  campaign,
                  "approved"
                )}
              />

              <Step
                title="Payout Released"
                description="Admin releases payout and completes the Creator transaction."
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