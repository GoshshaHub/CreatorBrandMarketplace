"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "../../../components/ProtectedRoute";
import StatCard from "../../../components/StatCard";
import StatusPill from "../../../components/StatusPill";
import { auth } from "../../../lib/firebase";
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
  if (campaign.status === "live_preview") return "Free IRL Preview";

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

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      img.src = reader.result as string;
    };

    img.onload = () => {
      const canvas = document.createElement("canvas");

      const maxWidth = 1200;
      const scale = Math.min(1, maxWidth / img.width);

      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Could not process image."));
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Image compression failed."));
            return;
          }

          resolve(
            new File([blob], "target-image.jpg", {
              type: "image/jpeg",
            })
          );
        },
        "image/jpeg",
        0.82
      );
    };

    img.onerror = () => reject(new Error("Invalid image file."));
    reader.onerror = () => reject(new Error("Could not read image file."));

    reader.readAsDataURL(file);
  });
}

export default function BrandDashboardPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingNotificationId, setWorkingNotificationId] = useState("");
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");

  const [campaignContentUrl, setCampaignContentUrl] = useState("");
  const [targetImage, setTargetImage] = useState<File | null>(null);
  const [firstCampaignTitle, setFirstCampaignTitle] = useState("My First IRL Campaign");
  const [firstProductName, setFirstProductName] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const user = auth.currentUser;

      if (!user) {
        setLoading(false);
        return;
      }

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
    loadDashboard();
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
        c.status === "live_preview"
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

    if (!campaignContentUrl.trim() || !targetImage) {
      alert("Please add your campaign content URL and upload a target image.");
      return;
    }

    setLaunching(true);
    setError("");

    try {
      const formData = new FormData();

      formData.append("brandId", user.uid);
      formData.append("brandName", user.displayName || "Brand");
      formData.append("campaignTitle", firstCampaignTitle || "My First IRL Campaign");
      formData.append("productName", firstProductName || "My Product");
      formData.append("campaignContentUrl", campaignContentUrl.trim());
      const compressedTargetImage = await compressImage(targetImage);
      formData.append("targetImage", compressedTargetImage);

      const res = await fetch("/api/brand/launch-first-campaign", {
        method: "POST",
        body: formData,
      });

      const text = await res.text();

      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text || "Server returned an unexpected response.");
      }

      if (!res.ok) {
        throw new Error(data.error || "Failed to launch first IRL campaign.");
      }

      window.location.href = `/brand/campaign/${data.campaignId}/live`;
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

          <Link href="/brand/creators" className="rounded-lg border px-4 py-2">
            IRL Campaign Network
          </Link>
        </div>

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
                  Turn your existing campaign content into an IRL shelf experience.
                  Paste your social content URL, upload the product image shoppers
                  should scan, and launch your first AR-powered campaign preview.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <input
                    value={firstCampaignTitle}
                    onChange={(e) => setFirstCampaignTitle(e.target.value)}
                    placeholder="Campaign title"
                    className="rounded-xl border px-4 py-3"
                  />

                  <input
                    value={firstProductName}
                    onChange={(e) => setFirstProductName(e.target.value)}
                    placeholder="Product name"
                    className="rounded-xl border px-4 py-3"
                  />

                  <input
                    value={campaignContentUrl}
                    onChange={(e) => setCampaignContentUrl(e.target.value)}
                    placeholder="TikTok, Instagram Reel, YouTube Shorts, campaign page, or video URL"
                    className="rounded-xl border px-4 py-3 md:col-span-2"
                  />

                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setTargetImage(e.target.files?.[0] || null)}
                    className="rounded-xl border bg-white px-4 py-3 md:col-span-2"
                  />
                </div>

                <button
                  onClick={handleLaunchFirstIRL}
                  disabled={launching}
                  className="mt-6 rounded-xl bg-slate-950 px-6 py-3 font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {launching ? "Launching..." : "Launch My Free IRL Campaign"}
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
                              href={`/brand/campaign/${item.campaignId}`}
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
                          View IRL Experience
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