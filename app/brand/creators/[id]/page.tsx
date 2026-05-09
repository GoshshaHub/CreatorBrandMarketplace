"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../../lib/firebase";

type CreatorProfile = {
  id: string;
  displayName?: string;
  name?: string;
  handle?: string;
  username?: string;
  bio?: string;
  categories?: string[];
  campaignsCompleted?: number;
  campaignViews?: number;
  email?: string;
};

export default function BrandCreatorProfilePage() {
  const params = useParams();
  const creatorId = params.id as string;

  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCreator() {
      if (!creatorId) return;

      try {
        const snap = await getDoc(doc(db, "users", creatorId));

        if (!snap.exists()) {
          setCreator(null);
          return;
        }

        setCreator({
          id: snap.id,
          ...snap.data(),
        } as CreatorProfile);
      } catch (error) {
        console.error("Error loading creator profile:", error);
      } finally {
        setLoading(false);
      }
    }

    loadCreator();
  }, [creatorId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white px-6 py-8 text-slate-900">
        <p className="text-slate-600">Loading creator profile...</p>
      </main>
    );
  }

  if (!creator) {
    return (
      <main className="min-h-screen bg-white px-6 py-8 text-slate-900">
        <div className="mx-auto max-w-4xl">
          <p className="text-slate-700">Creator not found.</p>

          <Link
            href="/brand/creators"
            className="mt-6 inline-flex rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100"
          >
            Back to IRL Creator Marketplace
          </Link>
        </div>
      </main>
    );
  }

  const displayName = creator.displayName || creator.name || "Unnamed Creator";
  const handle = creator.handle || creator.username || "No handle added yet";
  const categories =
    creator.categories && creator.categories.length > 0
      ? creator.categories.join(", ")
      : "No categories listed yet";

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-900">
              {displayName}
            </h1>
            <p className="mt-2 text-slate-500">
              {handle.startsWith("@") ? handle : `@${handle}`}
            </p>
          </div>

          <Link
            href="/brand/creators"
            className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100"
          >
            Back to Network
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
          <section className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Bio</h2>
            <p className="mt-3 text-slate-700">
              {creator.bio || "This creator has not added a bio yet."}
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Categories</h2>
            <p className="mt-3 text-slate-700">{categories}</p>
          </section>

          <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Campaigns Completed</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {creator.campaignsCompleted || 0}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Campaign Views</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {creator.campaignViews || 0}
              </p>
            </div>
          </section>

          <Link
            href={`/brand/new-campaign?creatorId=${creator.id}`}
            style={{
              backgroundColor: "#0f172a",
              color: "#ffffff",
              padding: "10px 22px",
              borderRadius: "12px",
              fontSize: "0.875rem",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "150px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
            }}
          >
            Invite Creator
          </Link>
        </div>
      </div>
    </main>
  );
}