"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import ProtectedRoute from "../../../components/ProtectedRoute";
import { auth, db } from "../../../lib/firebase";
import { createCampaign, getCreatorById } from "../../../lib/campaigns";

type Creator = {
  id: string;
  handle?: string;
  bio?: string;
  contactEmail?: string;
};

export default function NewCampaignPage() {
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
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const deliveryRangeLabel = useMemo(() => {
    if (!deliveryStartDate || !deliveryEndDate) return "";
    return `${deliveryStartDate} → ${deliveryEndDate}`;
  }, [deliveryStartDate, deliveryEndDate]);

  useEffect(() => {
    async function loadData() {
      try {
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

        const user = auth.currentUser;
        if (user) {
          const brandSnap = await getDoc(doc(db, "brands", user.uid));

          if (brandSnap.exists()) {
            const brandData = brandSnap.data();
            setBrandName(brandData.brandName || "");
            setContactEmail(brandData.contactEmail || user.email || "");
          } else {
            setContactEmail(user.email || "");
          }
        }
      } catch (err: any) {
        setError(err.message || "Failed to load campaign form.");
      } finally {
        setLoadingCreator(false);
      }
    }

    loadData();
  }, [creatorId]);

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

      if (!creator) {
        throw new Error("Creator not loaded.");
      }

      await createCampaign({
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

      router.push("/brand/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to create campaign.");
    } finally {
      setSubmitting(false);
    }
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

          <Link
            href="/brand/creators"
            className="rounded-lg border px-4 py-2"
          >
            Back to Creators
          </Link>
        </div>

        {loadingCreator && <p className="mt-6">Loading creator...</p>}
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
              <input
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Brand name"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                required
              />

              <input
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Contact email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
              />

              <input
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Product name"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
              />

              <input
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Campaign title"
                value={campaignTitle}
                onChange={(e) => setCampaignTitle(e.target.value)}
                required
              />

              <textarea
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Campaign brief"
                value={campaignBrief}
                onChange={(e) => setCampaignBrief(e.target.value)}
                required
              />

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Delivery start date
                  </label>
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    type="date"
                    value={deliveryStartDate}
                    onChange={(e) => setDeliveryStartDate(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Delivery end date
                  </label>
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    type="date"
                    value={deliveryEndDate}
                    onChange={(e) => setDeliveryEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {deliveryRangeLabel && (
                <p className="text-sm text-gray-600">
                  Delivery timeline: {deliveryRangeLabel}
                </p>
              )}

              <input
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Agreed price"
                type="number"
                min="0"
                step="0.01"
                value={agreedPrice}
                onChange={(e) => setAgreedPrice(e.target.value)}
                required
              />

              {message && <p className="text-sm text-green-600">{message}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-black text-white px-4 py-2"
              >
                {submitting ? "Sending invite..." : "Send campaign invite"}
              </button>
            </form>
          </>
        )}
      </main>
    </ProtectedRoute>
  );
}