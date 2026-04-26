"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import ProtectedRoute from "../../../components/ProtectedRoute";
import StatCard from "../../../components/StatCard";
import StatusPill from "../../../components/StatusPill";
import { auth } from "../../../lib/firebase";
import {
  getCreatorCampaigns,
  getUserNotifications,
  markNotificationRead,
} from "../../../lib/campaigns";

type Campaign = {
  id: string;
  brandName?: string;
  contactEmail?: string;
  productName?: string;
  campaignTitle?: string;
  campaignBrief?: string;
  deliveryStartDate?: string;
  deliveryEndDate?: string;
  agreedPrice?: number;
  status?: string;
  fundingStatus?: string;
  creatorSubmittedArContentUrl?: string;
};

type NotificationItem = {
  id: string;
  title?: string;
  message?: string;
  isRead?: boolean;
  campaignId?: string;
};

function getCampaignDisplayStatus(campaign: any) {
  if (campaign.status === "completed") return "completed";
  if (campaign.payoutStatus === "released") return "completed";
  if (campaign.brandApprovalStatus === "approved") return "approved";
  if (campaign.status === "submitted") return "submitted";
  if (campaign.fundingStatus === "funded") return "funded";
  if (campaign.status === "accepted") return "accepted";
  if (campaign.status === "rejected") return "rejected";
  return "invited";
}

function getFundingDisplay(campaign: any) {
  if (campaign.brandApprovalStatus === "approved") return "Awaiting Release";
  if (campaign.fundingStatus === "funded") return "Funded";
  return "Not funded";
}

export default function CreatorDashboardPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyCampaignId, setBusyCampaignId] = useState("");
  const [linkInputs, setLinkInputs] = useState<Record<string, string>>({});

  async function loadDashboardForUser(uid: string) {
    try {
      setError("");

      const campaignData = await getCreatorCampaigns(uid);
      setCampaigns(campaignData as Campaign[]);

      const notificationData = await getUserNotifications(uid);
      setNotifications(notificationData as NotificationItem[]);
    } catch (err: any) {
      setError(err.message || "We couldn’t load your dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        setError("You must be logged in.");
        return;
      }

      await loadDashboardForUser(user.uid);
    });

    return () => unsubscribe();
  }, []);

  async function handleStatusChange(campaignId: string, status: string) {
    try {
      setBusyCampaignId(campaignId);
      const res = await fetch("/api/update-campaign-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, status }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update campaign.");

      const user = auth.currentUser;
      if (user) {
        await loadDashboardForUser(user.uid);
      }
    } catch (err: any) {
      setError(err.message || "We couldn’t update this campaign.");
    } finally {
      setBusyCampaignId("");
    }
  }

  async function handleSubmitLink(campaignId: string) {
    const url = (linkInputs[campaignId] || "").trim();

    if (!url) {
      setError("Paste your content link before submitting.");
      return;
    }

    try {
      setError("");
      setBusyCampaignId(campaignId);

      const user = auth.currentUser;
      if (!user) {
        throw new Error("You must be logged in.");
      }

    const res = await fetch("/api/submit-campaign-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        submissionUrl: url,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "We couldn’t submit your campaign link.");
    }
      await loadDashboardForUser(user.uid);
    } catch (err: any) {
      setError(err.message || "We couldn’t submit your campaign link.");
    } finally {
      setBusyCampaignId("");
    }
  }

  async function handleMarkRead(notificationId: string) {
    try {
      await markNotificationRead(notificationId);

      const user = auth.currentUser;
      if (user) {
        await loadDashboardForUser(user.uid);
      }
    } catch (err: any) {
      setError(err.message || "We couldn’t update this notification.");
    }
  }

  const stats = useMemo(() => {
    const newInvites = campaigns.filter((c) => c.status === "invited").length;
    const awaitingFunding = campaigns.filter((c) => c.status === "accepted").length;
    const readyToStart = campaigns.filter((c) => c.status === "funded").length;
    const live = campaigns.filter((c) => c.status === "live").length;

    return { newInvites, awaitingFunding, readyToStart, live };
  }, [campaigns]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <ProtectedRoute allowedRole="creator">
      <main className="app-page">
        <div className="app-shell">
          <div className="app-header">
            <div>
              <h1 className="app-title">Creator Dashboard</h1>
              <p className="app-subtitle">
                Stay on top of invites, funding, and campaign deadlines.
              </p>
            </div>

            <Link href="/creator/profile" className="app-button-secondary">
              Edit Profile
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
            <StatCard label="New Invites" value={stats.newInvites} />
            <StatCard label="Awaiting Funding" value={stats.awaitingFunding} />
            <StatCard label="Ready to Create" value={stats.readyToStart} />
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
                  New invites, funding notices, and live campaign updates will appear here.
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
                          <Link href={`/creator/campaign/${notification.campaignId}`}>
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

            {campaigns.length === 0 ? (
              <div className="app-card app-card-padding" style={{ marginTop: "16px" }}>
                <p className="app-text" style={{ margin: 0, fontWeight: 600 }}>
                  No campaigns yet
                </p>
                <p className="app-text-soft" style={{ marginTop: "8px", marginBottom: 0 }}>
                  When a brand invites you to a campaign, it will show up here with your next step.
                </p>
              </div>
            ) : (
              <div className="app-campaign-grid">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="app-card app-card-padding">
                    <div className="app-campaign-top">
                      <div>
                        <Link href={`/creator/campaign/${campaign.id}`}>
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
                          Brand: {campaign.brandName || "Unknown brand"}
                        </p>
                        <p className="app-text-soft">Product: {campaign.productName || "-"}</p>
                        <p className="app-text-faint" style={{ marginTop: "8px" }}>
                          Delivery Window: {campaign.deliveryStartDate || "-"} →{" "}
                          {campaign.deliveryEndDate || "-"}
                        </p>
                        <p className="app-text-soft" style={{ marginTop: "8px" }}>
                          Payout: ${campaign.agreedPrice ?? 0}
                        </p>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <StatusPill status={getCampaignDisplayStatus(campaign)} />
                        <span className="app-text-faint">
                          Funding: {getFundingDisplay(campaign)}
                        </span>
                      </div>
                    </div>

                    <p className="app-text-soft" style={{ marginTop: "20px" }}>
                      {campaign.campaignBrief || "No brief provided."}
                    </p>

                    <div className="app-inline-actions">
                      <Link
                        href={`/creator/campaign/${campaign.id}`}
                        className="app-button-secondary"
                      >
                        View Campaign
                      </Link>

                      {campaign.status === "invited" && (
                        <>
                          <button
                            onClick={() => handleStatusChange(campaign.id, "accepted")}
                            disabled={busyCampaignId === campaign.id}
                            className="app-button"
                          >
                            {busyCampaignId === campaign.id ? "Saving..." : "Accept Invite"}
                          </button>

                          <button
                            onClick={() => handleStatusChange(campaign.id, "rejected")}
                            disabled={busyCampaignId === campaign.id}
                            className="app-button-secondary"
                          >
                            Decline
                          </button>
                        </>
                      )}

                      {campaign.contactEmail && (
                        <a
                          href={`mailto:${campaign.contactEmail}?subject=${encodeURIComponent(
                            `Question about: ${campaign.campaignTitle || "Campaign"}`
                          )}`}
                          className="app-button-secondary"
                        >
                          Contact Brand
                        </a>
                      )}
                    </div>

                    {campaign.status === "funded" && (
                      <div className="app-form-block">
                        <h4
                          className="app-text"
                          style={{ marginTop: 0, marginBottom: "14px", fontWeight: 600 }}
                        >
                          Submit Your Campaign Link
                        </h4>

                        <input
                          className="app-input"
                          placeholder="Paste your TikTok, Instagram, or content link"
                          value={linkInputs[campaign.id] ?? ""}
                          onChange={(e) =>
                            setLinkInputs((prev) => ({
                              ...prev,
                              [campaign.id]: e.target.value,
                            }))
                          }
                        />

                        <button
                          onClick={() => handleSubmitLink(campaign.id)}
                          disabled={busyCampaignId === campaign.id}
                          className="app-button"
                          style={{ marginTop: "14px" }}
                        >
                          {busyCampaignId === campaign.id
                            ? "Submitting..."
                            : "Submit Link"}
                        </button>
                      </div>
                    )}

                    {campaign.creatorSubmittedArContentUrl && (
                      <div className="app-text-soft" style={{ marginTop: "16px" }}>
                        <span style={{ fontWeight: 600 }}>Submitted Link:</span>{" "}
                        <a
                          href={campaign.creatorSubmittedArContentUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ textDecoration: "underline" }}
                        >
                          {campaign.creatorSubmittedArContentUrl}
                        </a>
                      </div>
                    )}
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