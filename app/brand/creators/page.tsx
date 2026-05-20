"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

type CreatorProfile = {
  id: string;
  displayName?: string;
  name?: string;
  handle?: string;
  username?: string;
  bio?: string;
  categories?: string[];
  profilePhotoUrl?: string;
};

function getInitials(name: string) {
  const source = (name || "U").trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export default function BrandCreatorsPage() {
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [campaignStats, setCampaignStats] = useState<
    Record<string, { completed: number; live: number }>
  >({});

  useEffect(() => {
    async function loadCreators() {
      try {
        // 1. Load creators
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

        // 2. Load ALL campaigns once
        const campaignSnap = await getDocs(collection(db, "campaigns"));

        const stats: Record<string, { completed: number; live: number }> = {};

        campaignSnap.forEach((doc) => {
          const data = doc.data();
          const creatorId = data.creatorId;

          if (!creatorId) return;

          if (!stats[creatorId]) {
            stats[creatorId] = { completed: 0, live: 0 };
          }

          if (data.status === "completed") {
            stats[creatorId].completed += 1;
          }

          if (
            ["accepted", "funded", "submitted", "approved"].includes(
              data.status
            )
          ) {
            stats[creatorId].live += 1;
          }
        });

        setCampaignStats(stats);
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
                creator.handle || creator.username || "";

              const formattedHandle = handle
                ? handle.startsWith("@")
                  ? handle
                  : `@${handle}`
                : "@No handle added yet";

              const categories =
                creator.categories && creator.categories.length > 0
                  ? creator.categories.join(", ")
                  : "No categories listed yet";

              const stats = campaignStats[creator.id] || {
                completed: 0,
                live: 0,
              };

              const initials = getInitials(displayName);    

              return (
                <div
                  key={creator.id}
                  className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm"
                >
                  {/* PROFILE HEADER */}
                  <div className="flex items-start gap-4">
                    <div className="h-14 w-14 overflow-hidden rounded-full border border-slate-300 bg-slate-50">
                      {creator.profilePhotoUrl ? (
                        <img
                          src={creator.profilePhotoUrl}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-bold text-slate-900">
                          {initials}
                        </div>
                      )}
                    </div>

                    <div>
                      <h2 className="text-xl font-bold text-slate-900">
                        {displayName}
                      </h2>

                      <p className="text-sm text-slate-500">
                        {formattedHandle}
                      </p>
                    </div>
                  </div>

                  {/* BIO */}
                  <p className="mt-5 text-slate-700">
                    {creator.bio || "This creator has not added a bio yet."}
                  </p>

                  {/* CATEGORY */}
                  <p className="mt-5 text-slate-700">{categories}</p>

                  {/* STATS */}
                  <div className="mt-5 text-sm text-slate-700">
                    <p>
                      Campaigns completed:{" "}
                      <span className="font-semibold text-slate-900">
                        {stats.completed}
                      </span>
                    </p>

                    <p>
                      Live campaigns:{" "}
                      <span className="font-semibold text-slate-900">
                        {stats.live}
                      </span>
                    </p>
                  </div>

                  {/* CTA */}
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      href={`/brand/creators/${creator.id}`}
                      className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100"
                    >
                      View Profile
                    </Link>

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