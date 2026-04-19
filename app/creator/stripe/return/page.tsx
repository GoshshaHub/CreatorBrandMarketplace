"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProtectedRoute from "../../../../components/ProtectedRoute";

export default function CreatorStripeReturnPage() {
  const searchParams = useSearchParams();
  const accountId = searchParams.get("accountId") || "";
  const hasRunRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("Checking your Stripe account status...");

  useEffect(() => {
    async function checkAccount() {
      if (hasRunRef.current) return;
      hasRunRef.current = true;

      if (!accountId) {
        setMessage("Missing Stripe account information.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/stripe/account-status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ accountId }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Unable to check Stripe account status.");
        }

        if (data.ready) {
          setConnected(true);
          setMessage("Your payout account is connected and ready.");
        } else {
          setConnected(false);
          setMessage(
            "Your Stripe setup is still incomplete. Continue onboarding to finish account verification."
          );
        }
      } catch (err: any) {
        setConnected(false);
        setMessage(err.message || "We couldn’t verify your Stripe account.");
      } finally {
        setLoading(false);
      }
    }

    checkAccount();
  }, [accountId]);

  return (
    <ProtectedRoute allowedRole="creator">
      <main className="app-page">
        <div className="app-shell" style={{ maxWidth: "760px" }}>
          <div className="app-card app-card-padding" style={{ marginTop: "40px" }}>
            <h1 className="app-title">
              {loading
                ? "Checking Stripe Setup"
                : connected
                ? "Payout Account Connected"
                : "Stripe Setup Incomplete"}
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
              <Link href="/creator/profile" className="app-button">
                Back to Profile
              </Link>

              <Link href="/creator/dashboard" className="app-button-secondary">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}