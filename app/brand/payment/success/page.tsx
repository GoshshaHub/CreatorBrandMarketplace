"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProtectedRoute from "../../../../components/ProtectedRoute";
import { fundCampaign } from "../../../../lib/campaigns";

function BrandPaymentSuccessContent() {
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
          throw new Error("Payment has not been completed yet.");
        }

        await fundCampaign(campaignId);

        setSuccess(true);
        setMessage("Payment confirmed. Campaign is now funded.");
      } catch (err: any) {
        setSuccess(false);
        setMessage(err?.message || "We could not confirm your payment.");
      } finally {
        setLoading(false);
      }
    }

    verifyAndFund();
  }, [sessionId, campaignId]);

  return (
    <ProtectedRoute allowedRole="brand">
      <main className="min-h-screen p-6 max-w-3xl mx-auto">
        <div className="rounded-2xl border p-6 shadow-sm">
          <h1 className="text-3xl font-bold">
            {loading
              ? "Confirming Payment"
              : success
              ? "Campaign Funded"
              : "Payment Check Needed"}
          </h1>

          <p className="mt-3 text-gray-600">{message}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/brand/dashboard"
              className="rounded-lg bg-black text-white px-4 py-2"
            >
              Back to Dashboard
            </Link>

            {campaignId && (
              <Link
                href={`/brand/campaign/${campaignId}`}
                className="rounded-lg border px-4 py-2"
              >
                View Campaign
              </Link>
            )}
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}

export default function BrandPaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-6 max-w-3xl mx-auto">
          <div className="rounded-2xl border p-6 shadow-sm">
            <h1 className="text-3xl font-bold">Loading Payment Result</h1>
            <p className="mt-3 text-gray-600">
              Please wait while we load your payment confirmation.
            </p>
          </div>
        </main>
      }
    >
      <BrandPaymentSuccessContent />
    </Suspense>
  );
}