"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import ProtectedRoute from "../../../components/ProtectedRoute";
import { auth, db } from "../../../lib/firebase";
import { createCampaign, getCreatorById } from "../../../lib/campaigns";

type Creator = {
  id: string;
  handle?: string;
  bio?: string;
  contactEmail?: string;
  email?: string;
};

function isSubscribed(status?: string) {
  return status === "trialing" || status === "active";
}

function NewCampaignPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const creatorId = searchParams.get("creatorId") || "";

  const [creator, setCreator] = useState<Creator | null>(null);
  const [brandName, setBrandName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [productName, setProductName] = useState("");
  const [campaignTitle, setCampaignTitle] = useState("");
  const [campaignBrief, setCampaignBrief] = useState("");
  const [deliveryStartDate, setDeliveryStartDate] = useState("");
  const [deliveryEndDate, setDeliveryEndDate] = useState("");
  const [agreedPrice, setAgreedPrice] = useState("");

  const [loadingCreator, setLoadingCreator] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paywallLoading, setPaywallLoading] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState("none");
  const [brandUid, setBrandUid] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const deliveryRangeLabel = useMemo(() => {
    if (!deliveryStartDate || !deliveryEndDate) return "";
    return `${deliveryStartDate} → ${deliveryEndDate}`;
  }, [deliveryStartDate, deliveryEndDate]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          setLoadingCreator(false);
          return;
        }

        setBrandUid(user.uid);

        const brandSnap = await getDoc(doc(db, "brands", user.uid));
        const brandData = brandSnap.exists() ? brandSnap.data() : null;

        const status = String(brandData?.subscriptionStatus || "none");
        setSubscriptionStatus(status);
        setBrandName(String(brandData?.brandName || user.displayName || ""));
        setContactEmail(String(brandData?.contactEmail || user.email || ""));

        if (!isSubscribed(status)) {
          setLoadingCreator(false);
          return;
        }

        if (!creatorId) {
          setError("Missing creatorId in URL.");
          setLoadingCreator(false);
          return;
        }

        const creatorData = await getCreatorById(creatorId);

        if (!creatorData) {
          setError("Creator not found.");
          setLoadingCreator(false);
          return;
        }

        setCreator(creatorData as Creator);
      } catch (err: any) {
        setError(err.message || "Failed to load campaign form.");
      } finally {
        setLoadingCreator(false);
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const user = auth.currentUser;

      if (!user) {
        throw new Error("You must be logged in.");
      }

      if (!isSubscribed(subscriptionStatus)) {
        throw new Error("Start your 14-day free trial to invite creators.");
      }

      if (!creator) {
        throw new Error("Creator not loaded.");
      }

      const campaignId = await createCampaign({
        brandId: user.uid,
        creatorId: creator.id,
        brandName,
        creatorHandle: creator.handle || "",
        contactEmail,
        productName,
        campaignTitle,
        campaignBrief,
        deliveryStartDate,
        deliveryEndDate,
        agreedPrice: Number(agreedPrice),
      });

      if (!campaignId || typeof campaignId !== "string") {
        throw new Error(
          "Campaign was created, but campaignId was not returned. Please update createCampaign() to return docRef.id."
        );
      }

      const emailRes = await fetch("/api/send-campaign-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaignId,
        }),
      });

      const emailData = await emailRes.json().catch(() => null);

      if (!emailRes.ok) {
        console.error("Invite email failed:", emailData);
        throw new Error(
          emailData?.error || "Campaign created, but invite email failed."
        );
      }

      setMessage("Campaign invite sent successfully.");
      router.push("/brand/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to create campaign.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingCreator) {
    return (
      <ProtectedRoute allowedRole="brand">
        <main className="min-h-screen p-6 max-w-3xl mx-auto">
          <p>Loading...</p>
        </main>
      </ProtectedRoute>
    );
  }

  if (!isSubscribed(subscriptionStatus)) {
    return (
      <ProtectedRoute allowedRole="brand">
        <main className="min-h-screen bg-white text-slate-900">
          <div className="mx-auto max-w-3xl px-6 py-16 text-center">
            <p className="text-sm font-bold uppercase tracking-wide text-pink-600">
              Activate Your Campaign
            </p>

            <h1 className="mt-3 text-4xl font-black">
              Start your 14-day free trial to invite creators.
            </h1>

            <p className="mt-4 text-lg text-slate-600">
              Your first IRL campaign preview is free. Creator invitations and
              campaign scaling require an active trial.
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
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRole="brand">
      <main className="min-h-screen p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Invite Creator</h1>
            <p className="mt-2 text-gray-600">
              Create a campaign invite for a selected creator.
            </p>
          </div>

          <Link href="/brand/creators" className="rounded-lg border px-4 py-2">
            Back to Creators
          </Link>
        </div>

        {error && <p className="mt-6 text-red-600">{error}</p>}

        {creator && (
          <>
            <div className="mt-8 rounded-2xl border p-5">
              <h2 className="text-xl font-semibold">
                {creator.handle || "Unnamed Creator"}
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                {creator.bio || "No bio added yet."}
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-6 space-y-4 rounded-2xl border p-6"
            >
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Brand name" value={brandName} onChange={(e) => setBrandName(e.target.value)} required />
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Contact email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required />
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Product name" value={productName} onChange={(e) => setProductName(e.target.value)} required />
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Campaign title" value={campaignTitle} onChange={(e) => setCampaignTitle(e.target.value)} required />
              <textarea className="w-full border rounded-lg px-3 py-2" placeholder="Campaign brief" value={campaignBrief} onChange={(e) => setCampaignBrief(e.target.value)} required />

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Delivery start date</label>
                  <input className="w-full border rounded-lg px-3 py-2" type="date" value={deliveryStartDate} onChange={(e) => setDeliveryStartDate(e.target.value)} required />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Delivery end date</label>
                  <input className="w-full border rounded-lg px-3 py-2" type="date" value={deliveryEndDate} onChange={(e) => setDeliveryEndDate(e.target.value)} required />
                </div>
              </div>

              {deliveryRangeLabel && (
                <p className="text-sm text-gray-600">
                  Delivery timeline: {deliveryRangeLabel}
                </p>
              )}

              <input className="w-full border rounded-lg px-3 py-2" placeholder="Agreed price" type="number" min="0" step="0.01" value={agreedPrice} onChange={(e) => setAgreedPrice(e.target.value)} required />

              {message && <p className="text-sm text-green-600">{message}</p>}

              <button type="submit" disabled={submitting} className="rounded-lg bg-black text-white px-4 py-2">
                {submitting ? "Sending invite..." : "Send campaign invite"}
              </button>
            </form>
          </>
        )}
      </main>
    </ProtectedRoute>
  );
}

export default function NewCampaignPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <NewCampaignPageContent />
    </Suspense>
  );
}