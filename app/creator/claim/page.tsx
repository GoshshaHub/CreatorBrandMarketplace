"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function CreatorClaimPageContent() {
  const searchParams = useSearchParams();
  const creatorId = searchParams.get("creatorId") || "";

  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleClaim() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/creator/request-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Unable to send claim email.");
      }

      setSent(true);
    } catch (err: any) {
      setError(err?.message || "Unable to send claim email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-white">
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">
          Claim Creator Profile
        </h1>

        {!sent ? (
          <>
            <p className="mt-4 text-slate-600">
              We will send a verification link to the email associated with this
              creator profile. Verification is free. Joining our IRL Campaign Network as a creator is always free.
            </p>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

            <button
              onClick={handleClaim}
              disabled={loading || !creatorId}
              className="mt-6 w-full rounded-lg py-3 font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "#0f172a" }}
            >
              {loading ? "Sending verification email..." : "Send Verification Email"}
            </button>

            <Link
                href="/login"
                className="mt-3 flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white py-3 font-semibold text-slate-800 hover:bg-slate-50"
            >
                Explore Network
            </Link>

          </>
        ) : (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="font-semibold text-green-800">
              Verification email sent.
            </p>
            <p className="mt-2 text-sm text-green-700">
              Check your inbox and click the verification link to continue.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

export default function CreatorClaimPage() {
  return (
    <Suspense fallback={<main className="p-8">Loading...</main>}>
      <CreatorClaimPageContent />
    </Suspense>
  );
}