"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import ProtectedRoute from "../../../../components/ProtectedRoute";
import StatusPill from "../../../../components/StatusPill";
import CampaignTimeline from "../../../../components/CampaignTimeline";
import { db } from "../../../../lib/firebase";

type Campaign = {
  id: string;
  brandId?: string;
  creatorId?: string;
  brandName?: string;
  creatorHandle?: string;
  contactEmail?: string;
  productName?: string;
  campaignTitle?: string;
  campaignBrief?: string;
  deliveryStartDate?: string;
  deliveryEndDate?: string;
  agreedPrice?: number;
  platformFeeAmount?: number;
  status?: string;
  fundingStatus?: string;
  creatorSubmittedArContentUrl?: string;
};

export default function BrandCampaignDetailPage() {
  const params = useParams();
  const campaignId = String(params?.id || "");

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCampaign() {
      if (!campaignId) {
        setError("Missing campaign ID.");
        setLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "campaigns", campaignId));

        if (!snap.exists()) {
          setError("Campaign not found.");
          setLoading(false);
          return;
        }

        setCampaign({
          id: snap.id,
          ...(snap.data() as Omit<Campaign, "id">),
        });
      } catch (err: any) {
        setError(err.message || "We couldn’t load this campaign.");
      } finally {
        setLoading(false);
      }
    }

    loadCampaign();
  }, [campaignId]);

  async function handlePayNow() {
    if (!campaign) return;

    setPaying(true);
    setError("");

    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaignId: campaign.id,
          campaignTitle: campaign.campaignTitle || "Campaign",
          brandName: campaign.brandName || "",
          amount: Number(campaign.agreedPrice || 0),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to create payment session.");
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      throw new Error("Stripe checkout URL was not returned.");
    } catch (err: any) {
      setError(err.message || "Unable to start payment.");
      setPaying(false);
    }
  }

  return (
    <ProtectedRoute allowedRole="brand">
      <main className="app-page">
        <div className="app-shell">
          <div className="app-header">
            <div>
              <h1 className="app-title">
                {campaign?.campaignTitle || "Campaign Detail"}
              </h1>
              <p className="app-subtitle">
                Review campaign details, funding, and creator progress.
              </p>
            </div>

            <Link href="/brand/dashboard" className="app-button-secondary">
              Back to Dashboard
            </Link>
          </div>

          {loading && (
            <p className="app-subtitle" style={{ marginTop: "24px" }}>
              Loading campaign...
            </p>
          )}

          {error && !loading && (
            <p style={{ marginTop: "24px", color: "#dc2626" }}>{error}</p>
          )}

          {!loading && campaign && (
            <div
              style={{
                marginTop: "32px",
                display: "grid",
                gap: "24px",
                gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)",
                alignItems: "start",
              }}
            >
              <section className="app-card app-card-padding">
                <div className="app-campaign-top">
                  <div>
                    <h2
                      className="app-text"
                      style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}
                    >
                      {campaign.campaignTitle || "Untitled Campaign"}
                    </h2>

                    <p className="app-text-soft" style={{ marginTop: "12px" }}>
                      Creator: {campaign.creatorHandle || "Unknown creator"}
                    </p>
                    <p className="app-text-soft">
                      Product: {campaign.productName || "-"}
                    </p>
                    <p className="app-text-faint" style={{ marginTop: "8px" }}>
                      Delivery Window: {campaign.deliveryStartDate || "-"} →{" "}
                      {campaign.deliveryEndDate || "-"}
                    </p>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <StatusPill status={campaign.status} />
                    <span className="app-text-faint">
                      Funding: {campaign.fundingStatus || "not_funded"}
                    </span>
                  </div>
                </div>

                <CampaignTimeline status={campaign.status} />

                <div style={{ marginTop: "28px" }}>
                  <h3
                    className="app-text"
                    style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}
                  >
                    Campaign Brief
                  </h3>
                  <p className="app-text-soft" style={{ marginTop: "12px", lineHeight: 1.7 }}>
                    {campaign.campaignBrief || "No campaign brief provided."}
                  </p>
                </div>

                {campaign.creatorSubmittedArContentUrl ? (
                  <div style={{ marginTop: "28px" }}>
                    <h3
                      className="app-text"
                      style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}
                    >
                      Submitted Content
                    </h3>
                    <p className="app-text-soft" style={{ marginTop: "12px" }}>
                      <a
                        href={campaign.creatorSubmittedArContentUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ textDecoration: "underline" }}
                      >
                        View submitted content link
                      </a>
                    </p>
                  </div>
                ) : null}
              </section>

              <aside
                className="app-card app-card-padding"
                style={{ position: "sticky", top: "96px" }}
              >
                <h2
                  className="app-text"
                  style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}
                >
                  Funding Summary
                </h2>

                <div style={{ marginTop: "18px", display: "grid", gap: "12px" }}>
                  <div>
                    <p className="app-text-faint" style={{ margin: 0, fontWeight: 600 }}>
                      Campaign Amount
                    </p>
                    <p className="app-text" style={{ marginTop: "6px", marginBottom: 0 }}>
                      ${Number(campaign.agreedPrice || 0).toFixed(2)}
                    </p>
                  </div>

                  <div>
                    <p className="app-text-faint" style={{ margin: 0, fontWeight: 600 }}>
                      Platform Fee
                    </p>
                    <p className="app-text" style={{ marginTop: "6px", marginBottom: 0 }}>
                      ${Number(campaign.platformFeeAmount || 0).toFixed(2)}
                    </p>
                  </div>

                  <div>
                    <p className="app-text-faint" style={{ margin: 0, fontWeight: 600 }}>
                      Payment Status
                    </p>
                    <p className="app-text" style={{ marginTop: "6px", marginBottom: 0 }}>
                      {campaign.fundingStatus === "funded" ? "Funding secured" : "Awaiting payment"}
                    </p>
                  </div>
                </div>

                {campaign.status === "accepted" &&
                campaign.fundingStatus !== "funded" ? (
                  <div style={{ marginTop: "24px" }}>
                    <button
                      onClick={handlePayNow}
                      className="app-button"
                      disabled={paying}
                    >
                      {paying ? "Redirecting to Checkout..." : "Fund Campaign"}
                    </button>
                  </div>
                ) : null}

                <div style={{ marginTop: "16px" }}>
                  <Link
                    href="/brand/dashboard"
                    className="app-button-secondary"
                    style={{ display: "inline-block" }}
                  >
                    Back
                  </Link>
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}