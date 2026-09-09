"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ProtectedRoute from "../../../../../components/ProtectedRoute";
import { Campaign, getCampaignById } from "../../../../../lib/campaigns";
import { auth } from "../../../../../lib/firebase";

export default function BrandCampaignLivePage() {
  const params = useParams<{ id: string }>();
  const campaignId = params?.id || "";

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [verifiedScanReady, setVerifiedScanReady] = useState(false);
  const [publicationStatus, setPublicationStatus] = useState("loading");
  const [targetImageUrl, setTargetImageUrl] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [rightsBasis, setRightsBasis] = useState<"brand_owned" | "brand_licensed">("brand_owned");
  const [contentRightsConfirmed, setContentRightsConfirmed] = useState(false);
  const [audioRightsConfirmed, setAudioRightsConfirmed] = useState(false);
  const [appearanceRightsConfirmed, setAppearanceRightsConfirmed] = useState(false);
  const [identityRepairRequired, setIdentityRepairRequired] = useState(false);
  const [repairingIdentity, setRepairingIdentity] = useState(false);
  const [ocrCorrectionRequired, setOcrCorrectionRequired] = useState(false);
  const [correctedOcrText, setCorrectedOcrText] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await getCampaignById(campaignId);
        setCampaign(data);
        await auth.authStateReady();
        const user = auth.currentUser;
        if (!user) throw new Error("Please log in again.");
        const token = await user.getIdToken();
        const response = await fetch(
          `/api/brand/launch-first-campaign?campaignId=${encodeURIComponent(campaignId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const status = await response.json();
        if (!response.ok) throw new Error(status.error || "Unable to verify publication.");
        setVerifiedScanReady(status.scanReady === true);
        setPublicationStatus(String(status.status || "preparing"));
        setIdentityRepairRequired(status.productIdentityRepairRequired === true);
      } catch (err: any) {
        setError(err?.message || "Failed to load campaign.");
      } finally {
        setLoading(false);
      }
    }

    if (campaignId) load();
  }, [campaignId]);

  useEffect(() => {
    let objectUrl = "";
    async function loadTarget() {
      if (!campaign || loading) return;
      try {
        await auth.authStateReady();
        const user = auth.currentUser;
        if (!user) return;
        const token = await user.getIdToken();
        const response = await fetch(`/api/brand/target-image/${campaignId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        objectUrl = URL.createObjectURL(await response.blob());
        setTargetImageUrl(objectUrl);
      } catch {
        setTargetImageUrl("");
      }
    }
    loadTarget();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [campaign, campaignId, loading]);

  async function retryPublication() {
    if (!contentRightsConfirmed || !audioRightsConfirmed || !appearanceRightsConfirmed) return;
    setRetrying(true);
    setError("");
    setPublicationStatus("publishing");
    try {
      await auth.authStateReady();
      const user = auth.currentUser;
      if (!user) throw new Error("Please log in again.");
      const token = await user.getIdToken(true);
      const response = await fetch("/api/brand/launch-first-campaign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "retry",
          campaignId,
          rightsBasis,
          contentRightsConfirmed,
          audioRightsConfirmed,
          appearanceRightsConfirmed,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to retry publication.");
      setVerifiedScanReady(result.scanReady === true);
      setPublicationStatus(String(result.status || "active"));
      const refreshed = await getCampaignById(campaignId);
      setCampaign(refreshed);
    } catch (err: any) {
      setError(err?.message || "Unable to retry publication.");
      setPublicationStatus("recovery_required");
    } finally {
      setRetrying(false);
    }
  }

  async function repairProductIdentity() {
    if (ocrCorrectionRequired && !correctedOcrText.trim()) return;
    setRepairingIdentity(true);
    setError("");
    try {
      await auth.authStateReady();
      const user = auth.currentUser;
      if (!user) throw new Error("Please log in again.");
      const token = await user.getIdToken(true);
      const response = await fetch("/api/brand/launch-first-campaign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "repair_product_identity",
          campaignId,
          correctedOcrText: correctedOcrText.trim(),
          ocrCorrectionConfirmed: ocrCorrectionRequired,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.code === "OCR_CORRECTION_REQUIRED") {
          setCorrectedOcrText(String(result.extractedText || ""));
          setOcrCorrectionRequired(true);
        }
        throw new Error(result.error || "Unable to repair product recognition.");
      }
      setIdentityRepairRequired(false);
      setOcrCorrectionRequired(false);
      setVerifiedScanReady(result.scanReady === true);
    } catch (err: any) {
      setError(err?.message || "Unable to repair product recognition.");
    } finally {
      setRepairingIdentity(false);
    }
  }

  const isArLive = useMemo(() => verifiedScanReady, [verifiedScanReady]);
  const needsAssistance = publicationStatus === "publish_failed" ||
    publicationStatus === "recovery_required";

  const eyebrow = isArLive
    ? "Your IRL Campaign Is Scan-Ready"
    : needsAssistance
    ? "Your IRL Campaign Needs Assistance"
    : "Your IRL Campaign Is Being Prepared";

  const headline = isArLive
    ? "Your product is now scan-ready in Goshsha."
    : needsAssistance
    ? "We saved your campaign and are resolving a publication issue."
    : "Your product’s digital experience is being published.";

  const body = isArLive
    ? "Shoppers can now scan your product in Goshsha and unlock your campaign content."
    : needsAssistance
    ? "Your campaign and uploads are safe. The Goshsha team has been notified and can retry publication without creating a duplicate activation."
    : "We received your product image and original video. Scan readiness will appear only after canonical publication is verified.";

  const previewTitle = isArLive ? "Scan-Ready Target" : "Preview Target";

  const previewDescription = isArLive
    ? "This is the product image shoppers can scan in Goshsha to unlock your campaign."
    : "This is the product image our team is using to prepare your scan-ready AR activation.";

  const statusTitle = isArLive
    ? "Your scan-ready AR campaign is live."
    : "What happens next?";

  const statusBody = isArLive
    ? "Try scanning your product in the Goshsha app to see the campaign experience in action."
    : needsAssistance
    ? "No action is required from you right now. Your saved campaign is available for Admin recovery."
    : "Goshsha is resolving the product, creating the Retail Asset, and updating the scan playlist.";

  return (
    <ProtectedRoute allowedRole="brand">
      <main className="min-h-screen bg-gradient-to-br from-white via-pink-50 to-blue-50 px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-5xl">
          {loading && <p>Checking your campaign&apos;s publication status…</p>}
          {error && <p className="text-red-600">{error}</p>}

          {!loading && campaign && (
            <div className="grid gap-8 md:grid-cols-[1fr_0.85fr]">
              <section className="rounded-3xl border border-pink-100 bg-white/90 p-8 shadow-xl">
                <p className="text-sm font-bold uppercase tracking-wide text-pink-600">
                  {eyebrow}
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight">
                  {headline}
                </h1>

                <p className="mt-4 text-lg text-slate-600">{body}</p>

                {isArLive && identityRepairRequired && (
                  <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5">
                    <h2 className="font-bold">Product recognition update available</h2>
                    <p className="mt-2 text-sm text-slate-700">
                      Goshsha can read this existing target image and connect it to the current product-identity system without restarting the activation.
                    </p>
                    {ocrCorrectionRequired && (
                      <label className="mt-4 block text-sm font-semibold">
                        Review product packaging text
                        <textarea
                          value={correctedOcrText}
                          onChange={(event) => setCorrectedOcrText(event.target.value)}
                          className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={repairProductIdentity}
                      disabled={repairingIdentity || (ocrCorrectionRequired && !correctedOcrText.trim())}
                      className="mt-4 rounded-xl bg-slate-950 px-5 py-3 font-bold text-white disabled:opacity-60"
                    >
                      {repairingIdentity ? "Reading product packaging..." : "Update Product Recognition"}
                    </button>
                  </div>
                )}

                <div className="mt-8 rounded-2xl bg-slate-950 p-5 text-white">
                  <p className="text-sm uppercase tracking-wide text-pink-300">
                    Campaign
                  </p>

                  <h2 className="mt-2 text-2xl font-bold">
                    {campaign.campaignTitle || "Untitled Campaign"}
                  </h2>

                  <p className="mt-2 text-slate-300">
                    Product: {campaign.productName || "—"}
                  </p>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  {(campaign as any).campaignContentUrl && (
                    <a
                      href={(campaign as any).campaignContentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl bg-pink-600 px-5 py-3 font-bold text-white hover:bg-pink-700"
                    >
                      View Campaign Content
                    </a>
                  )}

                  {isArLive ? (
                  <Link href="/brand/creators" className="inline-block no-underline">
                    <button
                      type="button"
                      style={{
                        backgroundColor: "#0f172a",
                        color: "#ffffff",
                        padding: "12px 20px",
                        borderRadius: "12px",
                        fontWeight: 700,
                        border: "none",
                        cursor: "pointer",
                        opacity: 1,
                        WebkitTextFillColor: "#ffffff",
                      }}
                    >
                      Invite Creators To Scale Campaign
                    </button>
                  </Link>
                  ) : (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#0f172a",
                        color: "#ffffff",
                        padding: "12px 20px",
                        borderRadius: "12px",
                        fontWeight: 700,
                        opacity: 1,
                        WebkitTextFillColor: "#ffffff",
                      }}
                    >
                      {retrying || publicationStatus === "publishing"
                        ? "Publishing AR"
                        : "Publication Paused"}
                    </span>
                  )}

                  <Link
                    href="/brand/dashboard"
                    className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-950 hover:bg-slate-50"
                  >
                    Go to Dashboard
                  </Link>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
                <h3 className="text-xl font-bold">{previewTitle}</h3>

                <p className="mt-2 text-sm text-slate-600">
                  {previewDescription}
                </p>

                <div className="mt-6 overflow-hidden rounded-2xl border bg-slate-100">
                  {targetImageUrl ? (
                    <img
                      src={targetImageUrl}
                      alt="AR target product"
                      className="h-96 w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-96 items-center justify-center text-slate-500">
                      No AR target image found.
                    </div>
                  )}
                </div>

                <div className="mt-6 rounded-2xl bg-pink-50 p-5">
                  <p className="font-bold text-slate-950">{statusTitle}</p>

                  <p className="mt-2 text-sm text-slate-600">{statusBody}</p>
                </div>

                {needsAssistance && (
                  <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                    <h4 className="font-bold text-slate-950">Resume the preserved publication</h4>
                    <p className="mt-2 text-sm text-slate-700">
                      Your campaign, video, and product image were safely preserved. Reaffirm the
                      content rights below before retrying the same activation.
                    </p>
                    <label className="mt-4 block text-sm font-semibold text-slate-800">
                      Content rights basis
                      <select
                        value={rightsBasis}
                        onChange={(event) => setRightsBasis(event.target.value as "brand_owned" | "brand_licensed")}
                        className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
                      >
                        <option value="brand_owned">Brand-owned content</option>
                        <option value="brand_licensed">Content licensed to the Brand</option>
                      </select>
                    </label>
                    <label className="mt-4 flex gap-3 text-sm text-slate-700">
                      <input type="checkbox" checked={contentRightsConfirmed}
                        onChange={(event) => setContentRightsConfirmed(event.target.checked)} />
                      <span>I confirm the Brand owns or has sufficient rights to use and publish this content.</span>
                    </label>
                    <label className="mt-3 flex gap-3 text-sm text-slate-700">
                      <input type="checkbox" checked={audioRightsConfirmed}
                        onChange={(event) => setAudioRightsConfirmed(event.target.checked)} />
                      <span>I confirm the Brand has sufficient rights to the audio in this video.</span>
                    </label>
                    <label className="mt-3 flex gap-3 text-sm text-slate-700">
                      <input type="checkbox" checked={appearanceRightsConfirmed}
                        onChange={(event) => setAppearanceRightsConfirmed(event.target.checked)} />
                      <span>I confirm appearance rights for every person shown in this video.</span>
                    </label>
                    <button
                      type="button"
                      onClick={retryPublication}
                      disabled={retrying || !contentRightsConfirmed || !audioRightsConfirmed || !appearanceRightsConfirmed}
                      className="mt-5 w-full rounded-xl bg-slate-950 px-5 py-3 font-bold text-white disabled:opacity-50"
                    >
                      {retrying ? "Retrying Publication…" : "Retry Publication"}
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}
