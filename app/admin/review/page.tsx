"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import StatusPill from "@/components/StatusPill";
import CampaignTimeline from "@/components/CampaignTimeline";
import { getSubmittedCampaigns, markCampaignLive } from "@/lib/campaigns";

type Campaign = {
  id: string;
  brandName?: string;
  creatorHandle?: string;
  contactEmail?: string;
  productName?: string;
  campaignTitle?: string;
  campaignBrief?: string;
  deliveryStartDate?: string;
  deliveryEndDate?: string;
  agreedPrice?: number;
  status?: string;
  fundingStatus?: string;
  completionStatus?: string;
  creatorSubmittedArContentUrl?: string;
};

export default function AdminReviewPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyCampaignId, setBusyCampaignId] = useState("");
  const [error, setError] = useState("");

  async function loadCampaigns() {
    try {
      setError("");
      const data = await getSubmittedCampaigns();
      setCampaigns(data as Campaign[]);
    } catch (err: any) {
      setError(err.message || "We couldn’t load submitted campaigns.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  async function handleMarkLive(campaignId: string) {
    try {
      setBusyCampaignId(campaignId);
      await markCampaignLive(campaignId);
      await loadCampaigns();
    } catch (err: any) {
      setError(err.message || "We couldn’t mark this campaign live.");
    } finally {
      setBusyCampaignId("");
    }
  }

  return (
    <ProtectedRoute allowedRole="admin">
      <main className="app-page">
        <div className="app-shell">
          <div className="app-header">
            <div>
              <h1 className="app-title">Admin Review</h1>
              <p className="app-subtitle">
                Review submitted creator links and approve campaigns for launch.
              </p>
            </div>

            <Link href="/" className="app-button-secondary">
              Back to Home
            </Link>
          </div>

          {loading && (
            <p className="app-subtitle" style={{ marginTop: "24px" }}>
              Loading submissions...
            </p>
          )}

          {error && !loading && (
            <p style={{ marginTop: "24px", color: "#dc2626" }}>{error}</p>
          )}

          {!loading && campaigns.length === 0 && (
            <div className="app-section">
              <div className="app-card app-card-padding">
                <h2 className="app-text" style={{ margin: 0, fontWeight: 700 }}>
                  No submissions waiting for review
                </h2>
                <p className="app-text-soft" style={{ marginTop: "10px", marginBottom: 0 }}>
                  When creators submit campaign links, they will appear here for approval.
                </p>
              </div>
            </div>
          )}

          {campaigns.length > 0 && (
            <section className="app-section">
              <h2 className="app-section-title">Submitted Campaigns</h2>

              <div className="app-campaign-grid">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="app-card app-card-padding">
                    <div className="app-campaign-top">
                      <div>
                        <h3
                          className="app-text"
                          style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}
                        >
                          {campaign.campaignTitle || "Untitled Campaign"}
                        </h3>

                        <p className="app-text-soft" style={{ marginTop: "12px" }}>
                          Brand: {campaign.brandName || "Unknown brand"}
                        </p>
                        <p className="app-text-soft">
                          Creator: {campaign.creatorHandle || "Unknown creator"}
                        </p>
                        <p className="app-text-soft">
                          Product: {campaign.productName || "-"}
                        </p>
                        <p className="app-text-faint" style={{ marginTop: "8px" }}>
                          Delivery Window: {campaign.deliveryStartDate || "-"} →{" "}
                          {campaign.deliveryEndDate || "-"}
                        </p>
                        <p className="app-text-soft" style={{ marginTop: "8px" }}>
                          Campaign Value: ${campaign.agreedPrice ?? 0}
                        </p>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <StatusPill status={campaign.status} />
                        <span className="app-text-faint">
                          Funding: {campaign.fundingStatus || "-"}
                        </span>
                      </div>
                    </div>

                    <CampaignTimeline status={campaign.status} />

                    <div style={{ marginTop: "24px" }}>
                      <h4 className="app-text" style={{ margin: 0, fontWeight: 600 }}>
                        Campaign Brief
                      </h4>
                      <p className="app-text-soft" style={{ marginTop: "10px" }}>
                        {campaign.campaignBrief || "No campaign brief provided."}
                      </p>
                    </div>

                    <div style={{ marginTop: "24px" }}>
                      <h4 className="app-text" style={{ margin: 0, fontWeight: 600 }}>
                        Submitted Link
                      </h4>

                      {campaign.creatorSubmittedArContentUrl ? (
                        <p className="app-text-soft" style={{ marginTop: "10px" }}>
                          <a
                            href={campaign.creatorSubmittedArContentUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ textDecoration: "underline" }}
                          >
                            {campaign.creatorSubmittedArContentUrl}
                          </a>
                        </p>
                      ) : (
                        <p className="app-text-soft" style={{ marginTop: "10px" }}>
                          No submitted link found.
                        </p>
                      )}
                    </div>

                    <div className="app-inline-actions" style={{ marginTop: "24px" }}>
                      <button
                        onClick={() => handleMarkLive(campaign.id)}
                        disabled={busyCampaignId === campaign.id}
                        className="app-button"
                      >
                        {busyCampaignId === campaign.id ? "Approving..." : "Approve & Mark Live"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}