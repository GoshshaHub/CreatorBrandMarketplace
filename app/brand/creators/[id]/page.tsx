"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../../../../lib/firebase";

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
  email?: string;
  contactEmail?: string;
  profilePhotoUrl?: string;
  profileUrl?: string;
};

function isSubscribed(status?: string) {
  return status === "trialing" || status === "active";
}

function getInitials(name: string, email: string) {
  const source = (name || email || "U").trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function normalizeProfileUrl(value?: string) {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export default function BrandCreatorProfilePage() {
  const params = useParams();
  const creatorId = params.id as string;

  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [paywallLoading, setPaywallLoading] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState("none");
  const [brandName, setBrandName] = useState("");

  const [campaignsCompleted, setCampaignsCompleted] = useState(0);
  const [liveCampaigns, setLiveCampaigns] = useState(0);
  const [invitesReceived, setInvitesReceived] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user || !creatorId) {
          setLoading(false);
          return;
        }

        const brandSnap = await getDoc(doc(db, "brands", user.uid));
        const brandData = brandSnap.exists() ? brandSnap.data() : null;
        const status = String(brandData?.subscriptionStatus || "none");

        setSubscriptionStatus(status);
        setBrandName(String(brandData?.brandName || user.displayName || "Brand"));

        if (!isSubscribed(status)) {
          setLoading(false);
          return;
        }

        const [userSnap, creatorSnap] = await Promise.all([
          getDoc(doc(db, "users", creatorId)),
          getDoc(doc(db, "creators", creatorId)),
        ]);

        if (!userSnap.exists() && !creatorSnap.exists()) {
          setCreator(null);
          return;
        }

        const userData = userSnap.exists() ? userSnap.data() : {};
        const creatorData = creatorSnap.exists() ? creatorSnap.data() : {};

        setCreator({
          id: creatorId,
          ...creatorData,
          ...userData,
        } as CreatorProfile);

        const campaignsRef = collection(db, "campaigns");

        const completedQuery = query(
          campaignsRef,
          where("creatorId", "==", creatorId),
          where("status", "==", "completed")
        );

        const liveQuery = query(
          campaignsRef,
          where("creatorId", "==", creatorId),
          where("status", "in", ["accepted", "funded", "submitted", "approved"])
        );

        const invitesQuery = query(
          campaignsRef,
          where("creatorId", "==", creatorId),
          where("status", "==", "invited")
        );

        const [completedSnap, liveSnap, invitesSnap] = await Promise.all([
          getDocs(completedQuery),
          getDocs(liveQuery),
          getDocs(invitesQuery),
        ]);

        setCampaignsCompleted(completedSnap.size);
        setLiveCampaigns(liveSnap.size);
        setInvitesReceived(invitesSnap.size);
      } catch (error) {
        console.error("Error loading creator profile:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [creatorId]);

  async function startStripeCheckout() {
    const user = auth.currentUser;

    if (!user || !user.email) {
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
          uid: user.uid,
          email: user.email,
          brandName: brandName || user.displayName || "Brand",
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

  const displayName = creator?.displayName || creator?.name || "Unnamed Creator";
  const rawHandle = creator?.handle || creator?.username || "";
  const handle = rawHandle
    ? rawHandle.startsWith("@")
      ? rawHandle
      : `@${rawHandle}`
    : "No handle added yet";

  const profileUrl = normalizeProfileUrl(creator?.profileUrl);
  const contactEmail = creator?.contactEmail || creator?.email || "";

  const initials = useMemo(
    () => getInitials(displayName, contactEmail),
    [displayName, contactEmail]
  );

  const categories =
    creator?.categories && creator.categories.length > 0
      ? creator.categories.join(", ")
      : "No categories listed yet";

  const platforms =
  creator?.platforms && creator.platforms.length > 0
    ? creator.platforms.join(", ")
    : "";

  const followerRange = creator?.followerRange || "";    

  if (loading) {
    return (
      <main className="min-h-screen bg-white px-6 py-8 text-slate-900">
        <p className="text-slate-600">Loading creator profile...</p>
      </main>
    );
  }

  if (!isSubscribed(subscriptionStatus)) {
    return (
      <main className="min-h-screen bg-white text-slate-900">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <p className="text-sm font-bold uppercase tracking-wide text-pink-600">
            Activate Creator Access
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Start your 14-day free trial to view creator profiles.
          </h1>

          <p className="mt-4 text-lg text-slate-600">
            Your first IRL campaign preview is free. Creator profiles, creator
            invitations, and campaign scaling require an active trial.
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

  if (!creator) {
    return (
      <main className="min-h-screen bg-white px-6 py-8 text-slate-900">
        <div className="mx-auto max-w-5xl">
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

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-5">
            <div className="h-24 w-24 overflow-hidden rounded-full border border-slate-300 bg-slate-50 shadow-sm">
              {creator.profilePhotoUrl ? (
                <img
                  src={creator.profilePhotoUrl}
                  alt={`${displayName} profile photo`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-slate-900">
                  {initials}
                </div>
              )}
            </div>

            <div>
              <h1 className="text-4xl font-bold text-slate-900">
                {displayName}
              </h1>

              {profileUrl ? (
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex text-lg font-medium text-slate-500 underline underline-offset-4 hover:text-slate-900"
                >
                  {handle}
                </a>
              ) : (
                <p className="mt-2 text-lg text-slate-500">{handle}</p>
              )}

              <p className="mt-2 text-sm text-slate-500">
                {campaignsCompleted} completed · {liveCampaigns} live ·{" "}
                {invitesReceived} invited
              </p>
            </div>
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
            <p className="mt-3 leading-7 text-slate-700">
              {creator.bio || "This creator has not added a bio yet."}
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Categories</h2>
            <p className="mt-3 text-slate-700">{categories}</p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Platforms</h2>
            <p className="mt-3 text-slate-700">
              {platforms || "No platforms listed yet."}
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Follower Range</h2>
            <p className="mt-3 text-slate-700">
              {followerRange || "No follower range listed yet."}
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Creator Contact</h2>

            {contactEmail ? (
              <a href={`mailto:${contactEmail}`} className="mt-3 inline-flex text-slate-700 underline underline-offset-4 hover:text-slate-900">
                {contactEmail}
              </a>
            ) : (
              <p className="mt-3 text-slate-700">No contact email added yet.</p>
            )}
          </section>

          <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Campaigns Completed</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{campaignsCompleted}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Live Campaigns</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{liveCampaigns}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Invites Received</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{invitesReceived}</p>
            </div>
          </section>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/brand/new-campaign?creatorId=${creator.id}`}
              style={{
                backgroundColor: "#0f172a",
                color: "#ffffff",
                padding: "12px 24px",
                borderRadius: "12px",
                fontSize: "0.875rem",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "160px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                textDecoration: "none",
              }}
            >
              Invite Creator
            </Link>

            {profileUrl && (
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-w-[160px] items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100"
              >
                View Social Profile
              </a>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}