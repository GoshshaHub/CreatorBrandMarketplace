"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ProtectedRoute from "../../../../components/ProtectedRoute";
import { Campaign, getCampaignById } from "../../../../lib/campaigns";

export default function BrandCampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params?.id || "";

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadCampaign() {
    if (!campaignId) return;

    setLoading(true);
    setError("");

    try {
      const data = await getCampaignById(campaignId);
      setCampaign(data);
    } catch (err: any) {
      setError(err.message || "Failed to load campaign.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCampaign();
  }, [campaignId]);

  async function handleFundCampaign() {
    setWorking(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/fund-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fund campaign.");
      }

      setMessage("Campaign funded successfully.");
      await loadCampaign();
    } catch (err: any) {
      setError(err.message || "Failed to fund campaign.");
    } finally {
      setWorking(false);
    }
  }

  async function handleSyncViews() {
    const input = window.prompt("Enter current total views for this campaign:", "1000");
    if (!input) return;

    const views = Number(input);
    if (Number.isNaN(views)) {
      setError("Please enter a valid number.");
      return;
    }

    setWorking(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/sync-campaign-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, views }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to sync views.");
      }

      setMessage(
        data.released
          ? "Views synced. Payout threshold reached and payment released."
          : "Views synced successfully."
      );
      await loadCampaign();
    } catch (err: any) {
      setError(err.message || "Failed to sync views.");
    } finally {
      setWorking(false);
    }
  }

  async function handleReleasePaymentNow() {
    setWorking(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/release-campaign-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to release payment.");
      }

      setMessage("Payment released successfully.");
      await loadCampaign();
    } catch (err: any) {
      setError(err.message || "Failed to release payment.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <ProtectedRoute allowedRole="brand">
      <main className="min-h-screen p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">Campaign Details</h1>
          <Link href="/brand/dashboard" className="rounded-lg border px-4 py-2">
            Back to Dashboard
          </Link>
        </div>

        {loading && <p className="mt-6">Loading campaign...</p>}
        {error && <p className="mt-6 text-red-600">{error}</p>}
        {message && <p className="mt-6 text-green-600">{message}</p>}

        {campaign && (
          <div className="mt-8 rounded-2xl border p-6 space-y-4">
            <div>
              <h2 className="text-2xl font-semibold">
                {campaign.campaignTitle || "Untitled Campaign"}
              </h2>
              <p className="text-gray-600 mt-1">
                Product: {campaign.productName || "—"}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <p>Status: {campaign.status || "—"}</p>
              <p>Funding: {campaign.fundingStatus || "—"}</p>
              <p>Completion: {campaign.completionStatus || "—"}</p>
              <p>Review: {campaign.goshshaReviewStatus || "—"}</p>
              <p>Payout: {campaign.payoutReleaseStatus || "—"}</p>
              <p>Creator: {campaign.creatorHandle || "—"}</p>
              <p>Views: {campaign.totalViews ?? 0}</p>
              <p>Agreed Price: ${campaign.agreedPrice ?? 0}</p>
              <p>Release Threshold: {campaign.payoutThresholdViews ?? 1000}</p>
            </div>

            {campaign.campaignBrief && (
              <div>
                <h3 className="font-semibold">Brief</h3>
                <p className="text-gray-700 mt-1">{campaign.campaignBrief}</p>
              </div>
            )}

            {campaign.normalizedArContentUrl && (
              <div>
                <h3 className="font-semibold">Submitted URL</h3>
                <a
                  href={campaign.normalizedArContentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline"
                >
                  {campaign.normalizedArContentUrl}
                </a>
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              {campaign.fundingStatus !== "funded" && (
                <button
                  onClick={handleFundCampaign}
                  disabled={working}
                  className="rounded-lg bg-black text-white px-4 py-2"
                >
                  {working ? "Funding..." : "Fund Campaign"}
                </button>
              )}

              <button
                onClick={handleSyncViews}
                disabled={working}
                className="rounded-lg border px-4 py-2"
              >
                Sync Views
              </button>

              {campaign.payoutReleaseStatus !== "released" && (
                <button
                  onClick={handleReleasePaymentNow}
                  disabled={working}
                  className="rounded-lg border px-4 py-2"
                >
                  Release Payment Now
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}