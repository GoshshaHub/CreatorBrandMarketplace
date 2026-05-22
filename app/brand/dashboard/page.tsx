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

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [contentUrl, setContentUrl] = useState("");
  const [targetImage, setTargetImage] = useState<File | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const user = auth.currentUser;
      if (!user) return;

      const [campaignData, notificationData] = await Promise.all([
        getBrandCampaigns(user.uid),
        getUserNotifications(user.uid),
      ]);

      setCampaigns(campaignData || []);
      setNotifications(notificationData || []);

      // 👇 SHOW ONBOARDING IF NO CAMPAIGNS
      if (!campaignData || campaignData.length === 0) {
        setShowOnboarding(true);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function handleLaunch() {
    if (!contentUrl || !targetImage) {
      alert("Please provide content URL and image.");
      return;
    }

    const formData = new FormData();
    formData.append("campaignContentUrl", contentUrl);
    formData.append("targetImage", targetImage);
    formData.append("campaignTitle", "My First IRL Campaign");
    formData.append("productName", "My Product");

    const res = await fetch("/api/brand/launch-first-campaign", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Failed to launch.");
      return;
    }

    setShowOnboarding(false);

    window.location.href = `/brand/campaign/${data.campaignId}/live`;
  }

  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => getTimestamp(b) - getTimestamp(a));
  }, [campaigns]);

  return (
    <ProtectedRoute allowedRole="brand">
      <main className="min-h-screen p-6 max-w-6xl mx-auto">

        {/* 🔥 ONBOARDING BLOCK */}
        {showOnboarding && (
          <div className="mb-10 rounded-3xl border bg-gradient-to-br from-white via-pink-50 to-blue-50 p-8 shadow-xl">
            <h2 className="text-3xl font-black">
              Start your first IRL Campaign
            </h2>

            <p className="mt-2 text-gray-600">
              Takes less than 2 minutes.
            </p>

            <input
              value={contentUrl}
              onChange={(e) => setContentUrl(e.target.value)}
              placeholder="Paste TikTok / Instagram / YouTube URL"
              className="mt-6 w-full rounded-xl border px-4 py-3"
            />

            <input
              type="file"
              onChange={(e) => setTargetImage(e.target.files?.[0] || null)}
              className="mt-4 w-full rounded-xl border px-4 py-3"
            />

            <button
              onClick={handleLaunch}
              className="mt-6 rounded-xl bg-black px-6 py-3 text-white font-bold"
            >
              Launch My Free IRL Campaign
            </button>
          </div>
        )}

        {/* EXISTING DASHBOARD */}
        <h1 className="text-4xl font-bold">Brand Dashboard</h1>

        {loading ? (
          <p className="mt-8">Loading...</p>
        ) : (
          <>
            <div className="mt-8 grid gap-4 md:grid-cols-4">
              <StatCard label="Total Campaigns" value={campaigns.length} />
            </div>

            <div className="mt-10 space-y-4">
              {sortedCampaigns.map((campaign) => (
                <div key={campaign.id} className="rounded-xl border p-4">
                  <h3 className="font-semibold">
                    {campaign.campaignTitle}
                  </h3>

                  <p className="text-sm text-gray-600">
                    {campaign.productName}
                  </p>

                  <Link
                    href={`/brand/campaign/${campaign.id}`}
                    className="mt-3 inline-block text-blue-600"
                  >
                    View Campaign
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </ProtectedRoute>
  );
}