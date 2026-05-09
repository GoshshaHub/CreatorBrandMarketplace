"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../lib/firebase";

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
};

export default function BrandCreatorsPage() {
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCreators() {
      try {
        const q = query(
          collection(db, "users"),
          where("roles", "array-contains", "creator")
        );

        const snapshot = await getDocs(q);

        const creatorList: CreatorProfile[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as CreatorProfile[];

        setCreators(creatorList);
      } catch (error) {
        console.error("Error loading creators:", error);
      } finally {
        setLoading(false);
      }
    }

    loadCreators();
  }, []);

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-900">
              IRL Campaign Network
            </h1>
            <p className="mt-2 text-base text-slate-600">
              Discover creators and invite the right fit for your next campaign.
            </p>
          </div>

          <Link
            href="/brand/dashboard"
            className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100"
          >
            Back to Dashboard
          </Link>
        </div>

        {loading ? (
          <p className="text-slate-600">Loading creators...</p>
        ) : creators.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-700">
            No creators found yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {creators.map((creator) => {
              const displayName =
                creator.displayName || creator.name || "Unnamed Creator";

              const handle =
                creator.handle || creator.username || "No handle added yet";

              const categories =
                creator.categories && creator.categories.length > 0
                  ? creator.categories.join(", ")
                  : "No categories listed yet";

              return (
                <div
                  key={creator.id}
                  className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm"
                >
                  <h2 className="text-2xl font-bold text-slate-900">
                    {displayName}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {handle.startsWith("@") ? handle : `@${handle}`}
                  </p>

                  <p className="mt-5 text-slate-700">
                    {creator.bio || "This creator has not added a bio yet."}
                  </p>

                  <p className="mt-5 text-slate-700">{categories}</p>

                  <div className="mt-5 space-y-2 text-slate-700">
                    <p>
                      Campaigns completed:{" "}
                      <span className="font-semibold text-slate-900">
                        {creator.campaignsCompleted || 0}
                      </span>
                    </p>

                    <p>
                      Campaign views:{" "}
                      <span className="font-semibold text-slate-900">
                        {creator.campaignViews || 0}
                      </span>
                    </p>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    {/* View Profile */}
                    <Link
                      href={`/brand/creators/${creator.id}`}
                      className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100"
                    >
                      View Profile
                    </Link>

                    {/* Invite Creator (FIXED) */}
                    <Link
                      href={`/brand/new-campaign?creatorId=${creator.id}`}
                      style={{
                        backgroundColor: "#0f172a",
                        color: "#ffffff",
                        padding: "8px 20px",
                        borderRadius: "12px",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: "140px",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                      }}
                    >
                      Invite Creator
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}