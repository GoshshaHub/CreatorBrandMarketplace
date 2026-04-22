"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "../../../components/ProtectedRoute";
import { Campaign, getSubmittedCampaigns } from "../../../lib/campaigns";

export default function AdminReviewPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string>("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadCampaigns() {
    setLoading(true);
    setError("");

    try {
      const data = await getSubmittedCampaigns();
      setCampaigns(data);
    } catch (err: any) {
      setError(err.message || "Failed to load submitted campaigns.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  async function handleMarkLive(campaignId: string) {
    setWorkingId(campaignId);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/mark-campaign-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to mark campaign live.");
      }

      setMessage("Campaign marked live.");
      await loadCampaigns();
    } catch (err: any) {
      setError(err.message || "Failed to mark campaign live.");
    } finally {
      setWorkingId("");
    }
  }

  return (
    <ProtectedRoute allowedRole="admin">
      <main className="min-h-screen p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Admin Review</h1>
            <p className="mt-2 text-gray-600">
              Review creator submissions and mark approved campaigns live.
            </p>
          </div>

          <Link href="/" className="rounded-lg border px-4 py-2">
            Back Home
          </Link>
        </div>

        {loading && <p className="mt-8">Loading submitted campaigns...</p>}
        {error && <p className="mt-8 text-red-600">{error}</p>}
        {message && <p className="mt-8 text-green-600">{message}</p>}

        {!loading && campaigns.length === 0 && (
          <p className="mt-8 text-gray-600">No submitted campaigns right now.</p>
        )}

        <div className="mt-8 space-y-6">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="rounded-2xl border p-6 space-y-3">
              <div>
                <h2 className="text-2xl font-semibold">
                  {campaign.campaignTitle || "Untitled Campaign"}
                </h2>
                <p className="text-gray-600 mt-1">
                  Creator: {campaign.creatorHandle || "—"}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <p>Brand: {campaign.brandName || "—"}</p>
                <p>Product: {campaign.productName || "—"}</p>
                <p>Status: {campaign.status || "—"}</p>
                <p>Review: {campaign.goshshaReviewStatus || "—"}</p>
              </div>

              {campaign.normalizedArContentUrl && (
                <p>
                  Submission:{" "}
                  <a
                    href={campaign.normalizedArContentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 underline"
                  >
                    {campaign.normalizedArContentUrl}
                  </a>
                </p>
              )}

              <button
                onClick={() => handleMarkLive(campaign.id)}
                disabled={workingId === campaign.id}
                className="rounded-lg bg-black text-white px-4 py-2"
              >
                {workingId === campaign.id ? "Marking live..." : "Approve & Mark Live"}
              </button>
            </div>
          ))}
        </div>
      </main>
    </ProtectedRoute>
  );
}