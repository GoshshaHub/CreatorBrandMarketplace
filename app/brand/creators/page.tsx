"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ProtectedRoute from "../../../components/ProtectedRoute";
import { getMarketplaceCreators } from "../../../lib/campaigns";

type Creator = {
  id: string;
  displayName?: string;
  handle?: string;
  bio?: string;
  categories?: string[];
  campaignsCompleted?: number;
  totalCampaignViews?: number;
};

export default function BrandCreatorsPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCreators() {
      try {
        const data = await getMarketplaceCreators();
        setCreators(data as Creator[]);
      } finally {
        setLoading(false);
      }
    }

    loadCreators();
  }, []);

  return (
    <ProtectedRoute allowedRole="brand">
      <main className="min-h-screen p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">Creator Marketplace</h1>
            <p className="mt-2 text-gray-600">
              Discover creators and invite the right fit for your next campaign.
            </p>
          </div>

          <Link
            href="/brand/dashboard"
            className="rounded-lg border px-4 py-2"
          >
            Back to Dashboard
          </Link>
        </div>

        {loading ? (
          <p className="mt-8">Loading creators...</p>
        ) : creators.length === 0 ? (
          <p className="mt-8 text-gray-600">No creators available yet.</p>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {creators.map((creator) => (
              <div key={creator.id} className="rounded-2xl border p-6">
                <h2 className="text-2xl font-semibold">
                  {creator.displayName || creator.handle || "Unnamed Creator"}
                </h2>

                {creator.handle && (
                  <p className="mt-1 text-sm text-gray-500">{creator.handle}</p>
                )}

                <p className="mt-4 text-gray-700">
                  {creator.bio?.trim()
                    ? creator.bio
                    : "This creator has not added a bio yet."}
                </p>

                <p className="mt-4 text-gray-700">
                  {creator.categories && creator.categories.length > 0
                    ? creator.categories.join(", ")
                    : "No categories listed yet"}
                </p>

                <div className="mt-4 space-y-2 text-gray-700">
                  <p>
                    Campaigns completed: {creator.campaignsCompleted ?? 0}
                  </p>
                  <p>Campaign views: {creator.totalCampaignViews ?? 0}</p>
                </div>

                <Link
                  href={`/brand/new-campaign?creatorId=${creator.id}`}
                  className="mt-6 inline-block rounded-lg bg-black px-4 py-2 text-white"
                >
                  Invite Creator
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}