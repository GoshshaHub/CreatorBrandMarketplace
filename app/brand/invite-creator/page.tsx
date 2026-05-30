"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "../../../components/ProtectedRoute";

export default function InviteExistingCreatorPage() {
  const [creatorName, setCreatorName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [copied, setCopied] = useState(false);

  const inviteMessage = useMemo(() => {
    const name = creatorName.trim() || "there";
    const brand = brandName.trim() || "my brand";

    return `Hi ${name},

I just launched an IRL campaign through Goshsha's IRL Campaign Network and would love to invite you to collaborate with ${brand}.

Please join Goshsha as a creator here:
https://irl.goshsha.com/signup?role=creator

Once your creator profile is set up, I can invite you directly to the campaign inside the platform.

Thank you!`;
  }, [creatorName, brandName]);

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <ProtectedRoute allowedRole="brand">
      <main className="min-h-screen bg-white px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl">
          <Link href="/brand/dashboard" className="inline-block rounded-lg border px-4 py-2">
            Back to Dashboard
          </Link>

          <h1 className="mt-8 text-4xl font-bold">Invite My Existing Creator</h1>

          <p className="mt-3 text-slate-600">
            Generate a simple DM or email message for a creator you already work with.
          </p>

          <div className="mt-8 rounded-2xl border p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <input
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value)}
                placeholder="Creator name optional"
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-500"
              />

              <input
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Brand name optional"
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-500"
              />
            </div>

            <textarea
              readOnly
              value={inviteMessage}
              className="mt-6 min-h-72 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950"
            />

            <button
              onClick={copyInvite}
              className="mt-4 rounded-xl bg-slate-950 px-5 py-3 font-bold text-white"
            >
              {copied ? "Copied!" : "Copy Invite Message"}
            </button>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}