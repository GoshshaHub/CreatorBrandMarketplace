"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
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
  profileUrl?: string;
  platforms?: string[];
  followerRange?: string;
  followers?: number;
  creatorStatus?: string;
};

function getInitials(name: string) {
  const source = (name || "U").trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function formatHandle(value?: string) {
  const handle = (value || "").trim();

  if (!handle) return "@creator";

  return handle.startsWith("@")
    ? handle
    : `@${handle}`;
}

function normalizeUrl(value?: string) {
  const trimmed = (value || "").trim();

  if (!trimmed) return "";

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function getFollowerRange(creator: CreatorProfile) {
  if (creator.followerRange) {
    return creator.followerRange;
  }

  const followers = Number(creator.followers || 0);

  if (followers >= 1000000) return "1M+";
  if (followers >= 500000) return "500K–1M";
  if (followers >= 100000) return "100K–500K";
  if (followers >= 50000) return "50K–100K";
  if (followers >= 10000) return "10K–50K";
  if (followers >= 1000) return "1K–10K";

  return "Follower range not listed";
}

export default function PublicCreatorProfilePage() {
  const params = useParams();
  const creatorId = params.id as string;

  const [creator, setCreator] =
    useState<CreatorProfile | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCreator() {
      try {
        const userSnap = await getDoc(
          doc(db, "users", creatorId)
        );

        const creatorSnap = await getDoc(
          doc(db, "creators", creatorId)
        );

        if (!userSnap.exists() && !creatorSnap.exists()) {
          setCreator(null);
          return;
        }

        const userData = userSnap.exists()
          ? userSnap.data()
          : {};

        const creatorData = creatorSnap.exists()
          ? creatorSnap.data()
          : {};

        const merged = {
          id: creatorId,
          ...creatorData,
          ...userData,
        } as CreatorProfile;

        if (merged.creatorStatus === "removed") {
          setCreator(null);
          return;
        }

        setCreator(merged);
      } catch (error) {
        console.error(
          "Error loading public creator profile:",
          error
        );
      } finally {
        setLoading(false);
      }
    }

    if (creatorId) {
      loadCreator();
    }
  }, [creatorId]);

  const displayName =
    creator?.displayName ||
    creator?.name ||
    "Unnamed Creator";

  const handle = formatHandle(
    creator?.handle || creator?.username
  );

  const profileUrl = normalizeUrl(
    creator?.profileUrl
  );

  const initials = useMemo(
    () => getInitials(displayName),
    [displayName]
  );

  const categories =
    creator?.categories &&
    creator.categories.length > 0
      ? creator.categories.join(", ")
      : "Categories not listed";

  if (loading) {
    return (
      <main className="min-h-screen bg-white p-8 text-slate-900">
        Loading creator profile...
      </main>
    );
  }

  if (!creator) {
    return (
      <main className="min-h-screen bg-white p-8 text-slate-900">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-3xl font-bold">
            Creator not found
          </h1>

          <Link
            href="/creators"
            className="mt-6 inline-flex rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100"
          >
            Back to Creator Directory
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link
          href="/creators"
          className="mb-8 inline-flex rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100"
        >
          ← Back to Creator Directory
        </Link>

        <div className="rounded-3xl border border-slate-300 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <div className="h-28 w-28 overflow-hidden rounded-full border border-slate-300 bg-slate-50">
              {creator.profilePhotoUrl ? (
                <img
                  src={creator.profilePhotoUrl}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-slate-900">
                  {initials}
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-4xl font-black">
                  {displayName}
                </h1>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {creator.creatorStatus === "verified"
                    ? "Verified Creator"
                    : "Publicly Listed Creator"}
                </span>
              </div>

              <p className="mt-2 text-lg text-slate-500">
                {handle}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-pink-50 px-3 py-1 text-sm font-semibold text-pink-700">
                  {categories}
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
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-xl font-bold">
              About
            </h2>

            <p className="mt-3 leading-7 text-slate-700">
              {creator.bio ||
                "This creator has not added a bio yet."}
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
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
              className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100"
            >
              Claim Profile
            </Link>

            <Link
              href={`/creator/remove?creatorId=${creator.id}`}
              className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-100"
            >
              Request Removal
            </Link>

            {profileUrl && (
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100"
              >
                View Social Profile
              </a>
            )}
          </div>

          <p className="mt-10 text-sm text-slate-500">
            Creator information is displayed from publicly
            available sources for discovery purposes.
            Creators may claim, update, or request removal
            of their profile at any time.
          </p>
        </div>
      </div>
    </main>
  );
}