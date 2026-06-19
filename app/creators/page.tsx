"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";

type CreatorProfile = {
  id: string;
  displayName?: string;
  name?: string;
  handle?: string;
  username?: string;
  bio?: string;
  categories?: string[];
  profilePhotoUrl?: string;
  profileUrl?: string;
  platforms?: string[];
  followerRange?: string;
  followers?: number;
  isMarketplaceVisible?: boolean;
  creatorStatus?: string;
};

const followerRanges = [
  "All followers",
  "1K–10K",
  "10K–50K",
  "50K–100K",
  "100K–500K",
  "500K–1M",
  "1M+",
];

function getInitials(name: string) {
  const source = (name || "U").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function formatHandle(value?: string) {
  const handle = (value || "").trim();
  if (!handle) return "@creator";
  return handle.startsWith("@") ? handle : `@${handle}`;
}

function getFollowerRange(creator: CreatorProfile) {
  if (creator.followerRange) return creator.followerRange;

  const followers = Number(creator.followers || 0);

  if (followers >= 1000000) return "1M+";
  if (followers >= 500000) return "500K–1M";
  if (followers >= 100000) return "100K–500K";
  if (followers >= 50000) return "50K–100K";
  if (followers >= 10000) return "10K–50K";
  if (followers >= 1000) return "1K–10K";

  return "Follower range not listed";
}

export default function PublicCreatorsPage() {
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [followerFilter, setFollowerFilter] = useState("All followers");

  useEffect(() => {
    async function loadCreators() {
      try {
        const q = query(
        collection(db, "creators"),
        where("isMarketplaceVisible", "==", true)
        );

        const snapshot = await getDocs(q);

        const creatorList = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((creator: any) => creator.creatorStatus !== "removed") as CreatorProfile[];

        setCreators(creatorList);
      } catch (error) {
        console.error("Error loading public creators:", error);
      } finally {
        setLoading(false);
      }
    }

    loadCreators();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();

    creators.forEach((creator) => {
      creator.categories?.forEach((category) => {
        if (category) set.add(category);
      });
    });

    return ["All categories", ...Array.from(set).sort()];
  }, [creators]);

  const filteredCreators = useMemo(() => {
    return creators.filter((creator) => {
      const matchesCategory =
        categoryFilter === "All categories" ||
        creator.categories?.includes(categoryFilter);

      const matchesFollowers =
        followerFilter === "All followers" ||
        getFollowerRange(creator) === followerFilter;

      return matchesCategory && matchesFollowers;
    });
  }, [creators, categoryFilter, followerFilter]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white p-8 text-slate-900">
        Loading creators...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-10">
          <p className="text-sm font-bold uppercase tracking-wide text-pink-600">
            Goshsha IRL Campaign Network
          </p>

          <h1 className="mt-3 text-4xl font-black text-slate-950 md:text-5xl">
            Discover creators for real-world campaign reach.
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            Browse publicly listed creators available for brand discovery.
            Start a trial to invite creators into your IRL campaigns.
          </p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">
              Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"
            >
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">
              Follower range
            </label>
            <select
              value={followerFilter}
              onChange={(e) => setFollowerFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"
            >
              {followerRanges.map((range) => (
                <option key={range}>{range}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredCreators.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-700">
            No creators match these filters yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {filteredCreators.map((creator) => {
              const displayName =
                creator.displayName || creator.name || "Unnamed Creator";

              const handle = formatHandle(creator.handle || creator.username);
              const categoriesText =
                creator.categories && creator.categories.length > 0
                  ? creator.categories.join(", ")
                  : "Categories not listed";

              const initials = getInitials(displayName);

              return (
                <div
                  key={creator.id}
                  className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-16 w-16 overflow-hidden rounded-full border border-slate-300 bg-slate-50">
                      {creator.profilePhotoUrl ? (
                        <img
                          src={creator.profilePhotoUrl}
                          className="h-full w-full object-cover"
                          alt={`${displayName} profile photo`}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-bold text-slate-900">
                          {initials}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold text-slate-900">
                          {displayName}
                        </h2>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                            {creator.creatorStatus === "verified" ? (
                            <span
                                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
                                style={{
                                backgroundColor: "#2563eb",
                                color: "#ffffff",
                                }}
                            >
                                ✓
                            </span>
                            ) : (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                                Publicly Listed
                            </span>
                            )}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-500">{handle}</p>
                    </div>
                  </div>

                  <p className="mt-5 line-clamp-3 text-slate-700">
                    {creator.bio || "Creator bio coming soon."}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="rounded-full bg-pink-50 px-3 py-1 text-sm font-semibold text-pink-700">
                      {categoriesText}
                    </span>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                      {getFollowerRange(creator)}
                    </span>

                    {creator.platforms?.length > 0 && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                        {creator.platforms.join(", ")}
                    </span>
                    )}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      href={`/creators/${creator.id}`}
                      className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100"
                    >
                      View Profile
                    </Link>

                    <Link
                        href={`/signup?role=brand&creatorId=${creator.id}`}
                        className="rounded-xl px-5 py-2 text-sm font-semibold shadow-sm hover:opacity-90"
                        style={{
                            backgroundColor: "#0f172a",
                            color: "#ffffff",
                            textDecoration: "none",
                        }}
                    >
                        Invite Creator
                    </Link>

                    <Link
                      href={`/signup?role=creator&claimCreatorId=${creator.id}`}
                      className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100"
                    >
                      Claim
                    </Link>

                    <Link
                      href={`/creator/remove?creatorId=${creator.id}`}
                      className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-100"
                    >
                      Remove
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-10 text-sm text-slate-500">
          Creator profiles are displayed from publicly available information for
          discovery purposes. Creators may claim, update, or request removal of
          their profile at any time.
        </p>
      </div>
    </main>
  );
}