"use client";

import { useEffect, useState } from "react";
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

  return (
    <ProtectedRoute allowedRole="brand">
      <main className="min-h-screen bg-gradient-to-br from-white via-pink-50 to-blue-50 px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-5xl">
          {loading && <p>Loading your live campaign...</p>}
          {error && <p className="text-red-600">{error}</p>}

          {campaign && (
            <div className="grid gap-8 md:grid-cols-[1fr_0.85fr]">
              <section className="rounded-3xl border border-pink-100 bg-white/90 p-8 shadow-xl">
                <p className="text-sm font-bold uppercase tracking-wide text-pink-600">
                  Your IRL Campaign Is Live
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight">
                  Your product now has an IRL campaign layer.
                </h1>

                <p className="mt-4 text-lg text-slate-600">
                  Shoppers can now experience your campaign content from the product itself.
                </p>

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
                      View AR Campaign Content
                    </a>
                  )}

                  <Link
                    href={`/brand/campaign/${campaignId}`}
                    className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white hover:bg-slate-800"
                  >
                    Invite Creators
                  </Link>

                  <Link
                    href="/brand/dashboard"
                    className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold"
                  >
                    Go to Dashboard
                  </Link>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
                <h3 className="text-xl font-bold">Live Preview</h3>
                <p className="mt-2 text-sm text-slate-600">
                  This is the product image shoppers scan to unlock your campaign.
                </p>

                <div className="mt-6 overflow-hidden rounded-2xl border bg-slate-100">
                  {(campaign as any).arTargetImageUrl ? (
                    <img
                      src={(campaign as any).arTargetImageUrl}
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
                  <p className="font-bold text-slate-950">
                    What just happened?
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    You turned existing campaign content into an IRL activation layer
                    attached to your product.
                  </p>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}