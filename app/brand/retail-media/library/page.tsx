"use client";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";

import ProtectedRoute from "../../../../components/ProtectedRoute";

import {
  auth,
} from "../../../../lib/firebase";

/*
 * =========================================================
 * IRL Retail Media — Brand Library
 * =========================================================
 *
 * Displays the authenticated Brand's Product 2
 * Retail Assets.
 *
 * Firestore / retailAssets remains the source of truth.
 */

type LibraryState =
  | "active"
  | "expired"
  | "ready_to_publish"
  | "payment_processing"
  | "payment_required";

type RetailMediaLibraryAsset = {
  retailAssetId: string;

  brandName: string;
  productName: string;
  canonicalName?: string;

  state: LibraryState;
  stateLabel: string;

  targetImage?: {
    url?: string | null;
  };

  activation: {
    status: string;

    startsAt:
      | string
      | null;

    endsAt:
      | string
      | null;

    publishedAt:
      | string
      | null;

    expiredAt:
      | string
      | null;
  };

  distribution: {
    published: boolean;
    status: string;
  };

  metrics: {
    qualifiedViews: number;
    views: number;
  };

  commerce: {
    paymentStatus: string;
    commerceStatus: string;
    priceUsd: number;
    includedQualifiedViews: number;
  };

  createdAt:
    | string
    | null;

  updatedAt:
    | string
    | null;
};

type LibraryResponse = {
  ok: boolean;

  summary: {
    total: number;
    active: number;
    readyToPublish: number;
    paymentRequired: number;
    paymentProcessing: number;
    expired: number;
  };

  assets:
    RetailMediaLibraryAsset[];
};

function formatDate(
  value:
    | string
    | null
    | undefined
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
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  ).format(date);
}

function formatNumber(
  value:
    | number
    | null
    | undefined
): string {
  return new Intl.NumberFormat(
    "en-US"
  ).format(
    Number(value || 0)
  );
}

function getStatusClasses(
  state: LibraryState
): string {
  switch (state) {
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";

    case "ready_to_publish":
      return "border-blue-200 bg-blue-50 text-blue-800";

    case "payment_processing":
      return "border-amber-200 bg-amber-50 text-amber-800";

    case "expired":
      return "border-slate-300 bg-slate-100 text-slate-700";

    default:
      return "border-pink-200 bg-pink-50 text-pink-800";
  }
}

function getActionLabel(
  state: LibraryState
): string {
  switch (state) {
    case "active":
      return "View";

    case "ready_to_publish":
      return "Continue & Publish";

    case "payment_processing":
      return "Check Payment Status";

    case "expired":
      return "View";

    default:
      return "Continue Activation";
  }
}

function getActionDescription(
  state: LibraryState
): string {
  switch (state) {
    case "active":
      return "This Retail Media activation is live and scan-ready.";

    case "ready_to_publish":
      return "Payment is complete and this activation is ready to publish.";

    case "payment_processing":
      return "Payment or activation credit fulfillment is still being confirmed.";

    case "expired":
      return "This activation period has ended.";

    default:
      return "This Retail Media draft has not yet been activated.";
  }
}

export default function RetailMediaLibraryPage() {
  const [
    currentUser,
    setCurrentUser,
  ] =
    useState<User | null>(
      auth.currentUser
    );

  const [
    authLoading,
    setAuthLoading,
  ] =
    useState(true);

  const [
    library,
    setLibrary,
  ] =
    useState<LibraryResponse | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  /*
   * -------------------------------------------------------
   * Authentication
   * -------------------------------------------------------
   */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        (user) => {
          setCurrentUser(
            user
          );

          setAuthLoading(
            false
          );
        }
      );

    return unsubscribe;
  }, []);

  /*
   * -------------------------------------------------------
   * Load Brand library
   * -------------------------------------------------------
   */

  useEffect(() => {
    if (
      authLoading ||
      !currentUser
    ) {
      return;
    }

    let cancelled =
      false;

    async function loadLibrary() {
      try {
        setLoading(true);
        setError("");

        const idToken =
          await currentUser.getIdToken();

        const response =
          await fetch(
            "/api/brand/retail-media/list",
            {
              method: "GET",

              headers: {
                Authorization:
                  `Bearer ${idToken}`,
              },

              cache:
                "no-store",
            }
          );

        const text =
          await response.text();

        let result:
          any = null;

        try {
          result =
            text
              ? JSON.parse(
                  text
                )
              : null;
        } catch {
          result = null;
        }

        if (
          !response.ok
        ) {
          throw new Error(
            result?.error ||
              text ||
              "Failed to load your Retail Media."
          );
        }

        if (
          !cancelled
        ) {
          setLibrary(
            result as LibraryResponse
          );
        }
      } catch (
        loadError: any
      ) {
        console.error(
          "My Retail Media load error:",
          loadError
        );

        if (
          !cancelled
        ) {
          setError(
            loadError?.message ||
              "Failed to load your Retail Media."
          );
        }
      } finally {
        if (
          !cancelled
        ) {
          setLoading(
            false
          );
        }
      }
    }

    loadLibrary();

    return () => {
      cancelled =
        true;
    };
  }, [
    currentUser,
    authLoading,
  ]);

  const assets =
    library?.assets ||
    [];

  const summary =
    library?.summary;

  const hasAssets =
    assets.length >
    0;

  const unfinishedCount =
    useMemo(
      () =>
        assets.filter(
          (asset) =>
            asset.state ===
              "payment_required" ||
            asset.state ===
              "payment_processing" ||
            asset.state ===
              "ready_to_publish"
        ).length,
      [assets]
    );

  if (
    authLoading
  ) {
    return (
      <ProtectedRoute allowedRole="brand">
        <main className="min-h-screen bg-gradient-to-br from-white via-pink-50 to-blue-50 px-6 py-10 text-slate-950">
          <div className="mx-auto max-w-7xl">
            <p className="text-slate-600">
              Loading My Retail Media...
            </p>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRole="brand">
      <main className="min-h-screen bg-gradient-to-br from-white via-pink-50 to-blue-50 px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-7xl">

          {/* HEADER */}

          <header className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-pink-600">
                IRL Retail Media
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-tight">
                My Retail Media
              </h1>

              <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">
                Manage your Retail Media drafts,
                activations, and live
                scan-ready experiences.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/brand/dashboard"
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50"
              >
                Dashboard
              </Link>

              <Link
                href="/brand/retail-media/direct"
                className="rounded-xl bg-pink-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-pink-700"
              >
                + Create New Retail Media
              </Link>
            </div>
          </header>

          {/* SUMMARY */}

          {!loading &&
            !error &&
            summary && (
              <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Total Retail Media
                  </p>

                  <p className="mt-2 text-3xl font-black text-slate-950">
                    {summary.total}
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                    Active
                  </p>

                  <p className="mt-2 text-3xl font-black text-slate-950">
                    {summary.active}
                  </p>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">
                    Ready to Publish
                  </p>

                  <p className="mt-2 text-3xl font-black text-slate-950">
                    {summary.readyToPublish}
                  </p>
                </div>

                <div className="rounded-2xl border border-pink-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-pink-700">
                    Need Attention
                  </p>

                  <p className="mt-2 text-3xl font-black text-slate-950">
                    {unfinishedCount}
                  </p>
                </div>
              </section>
            )}

          {/* LOADING */}

          {loading && (
            <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <p className="font-bold text-slate-700">
                Loading your Retail Media...
              </p>
            </section>
          )}

          {/* ERROR */}

          {!loading &&
            error && (
              <section className="mt-10 rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
                <p className="font-black text-red-800">
                  We couldn't load your Retail Media.
                </p>

                <p className="mt-2 text-sm leading-6 text-red-700">
                  {error}
                </p>
              </section>
            )}

          {/* EMPTY STATE */}

          {!loading &&
            !error &&
            !hasAssets && (
              <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                <div className="mx-auto max-w-2xl">
                  <p className="text-sm font-black uppercase tracking-[0.16em] text-pink-600">
                    Your Retail Media Library
                  </p>

                  <h2 className="mt-3 text-3xl font-black tracking-tight">
                    No Retail Media yet
                  </h2>

                  <p className="mt-4 text-lg leading-8 text-slate-600">
                    When you create Retail Media,
                    your drafts and active
                    experiences will appear here.
                  </p>

                  <Link
                    href="/brand/retail-media/direct"
                    className="mt-7 inline-flex rounded-xl bg-pink-600 px-6 py-3 font-black text-white shadow-sm hover:bg-pink-700"
                  >
                    Create Your First Retail Media
                  </Link>
                </div>
              </section>
            )}

          {/* LIBRARY */}

          {!loading &&
            !error &&
            hasAssets && (
              <section className="mt-10">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">
                      Retail Media Library
                    </h2>

                    <p className="mt-1 text-sm text-slate-600">
                      Newest Retail Media appears first.
                    </p>
                  </div>

                  <p className="text-sm font-bold text-slate-500">
                    {formatNumber(
                      assets.length
                    )}{" "}
                    {assets.length ===
                    1
                      ? "item"
                      : "items"}
                  </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  {assets.map(
                    (
                      asset
                    ) => {
                      const productDisplayName =
                        asset.productName ||
                        asset.canonicalName ||
                        "Retail Media";

                      const hasActivationDates =
                        Boolean(
                          asset.activation
                            .startsAt ||
                            asset.activation
                              .endsAt
                        );

                      const actionHref =
                        `/brand/retail-media/direct?retail_asset_id=${encodeURIComponent(
                          asset.retailAssetId
                        )}`;

                      return (
                        <article
                          key={
                            asset.retailAssetId
                          }
                          className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                        >
                          {/* IMAGE */}

                          <div className="relative h-52 bg-slate-100">
                            {asset
                              .targetImage
                              ?.url ? (
                              <img
                                src={
                                  asset
                                    .targetImage
                                    .url
                                }
                                alt={
                                  productDisplayName
                                }
                                className="h-full w-full object-contain p-4"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center px-6 text-center text-sm font-bold text-slate-400">
                                Product image
                              </div>
                            )}

                            <div className="absolute left-4 top-4">
                              <span
                                className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] ${getStatusClasses(
                                  asset.state
                                )}`}
                              >
                                {
                                  asset.stateLabel
                                }
                              </span>
                            </div>
                          </div>

                          {/* CARD BODY */}

                          <div className="p-6">
                            <p className="text-sm font-bold text-pink-600">
                              {asset.brandName ||
                                "Brand"}
                            </p>

                            <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                              {
                                productDisplayName
                              }
                            </h3>

                            <p className="mt-3 text-sm leading-6 text-slate-600">
                              {getActionDescription(
                                asset.state
                              )}
                            </p>

                            {/* ACTIVATION DETAILS */}

                            <div className="mt-6 grid grid-cols-2 gap-4">
                              <div className="rounded-2xl bg-slate-50 p-4">
                                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                                  Qualified Views
                                </p>

                                <p className="mt-2 text-xl font-black">
                                  {formatNumber(
                                    asset
                                      .metrics
                                      .qualifiedViews
                                  )}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  First{" "}
                                  {formatNumber(
                                    asset
                                      .commerce
                                      .includedQualifiedViews
                                  )}{" "}
                                  included
                                </p>
                              </div>

                              <div className="rounded-2xl bg-slate-50 p-4">
                                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                                  Created
                                </p>

                                <p className="mt-2 text-sm font-black leading-6">
                                  {formatDate(
                                    asset.createdAt
                                  )}
                                </p>
                              </div>
                            </div>

                            {hasActivationDates && (
                              <div className="mt-4 rounded-2xl border border-slate-200 p-4">
                                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                                  Activation Period
                                </p>

                                <p className="mt-2 font-bold text-slate-800">
                                  {formatDate(
                                    asset
                                      .activation
                                      .startsAt
                                  )}
                                  {" → "}
                                  {formatDate(
                                    asset
                                      .activation
                                      .endsAt
                                  )}
                                </p>
                              </div>
                            )}

                            {/* ACTION */}

                            <div className="mt-6">
                              <Link
                                href={
                                  actionHref
                                }
                                className={
                                  asset.state ===
                                  "active"
                                    ? "inline-flex w-full items-center justify-center rounded-xl bg-emerald-700 px-5 py-3 font-black text-white shadow-sm hover:bg-emerald-800"
                                    : asset.state ===
                                        "ready_to_publish"
                                      ? "inline-flex w-full items-center justify-center rounded-xl bg-blue-700 px-5 py-3 font-black text-white shadow-sm hover:bg-blue-800"
                                      : "inline-flex w-full items-center justify-center rounded-xl bg-pink-600 px-5 py-3 font-black text-white shadow-sm hover:bg-pink-700"
                                }
                              >
                                {getActionLabel(
                                  asset.state
                                )}
                              </Link>
                            </div>
                          </div>
                        </article>
                      );
                    }
                  )}
                </div>
              </section>
            )}
        </div>
      </main>
    </ProtectedRoute>
  );
}