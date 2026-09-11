"use client";

import Link from "next/link";
import AppStoreCta from "../../../components/AppStoreCta";
import { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "../../../components/ProtectedRoute";
import StatCard from "../../../components/StatCard";
import StatusPill from "../../../components/StatusPill";
import { auth } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  isMp4File,
  MAX_RETAIL_MEDIA_TARGET_BYTES,
  MAX_RETAIL_MEDIA_VIDEO_BYTES,
  normalizeRetailMediaTargetImage,
  uploadRetailMediaFile,
} from "../../../lib/retail-media/browser-upload";
import {
  getBrandCampaigns,
  getUserNotifications,
  markNotificationRead,
} from "../../../lib/campaigns";

type Campaign = {
  id: string;
  creatorHandle?: string;
  productName?: string;
  campaignTitle?: string;
  deliveryStartDate?: string;
  deliveryEndDate?: string;
  status?: string;
  fundingStatus?: string;
  completionStatus?: string;
  payoutStatus?: string;
  payoutReleaseStatus?: string;
  brandApprovalStatus?: string;
  totalViews?: number;
  agreedPrice?: number;
  campaignType?: string;
  isFirstFreeIRLLaunch?: boolean;
  arStatus?: string;
  recoveryRequired?: boolean;
  canonicalScanReady?: boolean;
  createdAt?: any;
  updatedAt?: any;
};

type NotificationItem = {
  id: string;
  title?: string;
  message?: string;
  isRead?: boolean;
  read?: boolean;
  campaignId?: string;
  createdAt?: any;
};

function getTimestamp(item: any) {
  return (
    item?.updatedAt?.toMillis?.() ||
    (item?.updatedAt?.seconds ? item.updatedAt.seconds * 1000 : 0) ||
    item?.createdAt?.toMillis?.() ||
    (item?.createdAt?.seconds ? item.createdAt.seconds * 1000 : 0) ||
    0
  );
}

function getCampaignDisplayStatus(campaign: Campaign) {

  if (
  campaign.campaignType === "brand_first_irl_preview" ||
  campaign.isFirstFreeIRLLaunch
) {
  if (campaign.canonicalScanReady === true) {
    return "live";
  }

  if (
    campaign.status === "preparing" ||
    campaign.status === "publishing" ||
    campaign.recoveryRequired
  ) {
    return "preview";
  }
}
  if (campaign.status === "live_preview") return "live";
  if (campaign.payoutStatus === "released") return "live";
  if (campaign.payoutReleaseStatus === "released") return "live";
  if (campaign.status === "completed") return "live";
  if (campaign.status === "live") return "live";
  if (campaign.brandApprovalStatus === "approved") return "approved";
  if (campaign.status === "submitted") return "submitted";
  if (campaign.fundingStatus === "funded") return "funded";
  if (campaign.status === "accepted") return "accepted";
  if (campaign.status === "rejected") return "rejected";
  return "invited";
}

function getFundingDisplay(campaign: Campaign) {
  if (
    campaign.campaignType === "brand_first_irl_preview" ||
    campaign.isFirstFreeIRLLaunch
  ) {
    if (campaign.canonicalScanReady === true) {
      return "Scan-ready";
    }
    return campaign.recoveryRequired ? "Needs assistance" : "AR being prepared";
  }

  if (
    campaign.payoutStatus === "released" ||
    campaign.payoutReleaseStatus === "released" ||
    campaign.status === "completed" ||
    campaign.status === "live"
  ) {
    return "Payout Released";
  }

  if (campaign.brandApprovalStatus === "approved") return "Awaiting Release";
  if (campaign.fundingStatus === "funded") return "Funded";
  return "Not funded";
}

export default function BrandDashboardPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingNotificationId, setWorkingNotificationId] = useState("");
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");

  const [brandName, setBrandName] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [originalVideo, setOriginalVideo] = useState<File | null>(null);
  const [targetImage, setTargetImage] = useState<File | null>(null);
  const [firstCampaignTitle, setFirstCampaignTitle] = useState("My First IRL Campaign");
  const [firstProductName, setFirstProductName] = useState("");
  const [rightsBasis, setRightsBasis] = useState<"brand_owned" | "brand_licensed">("brand_owned");
  const [contentRightsConfirmed, setContentRightsConfirmed] = useState(false);
  const [audioRightsConfirmed, setAudioRightsConfirmed] = useState(false);
  const [appearanceRightsConfirmed, setAppearanceRightsConfirmed] = useState(false);
  const [ocrCorrectionRequired, setOcrCorrectionRequired] = useState(false);
  const [correctedOcrText, setCorrectedOcrText] = useState("");
  const [mediaUploadProgress, setMediaUploadProgress] = useState(0);
  const [targetUploadProgress, setTargetUploadProgress] = useState(0);

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const user = auth.currentUser;

      if (!user) {
        setLoading(false);
        return;
      }

      setBrandName((current) => current || user.displayName || "");

      const [campaignData, notificationData] = await Promise.all([
        getBrandCampaigns(user.uid),
        getUserNotifications(user.uid),
      ]);

      setCampaigns((campaignData || []) as Campaign[]);
      setNotifications((notificationData || []) as NotificationItem[]);
    } catch (err: any) {
      setError(err?.message || "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      await loadDashboard();
    });

    return () => unsubscribe();
  }, []);

  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => getTimestamp(b) - getTimestamp(a));
  }, [campaigns]);

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => getTimestamp(b) - getTimestamp(a));
  }, [notifications]);

  const hasLaunchedFirstIRL = useMemo(() => {
    return campaigns.some(
      (c) =>
        c.isFirstFreeIRLLaunch ||
        c.campaignType === "brand_first_irl_preview" ||
        c.status === "live_preview" ||
        c.status === "preview_ready" ||
        c.status === "ar_live" ||
        (c as any).arStatus === "live"
    );
  }, [campaigns]);

  const invitedCount = useMemo(
    () => campaigns.filter((c) => c.status === "invited").length,
    [campaigns]
  );

  const acceptedAwaitingFundingCount = useMemo(
    () =>
      campaigns.filter(
        (c) => c.status === "accepted" && c.fundingStatus !== "funded"
      ).length,
    [campaigns]
  );

  const fundedInProgressCount = useMemo(
    () =>
      campaigns.filter(
        (c) =>
          c.fundingStatus === "funded" &&
          c.status !== "completed" &&
          c.status !== "live" &&
          c.payoutStatus !== "released" &&
          c.payoutReleaseStatus !== "released"
      ).length,
    [campaigns]
  );

  const liveCount = useMemo(
    () =>
      campaigns.filter(
        (c) =>
          c.status === "live_preview" ||
          c.status === "live" ||
          c.status === "completed" ||
          c.payoutStatus === "released" ||
          c.payoutReleaseStatus === "released"
      ).length,
    [campaigns]
  );

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.isRead && !n.read),
    [notifications]
  );

  async function handleLaunchFirstIRL() {
    const user = auth.currentUser;

    if (!user) {
      alert("You must be logged in.");
      return;
    }

    if (!brandName.trim() || !firstProductName.trim() || !originalVideo || !targetImage) {
      alert("Add your Brand name, product name, original MP4 video, and product image.");
      return;
    }
    if (!isMp4File(originalVideo) || originalVideo.size > MAX_RETAIL_MEDIA_VIDEO_BYTES) {
      alert("Please upload an MP4 video no larger than 250 MB.");
      return;
    }
    if (!contentRightsConfirmed || !audioRightsConfirmed || !appearanceRightsConfirmed) {
      alert("Complete all three rights certifications before publishing.");
      return;
    }

    setLaunching(true);
    setError("");

    try {
      const normalizedTarget = await normalizeRetailMediaTargetImage(targetImage);
      if (normalizedTarget.size > MAX_RETAIL_MEDIA_TARGET_BYTES) {
        throw new Error("The product image must be 25 MB or smaller after conversion.");
      }
      const idToken = await user.getIdToken(true);
      const [mediaStoragePath, targetImageStoragePath] = await Promise.all([
        uploadRetailMediaFile({
          file: originalVideo,
          userId: user.uid,
          kind: "media",
          onProgress: setMediaUploadProgress,
        }),
        uploadRetailMediaFile({
          file: normalizedTarget,
          userId: user.uid,
          kind: "target",
          onProgress: setTargetUploadProgress,
        }),
      ]);

      const res = await fetch("/api/brand/launch-first-campaign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          brandName: brandName.trim(),
          campaignTitle: firstCampaignTitle.trim(),
          productName: firstProductName.trim(),
          destinationUrl: destinationUrl.trim(),
          mediaStoragePath,
          targetImageStoragePath,
          rightsBasis,
          contentRightsConfirmed,
          audioRightsConfirmed,
          appearanceRightsConfirmed,
          correctedOcrText: correctedOcrText.trim(),
          ocrCorrectionConfirmed: ocrCorrectionRequired,
        }),
      });

      const text = await res.text();

      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text || "Server returned an unexpected response.");
      }

      if (!res.ok) {
        if (data.code === "OCR_CORRECTION_REQUIRED") {
          setCorrectedOcrText(String(data.extractedText || ""));
          setOcrCorrectionRequired(true);
        }
        throw new Error(data.error || "Failed to launch first IRL campaign.");
      }

      const campaignId = data.campaignId;
      if (!campaignId) throw new Error("Publication succeeded without a campaign identifier.");
      window.location.href = `/brand/campaign/${campaignId}/live`;
    } catch (err: any) {
      setError(err?.message || "Failed to launch first IRL campaign.");
    } finally {
      setLaunching(false);
    }
  }

  async function handleMarkAsRead(notificationId: string) {
    try {
      setWorkingNotificationId(notificationId);
      await markNotificationRead(notificationId);

      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId
            ? { ...item, isRead: true, read: true }
            : item
        )
      );
    } catch (err: any) {
      setError(err?.message || "Failed to mark notification as read.");
    } finally {
      setWorkingNotificationId("");
    }
  }

  return (
    <ProtectedRoute allowedRole="brand">
      <main className="min-h-screen p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">Brand Dashboard</h1>
            <p className="mt-2 text-gray-600">
              Manage your creator campaigns, funding, submissions, and live
              activity.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Link
              href="/brand/creators"
              className="rounded-lg border px-4 py-2"
            >
              IRL Creator Network
            </Link>

            <Link
              href="/brand/retail-media"
              className="rounded-lg border px-4 py-2"
            >
              Activate Campaign Content
            </Link>

            <Link
              href="/brand/retail-media/direct"
              className="rounded-lg border px-4 py-2"
            >
              IRL Retail Media
            </Link>

            <Link
              href="/brand/invite-creator"
              className="rounded-lg border px-4 py-2"
            >
              Invite My Existing Creator
            </Link>
          </div>

        </div>

        <AppStoreCta
          description="Scan your products and experience your IRL campaigns in Goshsha."
          className="mt-6"
        />

        {error && <p className="mt-6 text-red-600">{error}</p>}

        {loading ? (
          <p className="mt-8">Loading dashboard...</p>
        ) : (
          <>
            {!hasLaunchedFirstIRL && (
              <section className="mt-8 rounded-3xl border border-pink-200 bg-gradient-to-br from-white via-pink-50 to-blue-50 p-8 shadow-xl">
                <p className="text-sm font-bold uppercase tracking-wide text-pink-600">
                  First IRL Campaign Launch
                </p>

                <h2 className="mt-2 text-3xl font-black text-slate-950">
                  Start your free first IRL campaign now.
                </h2>

                <p className="mt-3 max-w-3xl text-gray-600">
                  Publish one Brand-owned or properly licensed video on one product
                  for 30 days, including the first 250 qualified views.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <input
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="Brand name"
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-500"
                  />

                  <input
                    value={firstProductName}
                    onChange={(e) => setFirstProductName(e.target.value)}
                    placeholder="Product name"
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-500"
                  />

                  <input
                    value={firstCampaignTitle}
                    onChange={(e) => setFirstCampaignTitle(e.target.value)}
                    placeholder="Campaign title"
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-500 md:col-span-2"
                  />

                  <label className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 md:col-span-2">
                    Original campaign video (MP4, up to 250 MB)
                    <input
                      type="file"
                      accept=".mp4,video/mp4"
                      onChange={(e) => setOriginalVideo(e.target.files?.[0] || null)}
                      className="mt-2 block w-full file:font-semibold"
                    />
                    {mediaUploadProgress > 0 && mediaUploadProgress < 100 && (
                      <span>Uploading video: {Math.round(mediaUploadProgress)}%</span>
                    )}
                  </label>

                  {ocrCorrectionRequired && (
                    <label className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-slate-800 md:col-span-2">
                      Review product packaging text
                      <span className="mt-1 block text-slate-600">
                        Automatic packaging recognition needs your help. Correct this text to match the words visible on the uploaded package.
                      </span>
                      <textarea
                        value={correctedOcrText}
                        onChange={(e) => setCorrectedOcrText(e.target.value)}
                        className="mt-3 min-h-28 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
                      />
                    </label>
                  )}

                  <label className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 md:col-span-2">
                    Exact product image shoppers will scan
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif"
                      onChange={(e) => {
                        setTargetImage(e.target.files?.[0] || null);
                        setOcrCorrectionRequired(false);
                        setCorrectedOcrText("");
                      }}
                    className="mt-2 block w-full file:font-semibold"
                  />
                    {targetUploadProgress > 0 && targetUploadProgress < 100 && (
                      <span>Uploading image: {Math.round(targetUploadProgress)}%</span>
                    )}
                  </label>

                  <input
                    value={destinationUrl}
                    onChange={(e) => setDestinationUrl(e.target.value)}
                    placeholder="Optional shopper destination URL"
                    type="url"
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-500 md:col-span-2"
                  />

                  <label className="md:col-span-2 text-sm font-semibold text-slate-800">
                    Content rights basis
                    <select
                      value={rightsBasis}
                      onChange={(e) => setRightsBasis(e.target.value as "brand_owned" | "brand_licensed")}
                      className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
                    >
                      <option value="brand_owned">Brand-owned content</option>
                      <option value="brand_licensed">Content licensed to the Brand</option>
                    </select>
                  </label>

                  <label className="flex gap-3 text-sm text-slate-700 md:col-span-2">
                    <input type="checkbox" checked={contentRightsConfirmed}
                      onChange={(e) => setContentRightsConfirmed(e.target.checked)} />
                    <span>I confirm the Brand owns or has sufficient rights to use and publish this content.</span>
                  </label>
                  <label className="flex gap-3 text-sm text-slate-700 md:col-span-2">
                    <input type="checkbox" checked={audioRightsConfirmed}
                      onChange={(e) => setAudioRightsConfirmed(e.target.checked)} />
                    <span>I confirm the Brand has sufficient rights to the audio in this video.</span>
                  </label>
                  <label className="flex gap-3 text-sm text-slate-700 md:col-span-2">
                    <input type="checkbox" checked={appearanceRightsConfirmed}
                      onChange={(e) => setAppearanceRightsConfirmed(e.target.checked)} />
                    <span>I confirm appearance rights for every person shown in this video.</span>
                  </label>
                </div>

                <button
                  onClick={handleLaunchFirstIRL}
                  disabled={launching}
                  className="mt-6 rounded-xl bg-slate-950 px-6 py-3 font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {launching ? "Reading product packaging..." : "Publish My Free IRL Campaign"}
                </button>
              </section>
            )}

            <div className="mt-8 grid gap-4 md:grid-cols-4">
              <StatCard label="New Invites" value={invitedCount} />
              <StatCard
                label="Awaiting Funding"
                value={acceptedAwaitingFundingCount}
              />
              <StatCard label="In Progress" value={fundedInProgressCount} />
              <StatCard label="Live Campaigns" value={liveCount} />
            </div>

            <section className="mt-10">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-semibold">Updates</h2>

                {unreadNotifications.length > 0 && (
                  <span className="rounded-full bg-black px-3 py-1 text-sm text-white">
                    {unreadNotifications.length} unread
                  </span>
                )}
              </div>

              {sortedNotifications.length === 0 ? (
                <p className="mt-4 text-gray-600">No updates yet.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {sortedNotifications.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border p-5 flex items-start justify-between gap-4"
                    >
                      <div>
                        <h3 className="font-semibold">
                          {item.title || "Notification"}
                        </h3>

                        <p className="mt-1 text-gray-700">
                          {item.message || ""}
                        </p>

                        {item.campaignId && (
                          <div className="mt-4">
                            <Link
                              href={
                                item.title?.toLowerCase().includes("scan-ready")
                                  ? `/brand/campaign/${item.campaignId}/live`
                                  : `/brand/campaign/${item.campaignId}`
                              }
                              className="inline-block rounded-lg border px-4 py-2"
                            >
                              View Campaign
                            </Link>
                          </div>
                        )}
                      </div>

                      {!item.isRead && !item.read && (
                        <button
                          onClick={() => handleMarkAsRead(item.id)}
                          disabled={workingNotificationId === item.id}
                          className="rounded-lg border px-4 py-2 whitespace-nowrap"
                        >
                          {workingNotificationId === item.id
                            ? "Marking..."
                            : "Mark as Read"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-10">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-2xl font-semibold">Campaigns</h2>
              </div>

              {sortedCampaigns.length === 0 ? (
                <p className="mt-4 text-gray-600">No campaigns yet.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {sortedCampaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className="rounded-2xl border p-6 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-semibold">
                            {campaign.campaignTitle || "Untitled Campaign"}
                          </h3>

                          <p className="mt-1 text-gray-600">
                            Creator: {campaign.creatorHandle || "—"}
                          </p>

                          <p className="text-gray-600">
                            Product: {campaign.productName || "—"}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <StatusPill
                            status={getCampaignDisplayStatus(campaign)}
                          />

                          <span className="text-sm text-gray-500">
                            Funding: {getFundingDisplay(campaign)}
                          </span>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-4 text-sm text-gray-700">
                        <p>Start: {campaign.deliveryStartDate || "Not set"}</p>
                        <p>End: {campaign.deliveryEndDate || "Not set"}</p>
                        <p>Views: {campaign.totalViews ?? 0}</p>
                        <p>Budget: ${campaign.agreedPrice ?? 0}</p>
                      </div>

                      <div className="pt-2 flex flex-wrap gap-3">
                        <Link
                          href={
                            campaign.campaignType === "brand_first_irl_preview"
                              ? `/brand/campaign/${campaign.id}/live`
                              : `/brand/campaign/${campaign.id}`
                          }
                          className="inline-block rounded-lg border px-4 py-2"
                        >
                          {campaign.campaignType === "brand_first_irl_preview" ||
                          campaign.isFirstFreeIRLLaunch
                            ? campaign.recoveryRequired
                              ? "Resume Publication"
                              : "View IRL Experience"
                            : "View Campaign Details"}
                        </Link>

                        {campaign.status === "live_preview" && (
                          <Link
                            href={`/brand/campaign/${campaign.id}/live`}
                            className="inline-block rounded-lg bg-slate-950 px-4 py-2 text-white"
                          >
                            View Live Preview
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </ProtectedRoute>
  );
}
