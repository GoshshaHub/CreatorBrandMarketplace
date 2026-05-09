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
  const [error, setError] = useState("");

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

                      <div className="pt-2">
                        <Link
                          href={`/brand/campaign/${campaign.id}`}
                          className="inline-block rounded-lg border px-4 py-2"
                        >
                          View Campaign
                        </Link>
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