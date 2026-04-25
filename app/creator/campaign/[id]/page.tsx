"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ProtectedRoute from "../../../../components/ProtectedRoute";
import {
  Campaign,
  CampaignStatus,
  getCampaignById,
} from "../../../../lib/campaigns";

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
  const order = ["invited", "accepted", "funded", "submitted", "approved", "completed"];
  const currentIndex = order.indexOf(campaign.status || "invited");
  const stepIndex = order.indexOf(step);

  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "current";
  return "upcoming";
}

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
    setLoading(true);
    setError("");

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
    if (campaignId) loadCampaign();
  }, [campaignId]);

  const nextAction = useMemo(() => {
    if (!campaign) return "";
    const status = campaign.status as string | undefined;
    if (status === "invited") return "Review the campaign and accept or reject the invite.";
    if (status === "accepted") return "You accepted. Waiting for the brand to fund the campaign.";
    if (status === "funded") return "Campaign is funded. Create your post, then submit the URL here.";
    if (status === "submitted") return "Submission received. Waiting for brand approval.";
    if (status === "approved") return "Brand approved your work. Waiting for admin to release payout.";
    if (status === "completed") return "Payout released. Campaign completed.";
    if (status === "rejected") return "Campaign rejected.";
    return "";
  }, [campaign]);

  async function handleStatus(status: "accepted" | "rejected") {
    setWorking(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/update-campaign-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, status }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update campaign.");

      setMessage(status === "accepted" ? "Campaign accepted." : "Campaign rejected.");
      await loadCampaign();
    } catch (err: any) {
      setError(err?.message || "Could not update campaign.");
    } finally {
      setWorking(false);
    }
  }

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, submissionUrl: submissionUrl.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit content.");

      setMessage("Content submitted. Brand and admin have been notified.");
      await loadCampaign();
    } catch (err: any) {
      setError(err?.message || "Failed to submit content.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <ProtectedRoute allowedRole="creator">
      <main className="min-h-screen p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Campaign</h1>
            <p className="mt-2 text-gray-600">Track what’s done and what’s next.</p>
          </div>

          <Link href="/creator/dashboard" className="rounded-lg border px-4 py-2">
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
                {campaign.status === "invited" && (
                  <>
                    <button
                      onClick={() => handleStatus("accepted")}
                      disabled={working}
                      className="rounded-lg bg-black text-white px-4 py-2"
                    >
                      Accept Campaign
                    </button>
                    <button
                      onClick={() => handleStatus("rejected")}
                      disabled={working}
                      className="rounded-lg border px-4 py-2"
                    >
                      Reject
                    </button>
                  </>
                )}

                {campaign.status === "funded" && (
                  <div className="w-full space-y-3">
                    <label className="block font-semibold">Submit your post URL</label>
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
                      {working ? "Submitting..." : "Submit Content URL"}
                    </button>
                  </div>
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
                <p>Brand: {campaign.brandName || "—"}</p>
                <p>Agreed Price: ${campaign.agreedPrice ?? 0}</p>
                <p>Goshsha Fee: ${campaign.platformFeeAmount ?? 5}</p>
                <p>Your Payout: ${campaign.creatorPayoutAmount ?? 0}</p>
              </div>
            </section>

            <section className="rounded-2xl border p-6">
              <h3 className="text-xl font-semibold mb-6">Campaign Timeline</h3>

              <Step title="Invited" description="You were invited to this campaign." state={getStepState(campaign, "invited")} />
              <Step title="Accepted" description="You accept the campaign." state={getStepState(campaign, "accepted")} />
              <Step title="Funded" description="Brand funds the campaign so you can begin." state={getStepState(campaign, "funded")} />
              <Step title="Submitted" description="You submit your post URL." state={getStepState(campaign, "submitted")} />
              <Step title="Brand Approved" description="Brand approves your work." state={getStepState(campaign, "approved")} />
              <Step title="Payout Released" description="Admin releases payout and completes campaign." state={getStepState(campaign, "completed")} />
            </section>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}