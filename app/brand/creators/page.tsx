"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";

type CreatorProfile = {
  id: string;
  displayName?: string;
  name?: string;
  handle?: string;
  username?: string;
  bio?: string;
  categories?: string[];
  platforms?: string[];
  followerRange?: string;
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

function isSubscribed(status?: string) {
  return status === "trialing" || status === "active";
}

export default function BrandCreatorsPage() {
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [paywallLoading, setPaywallLoading] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("none");
  const [brandName, setBrandName] = useState("");
  const [brandEmail, setBrandEmail] = useState("");
  const [brandUid, setBrandUid] = useState("");

  const [campaignStats, setCampaignStats] = useState<
    Record<string, { completed: number; live: number }>
  >({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          setLoading(false);
          return;
        }

        setBrandUid(user.uid);
        setBrandEmail(user.email || "");

        const brandSnap = await getDoc(doc(db, "brands", user.uid));
        const brandData = brandSnap.exists() ? brandSnap.data() : null;

        const status = String(brandData?.subscriptionStatus || "none");
        setSubscriptionStatus(status);
        setBrandName(
          String(
            brandData?.brandName ||
              brandData?.displayName ||
              user.displayName ||
              "Brand"
          )
        );

        if (!isSubscribed(status)) {
          setLoading(false);
          return;
        }

        await loadCreators();
      } catch (error) {
        console.error("Error loading brand creators page:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

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
          ["accepted", "funded", "submitted", "approved"].includes(data.status)
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

  async function startStripeCheckout() {
    if (!brandUid || !brandEmail) {
      alert("Please log in again before starting your trial.");
      return;
    }

    setPaywallLoading(true);

    try {
      const res = await fetch("/api/brand/create-subscription-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: brandUid,
          email: brandEmail,
          brandName,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error || "Unable to start Stripe checkout.");
      }

      window.location.href = data.checkoutUrl;
    } catch (err: any) {
      alert(err?.message || "Unable to start trial.");
    } finally {
      setPaywallLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white p-8 text-slate-900">
        Loading creators...
      </main>
    );
  }

  if (!isSubscribed(subscriptionStatus)) {
    return (
      <main className="min-h-screen bg-white text-slate-900">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <p className="text-sm font-bold uppercase tracking-wide text-pink-600">
            Activate Your Campaign
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Unlock creator invites and the IRL Campaign Network.
          </h1>

          <p className="mt-4 text-lg text-slate-600">
            Your first IRL campaign preview is free. Start your 14-day free trial
            to invite creators, access the creator network, and scale your
            campaign.
          </p>

          <button
            onClick={startStripeCheckout}
            disabled={paywallLoading}
            className="mt-8 rounded-2xl bg-slate-950 px-8 py-4 text-lg font-bold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {paywallLoading ? "Starting trial..." : "Start 14-Day Free Trial"}
          </button>

          <p className="mt-3 text-sm text-slate-500">
            $75/month after trial. Cancel anytime.
          </p>

          <Link
            href="/brand/dashboard"
            className="mt-6 inline-block text-sm font-semibold underline"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

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

        {creators.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-700">
            No creators found yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {creators.map((creator) => {
              const displayName =
                creator.displayName || creator.name || "Unnamed Creator";

              const handle = creator.handle || creator.username || "";

              const formattedHandle = handle
                ? handle.startsWith("@")
                  ? handle
                  : `@${handle}`
                : "@No handle added yet";

              const categories =
                creator.categories && creator.categories.length > 0
                  ? creator.categories.join(", ")
                  : "No categories listed yet";

              const platforms =
                creator.platforms && creator.platforms.length > 0
                    ? creator.platforms.join(", ")
                    : "";

              const followerRange = creator.followerRange || "";
              
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
                  <div className="flex items-start gap-4">
                    <div className="h-14 w-14 overflow-hidden rounded-full border border-slate-300 bg-slate-50">
                      {creator.profilePhotoUrl ? (
                        <img
                          src={creator.profilePhotoUrl}
                          className="h-full w-full object-cover"
                          alt={displayName}
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

                  <p className="mt-5 text-slate-700">
                    {creator.bio || "This creator has not added a bio yet."}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="rounded-full bg-pink-50 px-3 py-1 text-sm font-semibold text-pink-700">
                      {categories}
                    </span>

                    {platforms && (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                        {platforms}
                      </span>
                    )}

                    {followerRange && (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                        {followerRange}
                      </span>
                    )}
                  </div>

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