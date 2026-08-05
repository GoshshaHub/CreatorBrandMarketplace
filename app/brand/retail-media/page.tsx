"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";

import ProtectedRoute from "../../../components/ProtectedRoute";

import {
  auth,
  db,
} from "../../../lib/firebase";

type CampaignOption = {
  id: string;

  campaignTitle: string;
  productName: string;
  brandName: string;
  creatorHandle: string;

  brandId: string;
  creatorId: string;

  status: string;
  brandApprovalStatus: string;
  payoutStatus: string;

  retailAssetId: string | null;
  retailMediaStatus: string | null;
  productCollectionId: string | null;
  arEntryId: string | null;
  publishedArEntryId: string | null;
};

type ProductResolution = {
  collectionId: string;

  canonicalName: string;
  canonicalSlug: string;

  aliasId: string;

  rawOcr: string;
  normalizedOcr: string;

  tokens: string[];

  resolution:
    | "exact_alias"
    | "existing_collection"
    | "created_collection"
    | "proposed_collection";

  collectionExisted: boolean;
  aliasExisted: boolean;

  matcherVersion: string;
};

type DraftResult = {
  retailAssetId: string;

  campaignId: string;
  creatorId: string;
  brandId: string;

  collectionId: string;
  entryId: string;

  status: "draft";

  reusedExistingDraft: boolean;

  productResolution: ProductResolution;
};

type ExistingRetailAsset = {
  retailAssetId: string;

  campaignId: string | null;
  creatorId: string | null;
  brandId: string | null;

  collectionId: string;
  entryId: string;

  status: string;

  recognition?: {
    canonicalName?: string | null;
    canonicalSlug?: string | null;
    rawOcr?: string | null;
    normalizedOcr?: string | null;
    tokens?: string[];
  };

  targetImage?: {
    url?: string | null;
    storagePath?: string | null;
  };

  media?: {
    url?: string | null;
    contentType?: string | null;
  };

  license?: {
    status?: string;
    startsAt?: unknown;
    expiresAt?: unknown;
    durationDays?: number | null;
  };

  activation?: {
    status?: string;
    startsAt?: unknown;
    endsAt?: unknown;
  };

  distribution?: {
    status?: string;
    publishedToPlaylist?: boolean;
    masterPlaylistId?: string | null;
  };
};

type PublicationResult = {
  retailAssetId: string;

  campaignId?: string | null;
  creatorId?: string | null;
  brandId?: string | null;

  collectionId: string;
  entryId: string;

  activationStartsAt: string;
  activationEndsAt: string;

  licenseStartsAt: string;
  licenseExpiresAt: string;

  masterPlaylistPath: string;
  playlistItemCount: number;

  alreadyPublished: boolean;
  scanReady: boolean;
  status: string;
};

function cleanText(
  value: unknown,
  fallback = ""
): string {
  if (
    typeof value !== "string"
  ) {
    return fallback;
  }

  const cleaned =
    value.trim();

  return cleaned || fallback;
}

function formatDate(
  value?: string | null
): string {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleString();
}

function getTimestampDate(
  value: unknown
): string | null {
  if (!value) {
    return null;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (
      value as {
        toDate?: unknown;
      }
    ).toDate === "function"
  ) {
    const date =
      (
        value as {
          toDate: () => Date;
        }
      ).toDate();

    return date.toISOString();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value
  ) {
    const seconds =
      Number(
        (
          value as {
            seconds?: unknown;
          }
        ).seconds
      );

    if (
      Number.isFinite(seconds)
    ) {
      return new Date(
        seconds * 1000
      ).toISOString();
    }
  }

  if (
    typeof value === "string"
  ) {
    return value;
  }

  return null;
}

function campaignIsEligible(
  campaign: CampaignOption
): boolean {
  return (
    campaign.brandApprovalStatus ===
      "approved" &&
    Boolean(
      campaign.creatorId
    )
  );
}

function getRetailMediaStatusLabel(
  campaign: CampaignOption
): string {
  if (
    campaign.retailMediaStatus ===
      "active" ||
    campaign.publishedArEntryId
  ) {
    return "Live";
  }

  if (
    campaign.retailMediaStatus ===
      "publishing"
  ) {
    return "Publishing";
  }

  if (
    campaign.retailMediaStatus ===
      "publish_failed"
  ) {
    return "Needs attention";
  }

  if (
    campaign.retailAssetId
  ) {
    return "Draft";
  }

  return "Not created";
}

export default function BrandRetailMediaPage() {
  const [
    currentUser,
    setCurrentUser,
  ] =
    useState<User | null>(
      null
    );

  const [
    campaigns,
    setCampaigns,
  ] =
    useState<
      CampaignOption[]
    >([]);

  const [
    selectedCampaignId,
    setSelectedCampaignId,
  ] =
    useState("");

  const [
    targetImage,
    setTargetImage,
  ] =
    useState<File | null>(
      null
    );

  const [
    previewUrl,
    setPreviewUrl,
  ] =
    useState("");

  const [
    rawOcr,
    setRawOcr,
  ] =
    useState("");

  const [
    loadingCampaigns,
    setLoadingCampaigns,
  ] =
    useState(true);

  const [
    loadingExistingAsset,
    setLoadingExistingAsset,
  ] =
    useState(false);

  const [
    creatingDraft,
    setCreatingDraft,
  ] =
    useState(false);

  const [
    publishing,
    setPublishing,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    draft,
    setDraft,
  ] =
    useState<DraftResult | null>(
      null
    );

  const [
    existingAsset,
    setExistingAsset,
  ] =
    useState<ExistingRetailAsset | null>(
      null
    );

  const [
    publication,
    setPublication,
  ] =
    useState<PublicationResult | null>(
      null
    );

  const selectedCampaign =
    useMemo(() => {
      return (
        campaigns.find(
          (campaign) =>
            campaign.id ===
            selectedCampaignId
        ) || null
      );
    }, [
      campaigns,
      selectedCampaignId,
    ]);

  const liveCampaigns =
    useMemo(
      () =>
        campaigns.filter(
          (campaign) =>
            campaign.retailMediaStatus ===
              "active" ||
            Boolean(
              campaign.publishedArEntryId
            )
        ),
      [campaigns]
    );

  const draftCampaigns =
    useMemo(
      () =>
        campaigns.filter(
          (campaign) =>
            Boolean(
              campaign.retailAssetId
            ) &&
            campaign.retailMediaStatus !==
              "active" &&
            !campaign.publishedArEntryId
        ),
      [campaigns]
    );

  const availableCampaigns =
    useMemo(
      () =>
        campaigns.filter(
          (campaign) =>
            !campaign.retailAssetId
        ),
      [campaigns]
    );

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        (user) => {
          setCurrentUser(user);

          if (!user) {
            setCampaigns([]);
            setLoadingCampaigns(
              false
            );

            return;
          }

          loadApprovedCampaigns(
            user
          );
        }
      );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!targetImage) {
      setPreviewUrl("");

      return;
    }

    const objectUrl =
      URL.createObjectURL(
        targetImage
      );

    setPreviewUrl(
      objectUrl
    );

    return () => {
      URL.revokeObjectURL(
        objectUrl
      );
    };
  }, [targetImage]);

  useEffect(() => {
    if (
      !selectedCampaign
    ) {
      setExistingAsset(
        null
      );

      return;
    }

    if (
      selectedCampaign
        .retailAssetId
    ) {
      loadExistingRetailAsset(
        selectedCampaign
          .retailAssetId
      );
    } else {
      setExistingAsset(
        null
      );
    }
  }, [
    selectedCampaignId,
    selectedCampaign
      ?.retailAssetId,
  ]);

  async function loadApprovedCampaigns(
    user: User
  ) {
    setLoadingCampaigns(
      true
    );

    setError("");

    try {
      const campaignsQuery =
        query(
          collection(
            db,
            "campaigns"
          ),
          where(
            "brandId",
            "==",
            user.uid
          )
        );

      const snapshot =
        await getDocs(
          campaignsQuery
        );

      const loadedCampaigns =
        snapshot.docs
          .map((document) => {
            const data =
              document.data() as Record<
                string,
                unknown
              >;

            return {
              id:
                document.id,

              campaignTitle:
                cleanText(
                  data.campaignTitle,
                  "Untitled Campaign"
                ),

              productName:
                cleanText(
                  data.productName,
                  "Product not listed"
                ),

              brandName:
                cleanText(
                  data.brandName,
                  "Brand"
                ),

              creatorHandle:
                cleanText(
                  data.creatorHandle,
                  "Creator"
                ),

              brandId:
                cleanText(
                  data.brandId
                ),

              creatorId:
                cleanText(
                  data.creatorId
                ),

              status:
                cleanText(
                  data.status
                ),

              brandApprovalStatus:
                cleanText(
                  data.brandApprovalStatus
                ),

              payoutStatus:
                cleanText(
                  data.payoutStatus
                ),

              retailAssetId:
                cleanText(
                  data.retailAssetId
                ) || null,

              retailMediaStatus:
                cleanText(
                  data.retailMediaStatus
                ) || null,

              productCollectionId:
                cleanText(
                  data.productCollectionId
                ) || null,

              arEntryId:
                cleanText(
                  data.arEntryId
                ) || null,

              publishedArEntryId:
                cleanText(
                  data.publishedArEntryId
                ) || null,
            } satisfies CampaignOption;
          })
          .filter(
            campaignIsEligible
          )
          .sort(
            (
              first,
              second
            ) =>
              first.campaignTitle.localeCompare(
                second.campaignTitle
              )
          );

      setCampaigns(
        loadedCampaigns
      );

      if (
        loadedCampaigns.length >
          0
      ) {
        const currentStillExists =
          loadedCampaigns.some(
            (campaign) =>
              campaign.id ===
              selectedCampaignId
          );

        if (
          !currentStillExists
        ) {
          setSelectedCampaignId(
            loadedCampaigns[0].id
          );
        }
      } else {
        setSelectedCampaignId(
          ""
        );
      }
    } catch (err: any) {
      console.error(
        "Load Retail Media campaigns error:",
        err
      );

      setError(
        err?.message ||
          "Failed to load approved campaigns."
      );
    } finally {
      setLoadingCampaigns(
        false
      );
    }
  }

  async function loadExistingRetailAsset(
    retailAssetId: string
  ) {
    setLoadingExistingAsset(
      true
    );

    try {
      const assetSnapshot =
        await getDoc(
          doc(
            db,
            "retailAssets",
            retailAssetId
          )
        );

      if (
        !assetSnapshot.exists()
      ) {
        setExistingAsset(
          null
        );

        return;
      }

      const data =
        assetSnapshot.data() as Record<
          string,
          any
        >;

      const loadedAsset: ExistingRetailAsset =
        {
          retailAssetId:
            assetSnapshot.id,

          campaignId:
            cleanText(
              data.campaignId
            ) || null,

          creatorId:
            cleanText(
              data.creatorId
            ) || null,

          brandId:
            cleanText(
              data.brandId
            ) || null,

          collectionId:
            cleanText(
              data.collectionId
            ),

          entryId:
            cleanText(
              data.entryId
            ),

          status:
            cleanText(
              data.status,
              "draft"
            ),

          recognition:
            data.recognition ||
            undefined,

          targetImage:
            data.targetImage ||
            undefined,

          media:
            data.media ||
            undefined,

          license:
            data.license ||
            undefined,

          activation:
            data.activation ||
            undefined,

          distribution:
            data.distribution ||
            undefined,
        };

      setExistingAsset(
        loadedAsset
      );

      if (
        !rawOcr &&
        loadedAsset.recognition
          ?.rawOcr
      ) {
        setRawOcr(
          loadedAsset.recognition
            .rawOcr
        );
      }
    } catch (err) {
      console.error(
        "Load existing Retail Asset error:",
        err
      );

      setExistingAsset(
        null
      );
    } finally {
      setLoadingExistingAsset(
        false
      );
    }
  }

  function resetPublisherState() {
    setTargetImage(
      null
    );

    setRawOcr("");

    setDraft(
      null
    );

    setExistingAsset(
      null
    );

    setPublication(
      null
    );

    setError("");

    setMessage("");
  }

  function handleCampaignChange(
    campaignId: string
  ) {
    setSelectedCampaignId(
      campaignId
    );

    resetPublisherState();
  }

  function handleTargetImageChange(
    file: File | null
  ) {
    setTargetImage(
      file
    );

    setDraft(
      null
    );

    setPublication(
      null
    );

    setError("");

    setMessage("");
  }

  async function handleCreateDraft() {
    setError("");
    setMessage("");

    if (!currentUser) {
      setError(
        "Please log in again."
      );

      return;
    }

    if (!selectedCampaign) {
      setError(
        "Select an approved campaign."
      );

      return;
    }

    if (!targetImage) {
      setError(
        "Upload the exact product target image."
      );

      return;
    }

    const cleanedOcr =
      rawOcr.trim();

    if (
      cleanedOcr.length < 6 ||
      cleanedOcr
        .split(/\s+/)
        .filter(Boolean)
        .length < 2
    ) {
      setError(
        "Enter at least two meaningful words visible on the product packaging."
      );

      return;
    }

    setCreatingDraft(
      true
    );

    try {
      const idToken =
        await currentUser.getIdToken(
          true
        );

      const formData =
        new FormData();

      formData.append(
        "campaignId",
        selectedCampaign.id
      );

      formData.append(
        "rawOcr",
        cleanedOcr
      );

      formData.append(
        "targetImage",
        targetImage
      );

      formData.append(
        "brandName",
        selectedCampaign.brandName
      );

      formData.append(
        "productName",
        selectedCampaign.productName
      );

      const response =
        await fetch(
          "/api/brand/retail-media/create-draft",
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${idToken}`,
            },

            body:
              formData,
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to create the Retail Media draft."
        );
      }

      const draftResult =
        data.retailAsset as DraftResult;

      setDraft(
        draftResult
      );

      setMessage(
        draftResult.reusedExistingDraft
          ? "The existing Retail Media draft was loaded."
          : "Retail Media draft created. Review the Product Collection before publishing."
      );

      await loadApprovedCampaigns(
        currentUser
      );

      await loadExistingRetailAsset(
        draftResult.retailAssetId
      );
    } catch (err: any) {
      console.error(
        "Create Retail Media draft error:",
        err
      );

      setError(
        err?.message ||
          "Failed to create the Retail Media draft."
      );
    } finally {
      setCreatingDraft(
        false
      );
    }
  }

  async function handlePublish() {
    setError("");
    setMessage("");

    if (!currentUser) {
      setError(
        "Please log in again."
      );

      return;
    }

    const retailAssetId =
      draft?.retailAssetId ||
      existingAsset?.retailAssetId ||
      selectedCampaign
        ?.retailAssetId;

    if (!retailAssetId) {
      setError(
        "Create and review the Retail Media draft first."
      );

      return;
    }

    const collectionId =
      draft?.collectionId ||
      existingAsset?.collectionId ||
      selectedCampaign
        ?.productCollectionId ||
      "Not resolved";

    const entryId =
      draft?.entryId ||
      existingAsset?.entryId ||
      selectedCampaign
        ?.arEntryId ||
      "Not created";

    const confirmed =
      window.confirm(
        [
          "Publish this Retail Media activation?",
          "",
          `Product Collection: ${collectionId}`,
          `AR Entry: ${entryId}`,
          "",
          "Publishing will:",
          "• create the AR Entry consumed by the Goshsha app",
          "• add it to the Product Master playlist",
          "• begin the initial 90-day retail media license",
          "• make the Creator content scan-ready",
          "",
          "Creator payout will not be changed.",
        ].join("\n")
      );

    if (!confirmed) {
      return;
    }

    setPublishing(
      true
    );

    try {
      const idToken =
        await currentUser.getIdToken(
          true
        );

      const response =
        await fetch(
          "/api/brand/retail-media/publish",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${idToken}`,
            },

            body:
              JSON.stringify({
                retailAssetId,

                distributionScope:
                  "global",
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to publish Retail Media."
        );
      }

      const result =
        data.publication as PublicationResult;

      setPublication(
        result
      );

      setMessage(
        data.message ||
          "Retail Media is active and scan-ready in the Goshsha app."
      );

      await loadApprovedCampaigns(
        currentUser
      );

      await loadExistingRetailAsset(
        retailAssetId
      );
    } catch (err: any) {
      console.error(
        "Publish Retail Media error:",
        err
      );

      setError(
        err?.message ||
          "Failed to publish Retail Media."
      );
    } finally {
      setPublishing(
        false
      );
    }
  }

  const resolvedCollectionId =
    draft?.collectionId ||
    existingAsset?.collectionId ||
    selectedCampaign
      ?.productCollectionId ||
    "";

  const resolvedEntryId =
    draft?.entryId ||
    existingAsset?.entryId ||
    selectedCampaign
      ?.arEntryId ||
    "";

  const resolvedCanonicalName =
    draft?.productResolution
      .canonicalName ||
    existingAsset?.recognition
      ?.canonicalName ||
    selectedCampaign
      ?.productName ||
    "";

  const isLive =
    publication?.scanReady ===
      true ||
    existingAsset?.distribution
      ?.publishedToPlaylist ===
      true ||
    selectedCampaign
      ?.retailMediaStatus ===
      "active" ||
    Boolean(
      selectedCampaign
        ?.publishedArEntryId
    );

  const licenseStartsAt =
    publication
      ?.licenseStartsAt ||
    getTimestampDate(
      existingAsset?.license
        ?.startsAt
    );

  const licenseExpiresAt =
    publication
      ?.licenseExpiresAt ||
    getTimestampDate(
      existingAsset?.license
        ?.expiresAt
    );

  return (
    <ProtectedRoute allowedRole="brand">
      <main className="min-h-screen bg-gradient-to-br from-white via-pink-50 to-blue-50 px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-7xl">
          <header className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-pink-600">
                Product 2
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-tight">
                Retail Media Infrastructure
              </h1>

              <p className="mt-3 max-w-3xl text-lg text-slate-600">
                Turn approved Creator content into interactive,
                measurable Retail Media that shoppers can discover
                through the Goshsha app.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/brand/creators"
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold shadow-sm hover:bg-slate-50"
              >
                Creator Network
              </Link>

              <Link
                href="/brand/dashboard"
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold shadow-sm hover:bg-slate-50"
              >
                Back to Dashboard
              </Link>
            </div>
          </header>

          <section className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">
                Ready to Create
              </p>

              <p className="mt-2 text-3xl font-black">
                {availableCampaigns.length}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Approved campaigns without Retail Media
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">
                Draft Assets
              </p>

              <p className="mt-2 text-3xl font-black">
                {draftCampaigns.length}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Created but not scan-ready
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">
                Live Assets
              </p>

              <p className="mt-2 text-3xl font-black">
                {liveCampaigns.length}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Published to Goshsha Master playlists
              </p>
            </div>
          </section>

          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">
              {error}
            </div>
          )}

          {message && (
            <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-700">
              {message}
            </div>
          )}

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-pink-600">
                  Create Retail Media
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  1. Select Approved Creator Content
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Creator payout and Retail Media activation remain
                  independent. Publishing begins the initial
                  90-day license period.
                </p>
              </div>

              {loadingCampaigns ? (
                <p className="mt-6 text-slate-600">
                  Loading approved campaigns...
                </p>
              ) : campaigns.length === 0 ? (
                <div className="mt-6 rounded-2xl bg-slate-100 p-5">
                  <p className="font-bold">
                    No approved Creator campaigns found.
                  </p>

                  <p className="mt-2 text-sm text-slate-600">
                    Approve a complete Creator submission before
                    creating Retail Media.
                  </p>
                </div>
              ) : (
                <select
                  value={
                    selectedCampaignId
                  }
                  onChange={(event) =>
                    handleCampaignChange(
                      event.target.value
                    )
                  }
                  className="mt-5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950"
                >
                  {campaigns.map(
                    (campaign) => (
                      <option
                        key={
                          campaign.id
                        }
                        value={
                          campaign.id
                        }
                      >
                        {campaign.campaignTitle}
                        {" — "}
                        {campaign.productName}
                        {" — "}
                        {campaign.creatorHandle}
                      </option>
                    )
                  )}
                </select>
              )}

              {selectedCampaign && (
                <div className="mt-5 grid gap-3 rounded-2xl bg-slate-100 p-5 text-sm">
                  <p>
                    <strong>
                      Campaign:
                    </strong>{" "}
                    {
                      selectedCampaign.campaignTitle
                    }
                  </p>

                  <p>
                    <strong>
                      Product:
                    </strong>{" "}
                    {
                      selectedCampaign.productName
                    }
                  </p>

                  <p>
                    <strong>
                      Creator:
                    </strong>{" "}
                    {
                      selectedCampaign.creatorHandle
                    }
                  </p>

                  <p>
                    <strong>
                      Creator submission:
                    </strong>{" "}
                    Approved
                  </p>

                  <p>
                    <strong>
                      Creator payout:
                    </strong>{" "}
                    {
                      selectedCampaign.payoutStatus ||
                      "Not listed"
                    }
                  </p>

                  <p>
                    <strong>
                      Retail Media:
                    </strong>{" "}
                    {getRetailMediaStatusLabel(
                      selectedCampaign
                    )}
                  </p>
                </div>
              )}

              {!selectedCampaign
                ?.retailAssetId &&
                !isLive && (
                  <>
                    <div className="mt-8 border-t border-slate-200 pt-7">
                      <h2 className="text-2xl font-black">
                        2. Upload the Exact Product Image
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Upload a clear, front-facing image of the exact
                        package shoppers will scan in the Goshsha app.
                      </p>

                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                        onChange={(event) =>
                          handleTargetImageChange(
                            event.target.files?.[0] ||
                              null
                          )
                        }
                        className="mt-5 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
                      />

                      {previewUrl && (
                        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-3">
                          <img
                            src={
                              previewUrl
                            }
                            alt="Product target preview"
                            className="mx-auto max-h-96 w-full object-contain"
                          />
                        </div>
                      )}
                    </div>

                    <div className="mt-8 border-t border-slate-200 pt-7">
                      <h2 className="text-2xl font-black">
                        3. Verify Product Packaging Text
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Enter the most important Brand and product words
                        visible on the package. This allows the web
                        publisher to resolve the same Product Collection
                        used by the current iOS scanner.
                      </p>

                      <textarea
                        value={
                          rawOcr
                        }
                        onChange={(event) =>
                          setRawOcr(
                            event.target.value
                          )
                        }
                        placeholder="Example: Living Proof Restore Perfecting Spray"
                        className="mt-5 min-h-32 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950"
                      />

                      <button
                        type="button"
                        onClick={
                          handleCreateDraft
                        }
                        disabled={
                          creatingDraft ||
                          publishing ||
                          !selectedCampaign ||
                          !targetImage
                        }
                        className="mt-5 w-full rounded-xl bg-pink-600 px-5 py-3 font-bold text-white hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {creatingDraft
                          ? "Creating Retail Media Draft..."
                          : "Resolve Product and Create AR Draft"}
                      </button>
                    </div>
                  </>
                )}

              {selectedCampaign
                ?.retailAssetId &&
                loadingExistingAsset && (
                  <p className="mt-6 text-sm text-slate-500">
                    Loading existing Retail Asset...
                  </p>
                )}
            </section>

            <section className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl">
                <p className="text-sm font-bold uppercase tracking-wide text-pink-600">
                  Product Resolution
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  AR Publishing Review
                </h2>

                {!draft &&
                !existingAsset &&
                !isLive ? (
                  <div className="mt-5 rounded-2xl bg-slate-100 p-5 text-sm leading-6 text-slate-600">
                    Upload the target product image and create a draft
                    to see the resolved Product Collection.
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    <div className="rounded-2xl bg-slate-100 p-5">
                      <p className="text-xs font-bold uppercase tracking-wide text-pink-600">
                        Resolved Product
                      </p>

                      <h3 className="mt-2 text-xl font-black">
                        {
                          resolvedCanonicalName
                        }
                      </h3>

                      <div className="mt-4 grid gap-3 text-sm">
                        <p>
                          <strong>
                            Product Collection:
                          </strong>{" "}
                          {
                            resolvedCollectionId ||
                            "Not resolved"
                          }
                        </p>

                        <p>
                          <strong>
                            AR Entry:
                          </strong>{" "}
                          {
                            resolvedEntryId ||
                            "Not created"
                          }
                        </p>

                        {draft && (
                          <>
                            <p>
                              <strong>
                                Resolution:
                              </strong>{" "}
                              {
                                draft
                                  .productResolution
                                  .resolution
                              }
                            </p>

                            <p>
                              <strong>
                                Normalized OCR:
                              </strong>{" "}
                              {
                                draft
                                  .productResolution
                                  .normalizedOcr
                              }
                            </p>

                            <p>
                              <strong>
                                Alias:
                              </strong>{" "}
                              {
                                draft
                                  .productResolution
                                  .aliasId
                              }
                            </p>
                          </>
                        )}

                        {existingAsset
                          ?.recognition
                          ?.normalizedOcr &&
                          !draft && (
                            <p>
                              <strong>
                                Normalized OCR:
                              </strong>{" "}
                              {
                                existingAsset
                                  .recognition
                                  .normalizedOcr
                              }
                            </p>
                          )}
                      </div>
                    </div>

                    {!isLive ? (
                      <>
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
                          <p className="font-black">
                            Draft — not scan-ready
                          </p>

                          <p className="mt-2 text-sm leading-6">
                            The Retail Asset exists, but its AR Entry
                            has not yet been published to the Goshsha
                            Master playlist. The 90-day license has not
                            started.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={
                            handlePublish
                          }
                          disabled={
                            publishing ||
                            creatingDraft ||
                            !(
                              draft ||
                              existingAsset ||
                              selectedCampaign
                                ?.retailAssetId
                            )
                          }
                          className="w-full rounded-xl bg-slate-950 px-5 py-3 font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {publishing
                            ? "Publishing to Goshsha..."
                            : "Publish AR and Make Scan-Ready"}
                        </button>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-green-900">
                        <p className="text-lg font-black">
                          Scan-Ready
                        </p>

                        <p className="mt-2 text-sm leading-6">
                          This Creator content is active in the
                          Goshsha Product Master playlist.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl">
                <p className="text-sm font-bold uppercase tracking-wide text-pink-600">
                  Production Status
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Goshsha App Projection
                </h2>

                {!isLive ? (
                  <div className="mt-5 rounded-2xl bg-slate-100 p-5 text-sm leading-6 text-slate-600">
                    Publication details appear after the Retail Asset
                    has been added to the Product Master playlist.
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    <div className="grid gap-3 rounded-2xl bg-slate-100 p-5 text-sm">
                      <p>
                        <strong>
                          Product Collection:
                        </strong>{" "}
                        {
                          resolvedCollectionId
                        }
                      </p>

                      <p>
                        <strong>
                          AR Entry:
                        </strong>{" "}
                        {
                          publication
                            ?.entryId ||
                          selectedCampaign
                            ?.publishedArEntryId ||
                          resolvedEntryId
                        }
                      </p>

                      <p>
                        <strong>
                          Master Playlist:
                        </strong>{" "}
                        {
                          publication
                            ?.masterPlaylistPath ||
                          existingAsset
                            ?.distribution
                            ?.masterPlaylistId ||
                          `masters/${resolvedCollectionId}`
                        }
                      </p>

                      {publication && (
                        <p>
                          <strong>
                            Playlist Items:
                          </strong>{" "}
                          {
                            publication.playlistItemCount
                          }
                        </p>
                      )}

                      <p>
                        <strong>
                          License Starts:
                        </strong>{" "}
                        {formatDate(
                          licenseStartsAt
                        )}
                      </p>

                      <p>
                        <strong>
                          License Expires:
                        </strong>{" "}
                        {formatDate(
                          licenseExpiresAt
                        )}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-pink-200 bg-pink-50 p-5">
                      <p className="font-black">
                        Current acceptance test
                      </p>

                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Open the current Goshsha iOS app, scan the exact
                        physical product, and confirm that this Creator
                        content appears in its swipeable AR playlist.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl">
                <h2 className="text-xl font-black">
                  How this works
                </h2>

                <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-600">
                  <p>
                    <strong className="text-slate-950">
                      1. Retail Asset:
                    </strong>{" "}
                    Stores the authoritative rights, licensing,
                    ownership, playback, activation, and media data.
                  </p>

                  <p>
                    <strong className="text-slate-950">
                      2. Product Collection:
                    </strong>{" "}
                    Connects the uploaded target image and OCR identity
                    to the product recognized by the Goshsha app.
                  </p>

                  <p>
                    <strong className="text-slate-950">
                      3. Master Playlist:
                    </strong>{" "}
                    Projects eligible Creator content into the exact
                    playlist structure consumed by the current iOS app.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}