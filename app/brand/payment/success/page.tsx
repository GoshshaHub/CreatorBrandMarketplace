"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProtectedRoute from "../../../../components/ProtectedRoute";
import { fundCampaign } from "../../../../lib/campaigns";

export default function BrandPaymentSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") || "";
  const campaignId = searchParams.get("campaignId") || "";

  const hasRunRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("Verifying your payment...");

  useEffect(() => {
    async function verifyAndFund() {
      if (hasRunRef.current) return;
      hasRunRef.current = true;

      if (!sessionId || !campaignId) {
        setMessage("Missing payment information.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/stripe/checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Unable to verify payment.");
        }

        if (data.paymentStatus !== "paid") {
          throw new Error("Payment has not been completed.");
        }

        await fundCampaign(campaignId);

        setSuccess(true);
        setMessage("Payment confirmed. Campaign is now funded.");
      } catch (err: any) {
        setSuccess(false);
        setMessage(err.message || "We couldn’t confirm your payment.");
      } finally {
        setLoading(false);
      }
    }

    verifyAndFund();
  }, [sessionId, campaignId]);

  return (
    <ProtectedRoute allowedRole="brand">
      <main className="app-page">
        <div className="app-shell" style={{ maxWidth: "760px" }}>
          <div className="app-card app-card-padding" style={{ marginTop: "40px" }}>
            <h1 className="app-title">
              {loading
                ? "Verifying Payment"
                : success
                ? "Campaign Funded"
                : "Payment Not Confirmed"}
            </h1>

            <p className="app-subtitle" style={{ marginTop: "12px" }}>
              {message}
            </p>

            <div
              style={{
                marginTop: "24px",
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              {campaignId ? (
                <Link href={`/brand/campaign/${campaignId}`} className="app-button">
                  Back to Campaign
                </Link>
              ) : null}

              <Link href="/brand/dashboard" className="app-button-secondary">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}