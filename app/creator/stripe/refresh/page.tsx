"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProtectedRoute from "../../../../components/ProtectedRoute";

export default function CreatorStripeRefreshPage() {
  const searchParams = useSearchParams();
  const accountId = searchParams.get("accountId") || "";
  const hasRunRef = useRef(false);

  const [message, setMessage] = useState("Refreshing your Stripe onboarding link...");

  useEffect(() => {
    async function refreshLink() {
      if (hasRunRef.current) return;
      hasRunRef.current = true;

      if (!accountId) {
        setMessage("Missing Stripe account information.");
        return;
      }

      try {
        const res = await fetch("/api/stripe/create-account-link", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ accountId }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Unable to refresh Stripe onboarding.");
        }

        if (data.url) {
          window.location.href = data.url;
          return;
        }

        throw new Error("Stripe onboarding URL was not returned.");
      } catch (err: any) {
        setMessage(err.message || "We couldn’t refresh your onboarding link.");
      }
    }

    refreshLink();
  }, [accountId]);

  return (
    <ProtectedRoute allowedRole="creator">
      <main className="app-page">
        <div className="app-shell" style={{ maxWidth: "760px" }}>
          <div className="app-card app-card-padding" style={{ marginTop: "40px" }}>
            <h1 className="app-title">Refreshing Stripe Setup</h1>
            <p className="app-subtitle" style={{ marginTop: "12px" }}>
              {message}
            </p>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}