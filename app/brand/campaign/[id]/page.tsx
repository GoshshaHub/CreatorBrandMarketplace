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
              ? "bg-slate-900 border-slate-900 dark:bg-white dark:border-white"
              : state === "current"
              ? "bg-white border-slate-900 dark:bg-slate-900 dark:border-white"
              : "bg-white border-slate-300 dark:bg-slate-800 dark:border-slate-600"
          }`}
        />
        <div className="h-full w-px bg-slate-200 dark:bg-slate-700" />
      </div>

      <div className="pb-6">
        <p className="font-semibold text-slate-900 dark:text-white">
          {title}
        </p>
        <p className="text-sm mt-1 text-slate-600 dark:text-slate-300">
          {description}
        </p>
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

      if (!res.ok) {
        throw new Error(data.error || "Failed to start Stripe Checkout.");
      }

      if (!data.checkoutUrl) {
        throw new Error("Stripe Checkout URL was not returned.");
      }

      window.location.href = data.checkoutUrl;
    } catch (err: any) {
      setError(err?.message || "Failed to start Stripe Checkout.");
      setWorking(false);
    }
  }

  async function handleApproveSubmission() {
    setWorking(true);
    setError("");
    setMessage("");

    try {
      const submissionUrl =
        campaign?.normalizedArContentUrl ||
        campaign?.creatorSubmittedArContentUrl;

      if (!campaignId || !submissionUrl) {
        throw new Error("Missing campaignId or submissionUrl");
      }

      const res = await fetch("/api/approve-campaign-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          submissionUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to approve submission.");
      }

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
      <main className="min-h-screen p-6 max-w-4xl mx-auto bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Campaign Details</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Follow the campaign from invite to completion.
            </p>
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
            <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-2xl font-semibold">
                {campaign.campaignTitle || "Untitled Campaign"}
              </h2>

              <p className="mt-1 text-slate-600 dark:text-slate-400">
                Product: {campaign.productName || "—"}
              </p>

              <p className="mt-4 text-slate-700 dark:text-slate-300">
                {campaign.campaignBrief || "No brief added."}
              </p>

              <div className="mt-6 rounded-xl bg-slate-100 p-4 dark:bg-slate-800">
                <p className="font-semibold">Next step</p>
                <p className="mt-1 text-slate-700 dark:text-slate-300">{nextAction}</p>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {campaign.status === "accepted" &&
                  campaign.fundingStatus !== "funded" && (
                    <button
                      onClick={handleFundCampaign}
                      disabled={working}
                      className="rounded-lg bg-slate-900 text-white px-4 py-2 hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                    >
                      {working ? "Funding..." : "Fund Campaign"}
                    </button>
                  )}

                {campaign.status === "submitted" &&
                  campaign.brandApprovalStatus !== "approved" && (
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

              <div className="mt-8 grid gap-3 text-sm text-slate-700 dark:text-slate-300">
                <p>Creator: {campaign.creatorHandle || "—"}</p>
                <p>Agreed Price: ${campaign.agreedPrice ?? 0}</p>
                <p>Goshsha Fee: ${campaign.platformFeeAmount ?? 5}</p>
                <p>Creator Payout: ${campaign.creatorPayoutAmount ?? 0}</p>
              </div>
            </section>

            <section className="rounded-2xl border p-6">
              <h3 className="text-xl font-semibold mb-6">
                Campaign Timeline
              </h3>

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