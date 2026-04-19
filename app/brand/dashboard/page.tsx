"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "../../../components/ProtectedRoute";
import StatCard from "../../../components/StatCard";
import StatusPill from "../../../components/StatusPill";
import { auth } from "../../../lib/firebase";
import {
  fundCampaign,
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
};

type NotificationItem = {
  id: string;
  title?: string;
  message?: string;
  isRead?: boolean;
  campaignId?: string;
};

export default function BrandDashboardPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyCampaignId, setBusyCampaignId] = useState("");

  async function loadDashboard() {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("You must be logged in.");

      const campaignData = await getBrandCampaigns(user.uid);
      setCampaigns(campaignData as Campaign[]);

      const notificationData = await getUserNotifications(user.uid);
      setNotifications(notificationData as NotificationItem[]);
    } catch (err: any) {
      setError(err.message || "We couldn’t load your dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function handleFund(campaignId: string) {
    try {
      setBusyCampaignId(campaignId);
      await fundCampaign(campaignId);
      await loadDashboard();
    } catch (err: any) {
      setError(err.message || "We couldn’t fund this campaign.");
    } finally {
      setBusyCampaignId("");
    }
  }

  async function handleMarkRead(notificationId: string) {
    try {
      await markNotificationRead(notificationId);
      await loadDashboard();
    } catch (err: any) {
      setError(err.message || "We couldn’t update this notification.");
    }
  }

  const stats = useMemo(() => {
    const total = campaigns.length;
    const awaitingResponse = campaigns.filter((c) => c.status === "invited").length;
    const awaitingFunding = campaigns.filter(
      (c) => c.status === "accepted" && c.fundingStatus === "not_funded"
    ).length;
    const live = campaigns.filter((c) => c.status === "live").length;

    return { total, awaitingResponse, awaitingFunding, live };
  }, [campaigns]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <ProtectedRoute allowedRole="brand">
      <main className="app-page">
        <div className="app-shell">
          <div className="app-header">
            <div>
              <h1 className="app-title">Brand Dashboard</h1>
              <p className="app-subtitle">
                Track creator outreach, funding, and campaign delivery in one place.
              </p>
            </div>

            <Link href="/brand/creators" className="app-button">
              Find Creators
            </Link>
          </div>

          {loading && (
            <p className="app-subtitle" style={{ marginTop: "24px" }}>
              Loading your dashboard...
            </p>
          )}
          {error && !loading && (
            <p style={{ marginTop: "24px", color: "#dc2626" }}>{error}</p>
          )}

          <div className="app-stat-grid">
            <StatCard label="Total Campaigns" value={stats.total} />
            <StatCard label="Awaiting Response" value={stats.awaitingResponse} />
            <StatCard label="Ready to Fund" value={stats.awaitingFunding} />
            <StatCard label="Live Campaigns" value={stats.live} />
          </div>

          <section className="app-section">
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <h2 className="app-section-title">Updates</h2>
              {unreadCount > 0 && (
                <span className="app-badge">{unreadCount} unread</span>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="app-card app-card-padding" style={{ marginTop: "16px" }}>
                <p className="app-text" style={{ margin: 0, fontWeight: 600 }}>
                  You’re all caught up
                </p>
                <p className="app-text-soft" style={{ marginTop: "8px", marginBottom: 0 }}>
                  Creator replies, submissions, and live campaign updates will appear here.
                </p>
              </div>
            ) : (
              <div className="app-list">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`app-card app-card-padding ${
                      notification.isRead ? "" : "app-notification-unread"
                    }`}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "16px",
                        alignItems: "flex-start",
                      }}
                    >
                      <div>
                        {notification.campaignId ? (
                          <Link href={`/brand/campaign/${notification.campaignId}`}>
                            <p
                              className="app-text"
                              style={{ margin: 0, fontWeight: 600, textDecoration: "underline" }}
                            >
                              {notification.title || "Update"}
                            </p>
                          </Link>
                        ) : (
                          <p className="app-text" style={{ margin: 0, fontWeight: 600 }}>
                            {notification.title || "Update"}
                          </p>
                        )}

                        <p
                          className="app-text-soft"
                          style={{ marginTop: "8px", marginBottom: 0 }}
                        >
                          {notification.message || ""}
                        </p>
                      </div>

                      {!notification.isRead && (
                        <button
                          onClick={() => handleMarkRead(notification.id)}
                          className="app-button-secondary"
                        >
                          Mark as Read
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="app-section">
            <h2 className="app-section-title">Campaigns</h2>

            {campaigns.length === 0 && !loading ? (
              <div className="app-card app-card-padding" style={{ marginTop: "16px" }}>
                <p className="app-text" style={{ margin: 0, fontWeight: 600 }}>
                  No campaigns yet
                </p>
                <p className="app-text-soft" style={{ marginTop: "8px" }}>
                  Start by choosing a creator and sending your first campaign invite.
                </p>
                <div style={{ marginTop: "16px" }}>
                  <Link href="/brand/creators" className="app-button">
                    Browse Creators
                  </Link>
                </div>
              </div>
            ) : (
              <div className="app-campaign-grid">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="app-card app-card-padding">
                    <div className="app-campaign-top">
                      <div>
                        <Link href={`/brand/campaign/${campaign.id}`}>
                          <h3
                            className="app-text"
                            style={{
                              margin: 0,
                              fontSize: "1.5rem",
                              fontWeight: 700,
                              textDecoration: "underline",
                            }}
                          >
                            {campaign.campaignTitle || "Untitled Campaign"}
                          </h3>
                        </Link>
                        <p className="app-text-soft" style={{ marginTop: "12px" }}>
                          Creator: {campaign.creatorHandle || "Unknown creator"}
                        </p>
                        <p className="app-text-soft">Product: {campaign.productName || "-"}</p>
                        <p className="app-text-faint" style={{ marginTop: "8px" }}>
                          Delivery Window: {campaign.deliveryStartDate || "-"} →{" "}
                          {campaign.deliveryEndDate || "-"}
                        </p>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <StatusPill status={campaign.status} />
                        <span className="app-text-faint">
                          Funding: {campaign.fundingStatus || "not_funded"}
                        </span>
                      </div>
                    </div>

                    <div className="app-inline-actions">
                      <Link
                        href={`/brand/campaign/${campaign.id}`}
                        className="app-button-secondary"
                      >
                        View Campaign
                      </Link>

                      {campaign.status === "accepted" &&
                        campaign.fundingStatus === "not_funded" && (
                          <button
                            onClick={() => handleFund(campaign.id)}
                            disabled={busyCampaignId === campaign.id}
                            className="app-button"
                          >
                            {busyCampaignId === campaign.id
                              ? "Funding..."
                              : "Fund Campaign"}
                          </button>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </ProtectedRoute>
  );
}