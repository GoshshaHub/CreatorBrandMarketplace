"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import StatusPill from "@/components/StatusPill";
import CampaignTimeline from "@/components/CampaignTimeline";
import {
  getCampaignById,
  submitCampaignLink,
  updateCampaignStatus,
} from "@/lib/campaigns";

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

export default function CreatorCampaignDetailPage() {
  const params = useParams();
  const campaignId = params?.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [linkInput, setLinkInput] = useState("");

  async function loadCampaign() {
    try {
      setError("");
      const data = await getCampaignById(campaignId);
      if (!data) {
        setError("Campaign not found.");
        return;
      }
      setCampaign(data as Campaign);
      setLinkInput((data as Campaign).creatorSubmittedArContentUrl || "");
    } catch (err: any) {
      setError(err.message || "Failed to load campaign.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (campaignId) loadCampaign();
  }, [campaignId]);

  async function handleAccept() {
    try {
      setBusy(true);
      await updateCampaignStatus({ campaignId, status: "accepted" });
      await loadCampaign();
    } catch (err: any) {
      setError(err.message || "Failed to accept campaign.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    try {
      setBusy(true);
      await updateCampaignStatus({ campaignId, status: "rejected" });
      await loadCampaign();
    } catch (err: any) {
      setError(err.message || "Failed to reject campaign.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitLink() {
    if (!linkInput.trim()) {
      setError("Please paste your AR content link before submitting.");
      return;
    }

    try {
      setBusy(true);
      await submitCampaignLink({
        campaignId,
        arContentUrl: linkInput.trim(),
      });
      await loadCampaign();
    } catch (err: any) {
      setError(err.message || "Failed to submit campaign link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProtectedRoute allowedRole="creator">
      <main className="app-page">
        <div className="app-shell">
          <div className="app-header">
            <div>
              <h1 className="app-title">Campaign Detail</h1>
              <p className="app-subtitle">
                Review campaign instructions and complete your next step.
              </p>
            </div>

            <Link href="/creator/dashboard" className="app-button-secondary">
              Back to Dashboard
            </Link>
          </div>

          {loading && (
            <p className="app-subtitle" style={{ marginTop: "24px" }}>
              Loading campaign...
            </p>
          )}
          {error && !loading && (
            <p style={{ marginTop: "24px", color: "#dc2626" }}>{error}</p>
          )}

          {campaign && (
            <div className="app-section">
              <div className="app-card app-card-padding">
                <div className="app-campaign-top">
                  <div>
                    <h2 className="app-section-title" style={{ marginBottom: "16px" }}>
                      {campaign.campaignTitle || "Untitled Campaign"}
                    </h2>
                    <p className="app-text-soft">
                      Brand: {campaign.brandName || "Unknown brand"}
                    </p>
                    <p className="app-text-soft">Product: {campaign.productName || "-"}</p>
                    <p className="app-text-faint" style={{ marginTop: "8px" }}>
                      Timeline: {campaign.deliveryStartDate || "-"} →{" "}
                      {campaign.deliveryEndDate || "-"}
                    </p>
                    <p className="app-text-soft" style={{ marginTop: "8px" }}>
                      Price: ${campaign.agreedPrice ?? 0}
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
                  <h3 className="app-text" style={{ fontWeight: 600 }}>
                    Campaign Brief
                  </h3>
                  <p className="app-text-soft" style={{ marginTop: "10px" }}>
                    {campaign.campaignBrief || "No brief provided."}
                  </p>
                </div>

                <div className="app-inline-actions">
                  {campaign.status === "invited" && (
                    <>
                      <button
                        onClick={handleAccept}
                        disabled={busy}
                        className="app-button"
                      >
                        {busy ? "Saving..." : "Accept"}
                      </button>

                      <button
                        onClick={handleReject}
                        disabled={busy}
                        className="app-button-secondary"
                      >
                        Reject
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
                      Email Brand
                    </a>
                  )}
                </div>

                {campaign.status === "funded" && (
                  <div className="app-form-block">
                    <h3
                      className="app-text"
                      style={{ marginTop: 0, marginBottom: "14px", fontWeight: 600 }}
                    >
                      Submit Campaign Link
                    </h3>

                    <input
                      className="app-input"
                      placeholder="Paste TikTok / Instagram / social link"
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                    />

                    <button
                      onClick={handleSubmitLink}
                      disabled={busy}
                      className="app-button"
                      style={{ marginTop: "14px" }}
                    >
                      {busy ? "Submitting..." : "Submit Campaign Link"}
                    </button>
                  </div>
                )}

                {campaign.creatorSubmittedArContentUrl && (
                  <div style={{ marginTop: "24px" }}>
                    <h3 className="app-text" style={{ fontWeight: 600 }}>
                      Submitted Link
                    </h3>
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
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}