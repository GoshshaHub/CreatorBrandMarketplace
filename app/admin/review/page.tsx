"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import ProtectedRoute from "../../../components/ProtectedRoute";
import { db } from "../../../lib/firebase";
import {
  Campaign,
  getApprovedCampaignsReadyForPayout,
  getSubmittedCampaigns,
} from "../../../lib/campaigns";

function money(value?: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function AdminReviewPage() {
  const [submittedCampaigns, setSubmittedCampaigns] = useState<Campaign[]>([]);
  const [payoutReadyCampaigns, setPayoutReadyCampaigns] = useState<Campaign[]>([]);
  const [firstIrlCampaigns, setFirstIrlCampaigns] = useState<Campaign[]>([]);

  const [loading, setLoading] = useState(true);
  const [workingCampaignId, setWorkingCampaignId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadFirstIrlCampaigns() {
    const q = query(
      collection(db, "campaigns"),
      where("campaignType", "==", "brand_first_irl_preview"),
      where("arStatus", "==", "needs_admin_creation")
    );

    const snap = await getDocs(q);

    return snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Campaign[];
  }

  async function loadCampaigns() {
    setLoading(true);
    setError("");

    try {
      const [submitted, payoutReady, firstIrl] = await Promise.all([
        getSubmittedCampaigns(),
        getApprovedCampaignsReadyForPayout(),
        loadFirstIrlCampaigns(),
      ]);

      setSubmittedCampaigns(submitted);
      setPayoutReadyCampaigns(payoutReady);
      setFirstIrlCampaigns(firstIrl);
    } catch (err: any) {
      setError(err?.message || "Failed to load admin review campaigns.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  const hasNoWork = useMemo(() => {
    return (
      submittedCampaigns.length === 0 &&
      payoutReadyCampaigns.length === 0 &&
      firstIrlCampaigns.length === 0
    );
  }, [submittedCampaigns, payoutReadyCampaigns, firstIrlCampaigns]);

  async function handleMarkArLive(campaignId: string) {
    setWorkingCampaignId(campaignId);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/mark-campaign-live", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ campaignId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to mark AR live.");
      }

      setMessage("Campaign marked as scan-ready.");
      await loadCampaigns();
    } catch (err: any) {
      setError(err?.message || "Failed to mark AR live.");
    } finally {
      setWorkingCampaignId("");
    }
  }

  async function handleReleasePayout(campaignId: string) {
    setWorkingCampaignId(campaignId);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/release-campaign-payout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ campaignId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to release payout.");
      }

      setMessage("Payout released successfully.");
      await loadCampaigns();
    } catch (err: any) {
      setError(err?.message || "Failed to release payout.");
    } finally {
      setWorkingCampaignId("");
    }
  }

  return (
    <ProtectedRoute allowedRole="admin">
      <main className="min-h-screen p-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold">Admin Review</h1>
          <p className="mt-2 text-gray-600">
            Review first IRL campaign previews, creator submissions, and payout releases.
          </p>
        </div>

        {loading && <p className="mt-8">Loading admin queue...</p>}
        {error && <p className="mt-6 text-red-600">{error}</p>}
        {message && <p className="mt-6 text-green-600">{message}</p>}

        {!loading && hasNoWork && (
          <div className="mt-8 rounded-2xl border p-6">
            <p className="font-semibold">No campaigns need admin action right now.</p>
            <p className="mt-1 text-gray-600">
              First IRL campaign previews, submitted campaigns, and payout-ready campaigns will appear here.
            </p>
          </div>
        )}

        {!loading && firstIrlCampaigns.length > 0 && (
          <section className="mt-10">
            <h2 className="text-2xl font-semibold">
              First IRL Campaigns — Need AR Creation
            </h2>

            <div className="mt-4 space-y-4">
              {firstIrlCampaigns.map((campaign) => (
                <div key={campaign.id} className="rounded-2xl border p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold">
                        {campaign.campaignTitle || "Untitled Campaign"}
                      </h3>

                      <p className="mt-1 text-gray-600">
                        Brand: {campaign.brandName || "—"}
                      </p>

                      <p className="text-gray-600">
                        Product: {campaign.productName || "—"}
                      </p>

                      <p className="text-gray-600">
                        Status: Preview ready — needs scan-ready AR creation
                      </p>
                    </div>

                    <span className="rounded-full border px-3 py-1 text-sm">
                      Needs AR
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {(campaign as any).campaignContentUrl && (
                      <a
                        href={(campaign as any).campaignContentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block rounded-lg border px-4 py-2"
                      >
                        View Campaign Content
                      </a>
                    )}

                    {(campaign as any).arTargetImageUrl && (
                      <a
                        href={(campaign as any).arTargetImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block rounded-lg border px-4 py-2"
                      >
                        View Target Image
                      </a>
                    )}

                    <button
                      onClick={() => handleMarkArLive(campaign.id)}
                      disabled={workingCampaignId === campaign.id}
                      className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-60"
                    >
                      {workingCampaignId === campaign.id
                        ? "Marking..."
                        : "Mark AR Live"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && submittedCampaigns.length > 0 && (
          <section className="mt-10">
            <h2 className="text-2xl font-semibold">Submitted — Waiting for Brand Approval</h2>

            <div className="mt-4 space-y-4">
              {submittedCampaigns.map((campaign) => (
                <div key={campaign.id} className="rounded-2xl border p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold">
                        {campaign.campaignTitle || "Untitled Campaign"}
                      </h3>
                      <p className="mt-1 text-gray-600">
                        Brand: {campaign.brandName || "—"}
                      </p>
                      <p className="text-gray-600">
                        Creator: {campaign.creatorHandle || campaign.creatorId}
                      </p>
                      <p className="text-gray-600">
                        Product: {campaign.productName || "—"}
                      </p>
                    </div>

                    <span className="rounded-full border px-3 py-1 text-sm">
                      Waiting for brand approval
                    </span>
                  </div>

                  {campaign.normalizedArContentUrl && (
                    <a
                      href={campaign.normalizedArContentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-block rounded-lg border px-4 py-2"
                    >
                      View Submitted URL
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && payoutReadyCampaigns.length > 0 && (
          <section className="mt-10">
            <h2 className="text-2xl font-semibold">Ready for Payout Release</h2>

            <div className="mt-4 space-y-4">
              {payoutReadyCampaigns.map((campaign) => (
                <div key={campaign.id} className="rounded-2xl border p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold">
                        {campaign.campaignTitle || "Untitled Campaign"}
                      </h3>
                      <p className="mt-1 text-gray-600">
                        Brand: {campaign.brandName || "—"}
                      </p>
                      <p className="text-gray-600">
                        Creator: {campaign.creatorHandle || campaign.creatorId}
                      </p>
                      <p className="text-gray-600">
                        Product: {campaign.productName || "—"}
                      </p>
                    </div>

                    <span className="rounded-full border px-3 py-1 text-sm">
                      Brand approved
                    </span>
                  </div>

                  <div className="mt-5 grid gap-2 text-sm text-gray-700 md:grid-cols-3">
                    <p>Brand Paid: {money(campaign.agreedPrice)}</p>
                    <p>Goshsha Fee: {money(campaign.platformFeeAmount || 5)}</p>
                    <p>Creator Payout: {money(campaign.creatorPayoutAmount)}</p>
                  </div>

                  {campaign.normalizedArContentUrl && (
                    <a
                      href={campaign.normalizedArContentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-block rounded-lg border px-4 py-2"
                    >
                      View Submitted URL
                    </a>
                  )}

                  <div className="mt-5">
                    <button
                      onClick={() => handleReleasePayout(campaign.id)}
                      disabled={workingCampaignId === campaign.id}
                      className="rounded-lg bg-black text-white px-4 py-2"
                    >
                      {workingCampaignId === campaign.id
                        ? "Releasing..."
                        : "Release Payout"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </ProtectedRoute>
  );
}