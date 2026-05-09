"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProtectedRoute from "../../../../components/ProtectedRoute";

function CreatorStripeReturnContent() {
  const searchParams = useSearchParams();

  const [message, setMessage] = useState(
    "Finalizing your Stripe connection..."
  );

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function finalizeStripeConnection() {
      try {
        const accountId = searchParams.get("accountId");

        if (!accountId) {
          setMessage("Missing Stripe account ID.");
          setLoading(false);
          return;
        }

        const response = await fetch(
          `/api/stripe/account-status?accountId=${accountId}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Unable to verify Stripe account."
          );
        }

        if (data.payoutsEnabled) {
          setMessage(
            "Your Stripe account is connected and ready for payouts."
          );
        } else if (data.onboardingComplete) {
          setMessage(
            "Stripe onboarding completed. Payouts are still pending approval."
          );
        } else {
          setMessage(
            "Stripe onboarding is incomplete. Please continue setup."
          );
        }
      } catch (error: any) {
        setMessage(
          error.message || "There was a problem verifying Stripe."
        );
      } finally {
        setLoading(false);
      }
    }

    finalizeStripeConnection();
  }, [searchParams]);

  return (
    <ProtectedRoute allowedRole="creator">
      <main className="min-h-screen p-6 max-w-2xl mx-auto">
        <div className="rounded-2xl border p-6 shadow-sm">
          <h1 className="text-3xl font-bold">Stripe Connected</h1>

          <p className="mt-3 text-gray-600">
            {loading
              ? "Finalizing your Stripe connection..."
              : message}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/creator/profile"
              className="rounded-lg bg-black text-white px-4 py-2"
            >
              Back to Profile
            </Link>

            <Link
              href="/creator/dashboard"
              className="rounded-lg border px-4 py-2"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}

export default function CreatorStripeReturnPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-6 max-w-2xl mx-auto">
          <div className="rounded-2xl border p-6 shadow-sm">
            <h1 className="text-3xl font-bold">
              Loading Stripe Result
            </h1>

            <p className="mt-3 text-gray-600">
              Please wait while we load your Stripe connection result.
            </p>
          </div>
        </main>
      }
    >
      <CreatorStripeReturnContent />
    </Suspense>
  );
}