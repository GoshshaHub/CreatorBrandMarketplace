"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function CreatorRemovePageContent() {
  const searchParams = useSearchParams();
  const creatorId = searchParams.get("creatorId") || "";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!creatorId) {
      setError("Missing creator profile ID.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/creator/request-removal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          creatorId,
          email: email.trim().toLowerCase(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Unable to request removal.");
      }

      setMessage(
        "Please check your email. We sent a confirmation link to remove this profile."
      );
      setEmail("");
    } catch (err: any) {
      setError(err?.message || "Unable to request removal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-xl px-6 py-16">
        <Link
          href="/creators"
          className="inline-flex rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100"
        >
          ← Back to Creator Directory
        </Link>

        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wide text-pink-600">
            Remove Creator Profile
          </p>

          <h1 className="mt-3 text-3xl font-black text-slate-950">
            Request removal of this listed profile.
          </h1>

          <p className="mt-4 text-slate-600">
            Enter the email connected to this creator profile. If it matches our
            record, we’ll send a confirmation link before removing the public
            listing.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Email address
              </label>

              <input
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"
                type="email"
                placeholder="creator@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

            {message && (
              <p className="text-sm font-semibold text-green-700">{message}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl px-5 py-3 text-sm font-bold shadow-sm disabled:opacity-60"
              style={{
                backgroundColor: "#0f172a",
                color: "#ffffff",
              }}
            >
              {loading ? "Sending confirmation..." : "Send Removal Confirmation"}
            </button>
          </form>

          <p className="mt-6 text-xs leading-6 text-slate-500">
            This process helps protect creators by confirming email ownership
            before a public profile is removed.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function CreatorRemovePage() {
  return (
    <Suspense fallback={<main className="p-8">Loading...</main>}>
      <CreatorRemovePageContent />
    </Suspense>
  );
}