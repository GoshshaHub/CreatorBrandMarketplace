"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BrandLaunchOnboardingPage() {
  const router = useRouter();

  const [brandName, setBrandName] = useState("");
  const [campaignTitle, setCampaignTitle] = useState("");
  const [productName, setProductName] = useState("");
  const [campaignContentUrl, setCampaignContentUrl] = useState("");
  const [campaignBrief, setCampaignBrief] = useState("");
  const [targetImage, setTargetImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLaunch(e: React.FormEvent) {
    e.preventDefault();

    if (!brandName || !campaignTitle || !productName || !campaignContentUrl || !targetImage) {
      alert("Please complete all required fields.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("brandName", brandName);
      formData.append("campaignTitle", campaignTitle);
      formData.append("productName", productName);
      formData.append("campaignContentUrl", campaignContentUrl);
      formData.append("campaignBrief", campaignBrief);
      formData.append("targetImage", targetImage);

      const res = await fetch("/api/brand/launch-first-campaign", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to launch campaign.");
      }

      router.push(`/brand/campaign/${data.campaignId}`);
    } catch (err: any) {
      alert(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-pink-50 to-blue-50 px-6 py-10">
      <div className="mx-auto max-w-3xl rounded-3xl bg-white/90 p-8 shadow-xl border border-pink-100">
        <p className="text-sm font-semibold uppercase tracking-wide text-pink-600">
          Free IRL Campaign Launch
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight text-gray-950">
          Turn your existing campaign into an IRL shelf experience.
        </h1>

        <p className="mt-4 text-gray-600">
          Upload your product image, paste your existing campaign content link,
          and Goshsha will turn it into a scan-to-experience IRL campaign.
        </p>

        <form onSubmit={handleLaunch} className="mt-8 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-800">
              Brand Name *
            </label>
            <input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="mt-2 w-full rounded-xl border px-4 py-3"
              placeholder="Example: Glow Beauty"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800">
              Campaign Title *
            </label>
            <input
              value={campaignTitle}
              onChange={(e) => setCampaignTitle(e.target.value)}
              className="mt-2 w-full rounded-xl border px-4 py-3"
              placeholder="Example: Summer Glow Launch"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800">
              Product Name *
            </label>
            <input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="mt-2 w-full rounded-xl border px-4 py-3"
              placeholder="Example: Vitamin C Brightening Serum"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800">
              Existing Campaign Content URL *
            </label>
            <input
              value={campaignContentUrl}
              onChange={(e) => setCampaignContentUrl(e.target.value)}
              className="mt-2 w-full rounded-xl border px-4 py-3"
              placeholder="Paste TikTok, Instagram Reel, YouTube Shorts, or campaign URL"
            />
            <p className="mt-2 text-sm text-gray-500">
              This is the content shoppers will see when they scan your product.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800">
              Product / Packaging Image for AR Target *
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setTargetImage(e.target.files?.[0] || null)}
              className="mt-2 w-full rounded-xl border px-4 py-3"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800">
              Campaign Brief
            </label>
            <textarea
              value={campaignBrief}
              onChange={(e) => setCampaignBrief(e.target.value)}
              className="mt-2 min-h-32 w-full rounded-xl border px-4 py-3"
              placeholder="Tell creators what this campaign is about..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gray-950 px-6 py-4 text-lg font-bold text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {loading ? "Launching..." : "Launch My Free IRL Campaign"}
          </button>
        </form>
      </div>
    </main>
  );
}