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
  totalCampaignViews?: number;
  totalCampaigns?: number;
};

export default function BrandCreatorsPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCreators() {
      try {
        const data = await getMarketplaceCreators();
        setCreators(data as Creator[]);
      } catch (err: any) {
        setError(err.message || "We couldn’t load creators right now.");
      } finally {
        setLoading(false);
      }
    }

    loadCreators();
  }, []);

  return (
    <ProtectedRoute allowedRole="brand">
      <main className="app-page">
        <div className="app-shell">
          <div className="app-header">
            <div>
              <h1 className="app-title">Creator Marketplace</h1>
              <p className="app-subtitle">
                Discover creators and invite the right fit for your next campaign.
              </p>
            </div>

            <Link href="/brand/dashboard" className="app-button-secondary">
              Back to Dashboard
            </Link>
          </div>

          {loading && (
            <p className="app-subtitle" style={{ marginTop: "24px" }}>
              Loading creators...
            </p>
          )}
          {error && !loading && (
            <p style={{ marginTop: "24px", color: "#dc2626" }}>{error}</p>
          )}

          {!loading && creators.length === 0 ? (
            <div className="app-section">
              <div className="app-card app-card-padding">
                <p className="app-text" style={{ margin: 0, fontWeight: 600 }}>
                  No creators available yet
                </p>
                <p className="app-text-soft" style={{ marginTop: "8px", marginBottom: 0 }}>
                  Creator profiles that are visible in the marketplace will appear here.
                </p>
              </div>
            </div>
          ) : (
            <div
              style={{
                marginTop: "32px",
                display: "grid",
                gap: "16px",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              }}
            >
              {creators.map((creator) => (
                <div key={creator.id} className="app-card app-card-padding">
                  <h2
                    className="app-text"
                    style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}
                  >
                    {creator.handle || creator.displayName || "Unnamed Creator"}
                  </h2>

                  <p className="app-text-soft" style={{ marginTop: "12px" }}>
                    {creator.bio || "This creator has not added a bio yet."}
                  </p>

                  <div
                    style={{
                      marginTop: "16px",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    {creator.categories?.length ? (
                      creator.categories.map((category) => (
                        <span key={category} className="app-pill">
                          {category}
                        </span>
                      ))
                    ) : (
                      <span className="app-text-faint">No categories listed yet</span>
                    )}
                  </div>

                  <div className="app-text-soft" style={{ marginTop: "16px" }}>
                    <p style={{ margin: 0 }}>Campaigns completed: {creator.totalCampaigns ?? 0}</p>
                    <p style={{ marginTop: "6px", marginBottom: 0 }}>
                      Campaign views: {creator.totalCampaignViews ?? 0}
                    </p>
                  </div>

                  <div style={{ marginTop: "20px" }}>
                    <Link
                      href={`/brand/new-campaign?creatorId=${creator.id}`}
                      className="app-button"
                    >
                      Invite Creator
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}