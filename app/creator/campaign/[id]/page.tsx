"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ProtectedRoute from "../../../../components/ProtectedRoute";
import { Campaign, getCampaignById } from "../../../../lib/campaigns";

export default function CreatorCampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params?.id || "";

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [submissionUrl, setSubmissionUrl] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadCampaign() {
    if (!campaignId) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const data = await getCampaignById(campaignId);
      setCampaign(data);
      setSubmissionUrl(data?.normalizedArContentUrl || "");
    } catch (err: any) {
      setError(err?.message || "Failed to load campaign.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCampaign();
  }, [campaignId]);

  async function handleSubmitContent() {
    if (!submissionUrl.trim()) {
      setError("Please enter your content URL.");
      return;
    }

    setWorking(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/submit-campaign-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaignId,
          submissionUrl: submissionUrl.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit campaign content.");
      }

      setMessage("Content submitted successfully.");
      await loadCampaign();
    } catch (err: any) {
      setError(err?.message || "Failed to submit campaign content.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <ProtectedRoute allowedRole="creator">
      <main className="min-h-screen p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">Campaign</h1>

          <Link
            href="/creator/dashboard"
            className="rounded-lg border px-4 py-2"
          >
            Back to Dashboard
          </Link>
        </div>

        {loading && <p className="mt-6">Loading campaign...</p>}
        {error && <p className="mt-6 text-red-600">{error}</p>}
        {message && <p className="mt-6 text-green-600">{message}</p>}

        {campaign && (
          <div className="mt-8 rounded-2xl border p-6 space-y-5">
            <div>
              <h2 className="text-2xl font-semibold">
                {campaign.campaignTitle || "Untitled Campaign"}
              </h2>
              <p className="mt-1 text-gray-600">
                Product: {campaign.productName || "—"}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 text-sm text-gray-700">
              <p>Status: {campaign.status || "—"}</p>
              <p>Funding: {campaign.fundingStatus || "—"}</p>
              <p>Completion: {campaign.completionStatus || "—"}</p>
              <p>Views: {campaign.totalViews ?? 0}</p>
              <p>Agreed Price: ${campaign.agreedPrice ?? 0}</p>
              <p>
                Delivery Window:{" "}
                {campaign.deliveryStartDate && campaign.deliveryEndDate
                  ? `${campaign.deliveryStartDate} → ${campaign.deliveryEndDate}`
                  : "Not set"}
              </p>
            </div>

            {campaign.campaignBrief && (
              <div>
                <h3 className="font-semibold">Brief</h3>
                <p className="mt-1 text-gray-700">{campaign.campaignBrief}</p>
              </div>
            )}

            {campaign.fundingStatus !== "funded" && (
              <div className="rounded-xl border p-4 bg-gray-50">
                <p className="font-medium">Waiting for brand funding</p>
                <p className="mt-1 text-sm text-gray-600">
                  You’ll be able to submit your content once the brand funds this
                  campaign.
                </p>
              </div>
            )}

            {campaign.fundingStatus === "funded" &&
              campaign.status !== "live" &&
              campaign.completionStatus !== "submitted" && (
                <div className="space-y-3">
                  <label className="block font-semibold">
                    Submit your TikTok / Instagram / content URL
                  </label>

                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="https://..."
                    value={submissionUrl}
                    onChange={(e) => setSubmissionUrl(e.target.value)}
                  />

                  <button
                    onClick={handleSubmitContent}
                    disabled={working || !submissionUrl.trim()}
                    className="rounded-lg bg-black text-white px-4 py-2"
                  >
                    {working ? "Submitting..." : "Submit Content"}
                  </button>
                </div>
              )}

            {campaign.completionStatus === "submitted" &&
              campaign.normalizedArContentUrl && (
                <div className="rounded-xl border p-4">
                  <h3 className="font-semibold">Submitted URL</h3>
                  <a
                    href={campaign.normalizedArContentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-blue-600 underline break-all"
                  >
                    {campaign.normalizedArContentUrl}
                  </a>
                  <p className="mt-2 text-sm text-gray-600">
                    Your submission is waiting for review.
                  </p>
                </div>
              )}

            {campaign.status === "live" && (
              <div className="rounded-xl border p-4 bg-gray-50">
                <p className="font-medium">Campaign is live</p>
                <p className="mt-1 text-sm text-gray-600">
                  Your campaign has been approved and is now live.
                </p>

                {campaign.normalizedArContentUrl && (
                  <a
                    href={campaign.normalizedArContentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-blue-600 underline break-all"
                  >
                    {campaign.normalizedArContentUrl}
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}