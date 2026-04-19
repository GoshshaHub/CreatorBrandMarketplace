"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ProtectedRoute from "../../../../components/ProtectedRoute";

function CreatorStripeRefreshContent() {
  const searchParams = useSearchParams();
  const message =
    searchParams.get("message") ||
    "Your Stripe connection needs to be refreshed. Please try again.";

  return (
    <ProtectedRoute allowedRole="creator">
      <main className="min-h-screen p-6 max-w-2xl mx-auto">
        <div className="rounded-2xl border p-6 shadow-sm">
          <h1 className="text-3xl font-bold">Reconnect Stripe</h1>
          <p className="mt-3 text-gray-600">{message}</p>

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

export default function CreatorStripeRefreshPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-6 max-w-2xl mx-auto">
          <div className="rounded-2xl border p-6 shadow-sm">
            <h1 className="text-3xl font-bold">Loading Stripe Status</h1>
            <p className="mt-3 text-gray-600">
              Please wait while we load your Stripe connection status.
            </p>
          </div>
        </main>
      }
    >
      <CreatorStripeRefreshContent />
    </Suspense>
  );
}