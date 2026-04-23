"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ProtectedRoute from "../../../../components/ProtectedRoute";
import { Campaign, getCampaignById } from "../../../../lib/campaigns";

function Step({
  title,
  description,
  state,
}: {
  title: string;
  description: string;
  state: "done" | "current" | "upcoming";
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className={`h-5 w-5 rounded-full border ${
            state === "done"
              ? "bg-black border-black"
              : state === "current"
              ? "bg-white border-black"
              : "bg-white border-gray-300"
          }`}
        />
        <div className="h-full w-px bg-gray-200" />
      </div>
      <div className="pb-6">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-gray-600 mt-1">{description}</p>
      </div>
    </div>
  );
}

function getStepState(campaign: Campaign, step: string) {
  const status = campaign.status as string | undefined;

  const order = ["invited", "accepted", "funded", "submitted", "approved", "completed"];
  const currentIndex = order.indexOf(status || "invited");
  const stepIndex = order.indexOf(step);

  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "current";
  return "upcoming";
}

export default function BrandCampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params?.id || "";

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadCampaign() {
    setLoading(true);
    setError("");

    try {
      const data = await getCampaignById(campaignId);
      setCampaign(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load campaign.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (campaignId) loadCampaign();
  }, [campaignId]);

  const nextAction = useMemo(() => {
    if (!campaign) return "";
    const status = campaign.status as string | undefined;
    if (status === "invited") return "Waiting for creator to accept the invite.";
    if (status === "accepted" && campaign.fundingStatus !== "funded")
      return "Creator accepted. Fund the campaign so they can begin.";
    if (status === "funded") return "Campaign is funded. Waiting for creator submission.";
    if (status === "submitted") return "Creator submitted content. Review and approve it.";
    if (status === "approved") return "Submission approved. Waiting for admin to release payout.";
    if (status === "completed") return "Campaign completed.";
    return "";
  }, [campaign]);

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
      if (!res.ok) throw new Error(data.error || "Failed to fund campaign.");

      setMessage("Campaign funded. Creator has been notified.");
      await loadCampaign();
    } catch (err: any) {
      setError(err?.message || "Failed to fund campaign.");
    } finally {
      setWorking(false);
    }
  }

  async function handleApproveSubmission() {
    setWorking(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/approve-campaign-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve submission.");

      setMessage("Submission approved. Admin has been notified to release payout.");
      await loadCampaign();
    } catch (err: any) {
      setError(err?.message || "Failed to approve submission.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <ProtectedRoute allowedRole="brand">
      <main className="min-h-screen p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Campaign Details</h1>
            <p className="mt-2 text-gray-600">Follow the campaign from invite to completion.</p>
          </div>

          <Link href="/brand/dashboard" className="rounded-lg border px-4 py-2">
            Back
          </Link>
        </div>

        {loading && <p className="mt-8">Loading campaign...</p>}
        {error && <p className="mt-6 text-red-600">{error}</p>}
        {message && <p className="mt-6 text-green-600">{message}</p>}

        {campaign && (
          <div className="mt-8 grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-2xl border p-6">
              <h2 className="text-2xl font-semibold">
                {campaign.campaignTitle || "Untitled Campaign"}
              </h2>
              <p className="mt-1 text-gray-600">Product: {campaign.productName || "—"}</p>
              <p className="mt-4 text-gray-700">{campaign.campaignBrief || "No brief added."}</p>

              <div className="mt-6 rounded-xl bg-gray-50 p-4">
                <p className="font-semibold">Next step</p>
                <p className="mt-1 text-gray-700">{nextAction}</p>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {campaign.status === "accepted" && campaign.fundingStatus !== "funded" && (
                  <button
                    onClick={handleFundCampaign}
                    disabled={working}
                    className="rounded-lg bg-black text-white px-4 py-2"
                  >
                    {working ? "Funding..." : "Fund Campaign"}
                  </button>
                )}

                {status === "submitted" && campaign.brandApprovalStatus !== "approved" && (
                  <button
                    onClick={handleApproveSubmission}
                    disabled={working}
                    className="rounded-lg bg-black text-white px-4 py-2"
                  >
                    {working ? "Approving..." : "Approve Submission"}
                  </button>
                )}

                {campaign.normalizedArContentUrl && (
                  <a
                    href={campaign.normalizedArContentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border px-4 py-2"
                  >
                    View Submitted URL
                  </a>
                )}
              </div>

              <div className="mt-8 grid gap-3 text-sm text-gray-700">
                <p>Creator: {campaign.creatorHandle || "—"}</p>
                <p>Agreed Price: ${campaign.agreedPrice ?? 0}</p>
                <p>Goshsha Fee: ${campaign.platformFeeAmount ?? 5}</p>
                <p>Creator Payout: ${campaign.creatorPayoutAmount ?? 0}</p>
              </div>
            </section>

            <section className="rounded-2xl border p-6">
              <h3 className="text-xl font-semibold mb-6">Campaign Timeline</h3>

              <Step title="Invite Sent" description="Creator was invited." state={getStepState(campaign, "invited")} />
              <Step title="Creator Accepted" description="Creator accepts the campaign." state={getStepState(campaign, "accepted")} />
              <Step title="Campaign Funded" description="Brand funds the campaign so work can begin." state={getStepState(campaign, "funded")} />
              <Step title="Content Submitted" description="Creator submits the post URL." state={getStepState(campaign, "submitted")} />
              <Step title="Brand Approved" description="Brand approves the submitted work." state={getStepState(campaign, "approved")} />
              <Step title="Payout Released" description="Admin releases payout and completes the campaign." state={getStepState(campaign, "completed")} />
            </section>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}