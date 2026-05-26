"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ProtectedRoute from "../../../../../components/ProtectedRoute";
import { Campaign, getCampaignById } from "../../../../../lib/campaigns";

export default function BrandCampaignLivePage() {
  const params = useParams<{ id: string }>();
  const campaignId = params?.id || "";

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await getCampaignById(campaignId);
        setCampaign(data);
      } catch (err: any) {
        setError(err?.message || "Failed to load campaign.");
      } finally {
        setLoading(false);
      }
    }

    if (campaignId) load();
  }, [campaignId]);

  const isArLive = useMemo(() => {
    return (
      (campaign as any)?.status === "ar_live" ||
      (campaign as any)?.arStatus === "live"
    );
  }, [campaign]);

  const eyebrow = isArLive
    ? "Your IRL Campaign Is Scan-Ready"
    : "Your IRL Campaign Preview Is Ready";

  const headline = isArLive
    ? "Your product is now scan-ready in Goshsha."
    : "Your product now has an IRL campaign preview.";

  const body = isArLive
    ? "Shoppers can now scan your product in Goshsha and unlock your campaign content."
    : "We received your product image and campaign content. Our team is preparing the scan-ready AR activation now.";

  const previewTitle = isArLive ? "Scan-Ready Target" : "Preview Target";

  const previewDescription = isArLive
    ? "This is the product image shoppers can scan in Goshsha to unlock your campaign."
    : "This is the product image our team is using to prepare your scan-ready AR activation.";

  const statusTitle = isArLive
    ? "Your scan-ready AR campaign is live."
    : "What happens next?";

  const statusBody = isArLive
    ? "Try scanning your product in the Goshsha app to see the campaign experience in action."
    : "Our team has been notified to create the AR layer. You’ll receive an update when your product is ready to scan in Goshsha.";

  return (
    <ProtectedRoute allowedRole="brand">
      <main className="min-h-screen bg-gradient-to-br from-white via-pink-50 to-blue-50 px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-5xl">
          {loading && <p>Loading your campaign preview...</p>}
          {error && <p className="text-red-600">{error}</p>}

          {campaign && (
            <div className="grid gap-8 md:grid-cols-[1fr_0.85fr]">
              <section className="rounded-3xl border border-pink-100 bg-white/90 p-8 shadow-xl">
                <p className="text-sm font-bold uppercase tracking-wide text-pink-600">
                  {eyebrow}
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight">
                  {headline}
                </h1>

                <p className="mt-4 text-lg text-slate-600">{body}</p>

                <div className="mt-8 rounded-2xl bg-slate-950 p-5 text-white">
                  <p className="text-sm uppercase tracking-wide text-pink-300">
                    Campaign
                  </p>

                  <h2 className="mt-2 text-2xl font-bold">
                    {campaign.campaignTitle || "Untitled Campaign"}
                  </h2>

                  <p className="mt-2 text-slate-300">
                    Product: {campaign.productName || "—"}
                  </p>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  {(campaign as any).campaignContentUrl && (
                    <a
                      href={(campaign as any).campaignContentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl bg-pink-600 px-5 py-3 font-bold text-white hover:bg-pink-700"
                    >
                      View Campaign Content
                    </a>
                  )}

                  {isArLive ? (
                    <Link
                      href="/brand/creators"
                      className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white hover:bg-slate-800"
                    >
                      Invite Creators To Scale Campaign
                    </Link>
                  ) : (
                    <span className="cursor-not-allowed rounded-xl bg-slate-950 px-5 py-3 font-bold text-white opacity-80">
                      Generating AR
                    </span>
                  )}

                  <Link
                    href="/brand/dashboard"
                    className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-950 hover:bg-slate-50"
                  >
                    Go to Dashboard
                  </Link>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
                <h3 className="text-xl font-bold">{previewTitle}</h3>

                <p className="mt-2 text-sm text-slate-600">
                  {previewDescription}
                </p>

                <div className="mt-6 overflow-hidden rounded-2xl border bg-slate-100">
                  {(campaign as any).arTargetImageUrl ||
                  (campaign as any).arTargetImagePath ? (
                    <img
                      src={`/api/brand/target-image/${campaignId}`}
                      alt="AR target product"
                      className="h-96 w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-96 items-center justify-center text-slate-500">
                      No AR target image found.
                    </div>
                  )}
                </div>

                <div className="mt-6 rounded-2xl bg-pink-50 p-5">
                  <p className="font-bold text-slate-950">{statusTitle}</p>

                  <p className="mt-2 text-sm text-slate-600">{statusBody}</p>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}