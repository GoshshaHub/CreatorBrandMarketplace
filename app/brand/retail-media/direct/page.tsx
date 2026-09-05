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

import {
  ref,
  uploadBytesResumable,
} from "firebase/storage";

import ProtectedRoute from "../../../../components/ProtectedRoute";

import {
  auth,
  storage,
} from "../../../../lib/firebase";

/*
 * =========================================================
 * Product 2 — Direct Retail Media
 * =========================================================
 *
 * Brand already has:
 *
 *   Content
 *      +
 *   Product
 *
 *        ↓
 *
 * Create Retail Media Draft
 *
 *        ↓
 *
 * Purchase Activation
 *
 *        ↓
 *
 * Publish / Scan Ready
 *
 *
 * This page intentionally does NOT use campaigns.
 */

type OwnershipType =
  | "brand_owned"
  | "external_creator";

type ProductResolution = {
  collectionId: string;

  masterId?: string;

  canonicalName: string;
  canonicalSlug: string;

  aliasId: string;

  rawOcr: string;
  normalizedOcr: string;

  tokens: string[];

  brandTokens?: string[];

  resolution:
    | "exact_alias"
    | "existing_collection"
    | "created_collection"
    | "proposed_collection";

  collectionExisted: boolean;
  aliasExisted: boolean;

  matcherVersion: string;
};

type DirectDraftResult = {
  retailAssetId: string;

  campaignId: null;

  creatorId: string | null;

  brandId: string;

  collectionId: string;
  entryId: string;

  status: string;

  sourceProduct: string;

  productResolution:
    ProductResolution;
};

type DirectDraftResponse = {
  ok: boolean;

  reusedExistingDraft:
    boolean;

  retailAsset:
    DirectDraftResult;

  media?: {
    url?: string;
    storagePath?: string;
    contentType?: string;
    originalName?: string;
    sizeBytes?: number;
  };

  targetImage?: {
    url?: string;
    storagePath?: string;
    contentType?: string;
    originalName?: string | null;
    sizeBytes?: number;
  };

  commerce?: {
    product?: string;

    purchaseDefinitionKey?:
      string;

    paymentStatus?: string;

    activationCreditId?:
      string | null;

    priceUsd?: number;

    includedQualifiedViews?:
      number;
  };

  publication?: {
    status?: string;

    arEntryCreated?:
      boolean;

    masterPlaylistUpdated?:
      boolean;

    licenseStarted?:
      boolean;

    activationStarted?:
      boolean;

    scanReady?:
      boolean;
  };
};

type ActivationStatusResponse = {
  ok: boolean;

  retailAssetId: string;

  product?: string;

  state:
    | "payment_required"
    | "payment_processing"
    | "payment_confirmed_waiting_for_credit"
    | "payment_failed"
    | "ready_to_publish"
    | "active";

  payment: {
    status: string;

    paid: boolean;

    commerceId:
      string | null;

    fulfillmentStatus:
      string;

    checkoutStatus?:
      string | null;

    amountUsd?:
      number;

    currency?:
      string;

    stripeCheckoutSessionId?:
      string | null;
  };

  credit: {
    issued: boolean;

    available: boolean;

    creditId:
      string | null;

    status:
      string | null;

    includedQualifiedViews?:
      number;

    activationDays?:
      number;
  };

  activation: {
    canPublish: boolean;

    alreadyPublished?:
      boolean;

    status:
      string;

    startsAt?:
      unknown;

    endsAt?:
      unknown;
  };

  distribution: {
    published: boolean;

    status: string;

    masterPlaylistId?:
      string | null;
  };
};

type PublicationResult = {
  retailAssetId?: string;

  collectionId?: string;

  entryId?: string;

  activationStartsAt?: string;

  activationEndsAt?: string;

  licenseStartsAt?: string;

  licenseExpiresAt?: string;

  masterPlaylistPath?: string;

  playlistItemCount?: number;

  alreadyPublished?: boolean;

  scanReady?: boolean;
};

function formatBytes(
  value: number
): string {
  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return "0 MB";
  }

  const megabytes =
    value /
    1024 /
    1024;

  if (
    megabytes < 1
  ) {
    return `${(
      value / 1024
    ).toFixed(1)} KB`;
  }

  return `${megabytes.toFixed(
    1
  )} MB`;
}

const MAX_MEDIA_BYTES =
  250 * 1024 * 1024;

const MAX_TARGET_IMAGE_BYTES =
  25 * 1024 * 1024;

function fileIsHeic(
  file: File
): boolean {
  const fileName =
    file.name.toLowerCase();

  const fileType =
    file.type.toLowerCase();

  return (
    fileName.endsWith(".heic") ||
    fileName.endsWith(".heif") ||
    fileType === "image/heic" ||
    fileType === "image/heif"
  );
}

async function normalizeTargetImage(
  file: File
): Promise<File> {
  if (!fileIsHeic(file)) {
    return file;
  }

  /*
   * heic2any is browser-only.
   *
   * Import it only when a Brand actually selects
   * a HEIC/HEIF image so Next.js does not evaluate
   * the library during server prerendering.
   */
  const heic2anyModule =
    await import("heic2any");

  const heic2any =
    heic2anyModule.default;

  const converted =
    await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.92,
    });

  const convertedBlob =
    Array.isArray(converted)
      ? converted[0]
      : converted;

  const originalName =
    file.name.replace(
      /\.(heic|heif)$/i,
      ""
    );

  return new File(
    [convertedBlob],
    `${originalName}.jpg`,
    {
      type: "image/jpeg",
      lastModified:
        file.lastModified,
    }
  );
}

function fileIsMp4(
  file: File | null
): boolean {
  if (!file) {
    return false;
  }

  return file.name
    .toLowerCase()
    .endsWith(".mp4");
}

function safeUploadFileName(
  fileName: string
): string {
  return fileName
    .replace(
      /[^a-zA-Z0-9._-]/g,
      "-"
    )
    .replace(
      /-+/g,
      "-"
    )
    .slice(
      0,
      120
    );
}

async function uploadDirectRetailMediaFile(
  params: {
    file: File;

    userId: string;

    kind:
      | "media"
      | "target";

    onProgress?: (
      progress: number
    ) => void;
  }
): Promise<string> {
  const safeFileName =
    safeUploadFileName(
      params.file.name
    );

  const storagePath =
    `retail-media-direct-uploads/` +
    `${params.userId}/` +
    `${params.kind}/` +
    `${Date.now()}-` +
    `${Math.random()
      .toString(36)
      .slice(2, 10)}-` +
    `${safeFileName}`;

  const storageRef =
    ref(
      storage,
      storagePath
    );

  const uploadTask =
    uploadBytesResumable(
      storageRef,
      params.file,
      {
        contentType:
          params.file.type ||
          undefined,

        customMetadata: {
          originalFileName:
            params.file.name,

          uploadPurpose:
            params.kind ===
            "media"
              ? "retail_media_direct_source"
              : "retail_media_direct_target",
        },
      }
    );

  await new Promise<void>(
    (
      resolve,
      reject
    ) => {
      uploadTask.on(
        "state_changed",

        (snapshot) => {
          const totalBytes =
            snapshot
              .totalBytes;

          const progress =
            totalBytes > 0
              ? (
                  snapshot
                    .bytesTransferred /
                  totalBytes
                ) *
                100
              : 0;

          params.onProgress?.(
            progress
          );
        },

        (uploadError) => {
          reject(
            uploadError
          );
        },

        () => {
          resolve();
        }
      );
    }
  );

  return storagePath;
}

export default function DirectRetailMediaPage() {
  const [
    currentUser,
    setCurrentUser,
  ] =
    useState<User | null>(
      null
    );

  const [
    authLoading,
    setAuthLoading,
  ] =
    useState(true);

  const [
    brandName,
    setBrandName,
  ] =
    useState("");

  const [
    productName,
    setProductName,
  ] =
    useState("");

  const [
    linkUrl,
    setLinkUrl,
    ] =
    useState("");

  const [
    rawOcr,
    setRawOcr,
  ] =
    useState("");

  const [
    ownershipType,
    setOwnershipType,
  ] =
    useState<OwnershipType>(
      "brand_owned"
    );

  const [
    externalCreatorName,
    setExternalCreatorName,
  ] =
    useState("");

  const [
    originalMedia,
    setOriginalMedia,
  ] =
    useState<File | null>(
      null
    );

  const [
    targetImage,
    setTargetImage,
  ] =
    useState<File | null>(
      null
    );

  const [
    mediaError,
    setMediaError,
  ] =
    useState("");

  const [
    targetImageError,
    setTargetImageError,
  ] =
    useState("");

  const [
    contentRightsConfirmed,
    setContentRightsConfirmed,
  ] =
    useState(false);

  const [
    appearanceRightsConfirmed,
    setAppearanceRightsConfirmed,
  ] =
    useState(false);

  const [
    brandUsageApproved,
    setBrandUsageApproved,
  ] =
    useState(false);

  const [
    distributionLicenseGranted,
    setDistributionLicenseGranted,
  ] =
    useState(false);

  const [
    audioRightsConfirmed,
    setAudioRightsConfirmed,
  ] =
    useState(false);

  const [
    creatingDraft,
    setCreatingDraft,
  ] =
    useState(false);

  const [
  mediaUploadProgress,
  setMediaUploadProgress,
] =
  useState(0);

  const [
    targetUploadProgress,
    setTargetUploadProgress,
  ] =
    useState(0);
    
  const [
    startingCheckout,
    setStartingCheckout,
    ] =
    useState(false);  

  const [
    activationStatus,
    setActivationStatus,
    ] =
    useState<ActivationStatusResponse | null>(
        null
    );

    const [
    loadingActivationStatus,
    setLoadingActivationStatus,
    ] =
    useState(false);

    const [
    publishing,
    setPublishing,
    ] =
    useState(false);

    const [
    publication,
    setPublication,
    ] =
    useState<PublicationResult | null>(
        null
    );  

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
    draftResponse,
    setDraftResponse,
  ] =
    useState<DirectDraftResponse | null>(
      null
    );

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

    return () =>
      unsubscribe();
  }, []);

  useEffect(() => {
    if (
        authLoading ||
        !currentUser
    ) {
        return;
    }

    const params =
        new URLSearchParams(
        window.location.search
        );

    const checkout =
        params.get(
        "checkout"
        );

    const returnedRetailAssetId =
        params.get(
        "retail_asset_id"
        );

    /*
    * Restore the draft UI Stripe navigated away from.
    */
    try {
        const savedDraft =
        sessionStorage.getItem(
            "goshsha_product_2_draft"
        );

        if (
        savedDraft
        ) {
        const parsed =
            JSON.parse(
            savedDraft
            ) as DirectDraftResponse;

        const savedAssetId =
            parsed
            ?.retailAsset
            ?.retailAssetId;

        if (
            savedAssetId &&
            (
            !returnedRetailAssetId ||
            savedAssetId ===
                returnedRetailAssetId
            )
        ) {
            setDraftResponse(
            parsed
            );
            const savedBrandName =
              sessionStorage.getItem(
                "goshsha_product_2_brand_name"
              );

            const savedProductName =
              sessionStorage.getItem(
                "goshsha_product_2_product_name"
              );

            const savedLinkUrl =
              sessionStorage.getItem(
                "goshsha_product_2_link_url"
              );

            if (savedBrandName) {
              setBrandName(
                savedBrandName
              );
            }

            if (savedProductName) {
              setProductName(
                savedProductName
              );
            }

            if (savedLinkUrl) {
              setLinkUrl(
                savedLinkUrl
              );
            }
        }
        }
    } catch (
        restoreError
    ) {
        console.warn(
        "Could not restore IRL Retail Media draft:",
        restoreError
        );
    }

    if (
        !returnedRetailAssetId
    ) {
        return;
    }

    /*
    * Stripe may redirect before the webhook has finished
    * writing the activation credit.
    *
    * Poll briefly until the authoritative state becomes
    * ready_to_publish.
    */
    let cancelled =
        false;

    async function verifyCheckoutReturn() {
        if (
        checkout ===
        "cancelled"
        ) {
        setMessage(
            "Checkout was cancelled. Your Retail Media draft is still saved and the 90-day activation has not started."
        );

        await loadActivationStatus(
            returnedRetailAssetId
        );

        return;
        }

        if (
        checkout !==
        "success"
        ) {
        await loadActivationStatus(
            returnedRetailAssetId
        );

        return;
        }

        setMessage(
        "Payment received. Confirming your activation credit..."
        );

        for (
        let attempt = 0;
        attempt < 10;
        attempt += 1
        ) {
        if (cancelled) {
            return;
        }

        const status =
            await loadActivationStatus(
            returnedRetailAssetId,
            {
                silent:
                attempt > 0,
            }
            );

        if (
            !status
        ) {
            break;
        }

        if (
            status.state ===
            "ready_to_publish"
        ) {
            setMessage(
            "Payment confirmed. Your activation credit is ready. Review the product and publish when you're ready."
            );

            return;
        }

        if (
            status.state ===
            "active"
        ) {
            setMessage(
            "This Retail Media activation is already active and scan-ready."
            );

            return;
        }

        if (
            status.state ===
            "payment_failed"
        ) {
            setError(
            "The Retail Media payment could not be confirmed."
            );

            return;
        }

        await new Promise(
            (resolve) =>
            window.setTimeout(
                resolve,
                1500
            )
        );
        }

        if (!cancelled) {
        setMessage(
            "Your payment was received and is still being confirmed. Refresh this page in a moment if the activation credit does not appear."
        );
        }
    }

    verifyCheckoutReturn();

    return () => {
        cancelled =
        true;
    };
    }, [
    currentUser?.uid,
    authLoading,
    ]);

  /*
   * -------------------------------------------------------
   * Local previews
   * -------------------------------------------------------
   */

  const mediaPreviewUrl =
    useMemo(() => {
      if (
        !originalMedia
      ) {
        return "";
      }

      return URL.createObjectURL(
        originalMedia
      );
    }, [
      originalMedia,
    ]);

  useEffect(() => {
    return () => {
      if (
        mediaPreviewUrl
      ) {
        URL.revokeObjectURL(
          mediaPreviewUrl
        );
      }
    };
  }, [
    mediaPreviewUrl,
  ]);

  const targetPreviewUrl =
    useMemo(() => {
      if (
        !targetImage
      ) {
        return "";
      }

      return URL.createObjectURL(
        targetImage
      );
    }, [
      targetImage,
    ]);

  useEffect(() => {
    return () => {
      if (
        targetPreviewUrl
      ) {
        URL.revokeObjectURL(
          targetPreviewUrl
        );
      }
    };
  }, [
    targetPreviewUrl,
  ]);

  /*
   * -------------------------------------------------------
   * Validation helpers
   * -------------------------------------------------------
   */

  const requiredRightsComplete =
    contentRightsConfirmed &&
    appearanceRightsConfirmed &&
    brandUsageApproved &&
    distributionLicenseGranted;

  const externalCreatorComplete =
    ownershipType ===
      "brand_owned" ||
    externalCreatorName
      .trim()
      .length > 0;

  const formReady =
    brandName.trim()
        .length > 0 &&
    productName.trim()
        .length > 0 &&
    linkUrl.trim()
        .length > 0 &&
    rawOcr.trim()
        .length > 0 &&
    Boolean(
      originalMedia
    ) &&
    fileIsMp4(
      originalMedia
    ) &&
    Boolean(
      targetImage
    ) &&
    requiredRightsComplete &&
    externalCreatorComplete;

  /*
   * -------------------------------------------------------
   * File handlers
   * -------------------------------------------------------
   */

  function handleMediaChange(
    file: File | null
  ) {
    setError("");
    setMessage("");
    setMediaError("");
    setDraftResponse(
      null
    );

    if (!file) {
      setOriginalMedia(
        null
      );

      return;
    }

    if (
      !fileIsMp4(file)
    ) {
      setOriginalMedia(
        null
      );

      setMediaError(
        "Please upload your video as an MP4 (.mp4 or .MP4). MOV and other video formats are not yet supported."
      );

      return;
    }

    if (
      file.size >
      MAX_MEDIA_BYTES
    ) {
      setOriginalMedia(
        null
      );

      setMediaError(
        "The video must be 250 MB or smaller."
      );

      return;
    }

    setOriginalMedia(
      file
    );
  }

async function handleTargetImageChange(
  file: File | null
) {
  setError("");
  setMessage("");
  setTargetImageError("");
  setDraftResponse(
    null
  );

  if (!file) {
    setTargetImage(
      null
    );

    return;
  }

  if (
    file.size >
    MAX_TARGET_IMAGE_BYTES
  ) {
    setTargetImage(
      null
    );

    setTargetImageError(
      "The target image must be 25 MB or smaller."
    );

    return;
  }

  try {
    const normalizedFile =
      await normalizeTargetImage(
        file
      );

    if (
      normalizedFile.size >
      MAX_TARGET_IMAGE_BYTES
    ) {
      setTargetImage(
        null
      );

      setTargetImageError(
        "The converted target image must be 25 MB or smaller."
      );

      return;
    }

    setTargetImage(
      normalizedFile
    );
  } catch (conversionError) {
    console.error(
      "HEIC target image conversion error:",
      conversionError
    );

    setTargetImage(
      null
    );

    setTargetImageError(
      "We couldn't process this HEIC/HEIF image. Please try another image."
    );
  }
}

  /*
   * -------------------------------------------------------
   * Create Product 2 Retail Asset
   * -------------------------------------------------------
   */

  async function handleCreateDraft() {
    setError("");
    setMessage("");
    setMediaError("");
    setTargetImageError("");

    if (
      !currentUser
    ) {
      setError(
        "Please log in again."
      );

      return;
    }

    if (
      !brandName.trim()
    ) {
      setError(
        "Enter your Brand name."
      );

      return;
    }

    if (
      !productName.trim()
    ) {
      setError(
        "Enter the product name."
      );

      return;
    }

    const cleanedLinkUrl =
        linkUrl.trim();

        if (!cleanedLinkUrl) {
        setError(
            "Enter the Link URL shoppers should visit when they tap the Link button."
        );

        return;
        }

        try {
        const parsedUrl =
            new URL(
            cleanedLinkUrl
            );

        if (
            parsedUrl.protocol !==
            "https:" &&
            parsedUrl.protocol !==
            "http:"
        ) {
            throw new Error(
            "INVALID_LINK_URL"
            );
        }
        } catch {
        setError(
            "Enter a valid Link URL beginning with https:// or http://."
        );

        return;
        }

    if (
      !originalMedia
    ) {
      setMediaError(
        "Upload the video you want to activate."
      );

      return;
    }

    if (
      !fileIsMp4(
        originalMedia
      )
    ) {
      setMediaError(
        "Please upload your video as an MP4 (.mp4 or .MP4). MOV and other video formats are not yet supported."
      );

      return;
    }

    if (
      !targetImage
    ) {
      setTargetImageError(
        "Upload the exact product image shoppers will scan."
      );

      return;
    }

    if (
      !rawOcr.trim()
    ) {
      setError(
        "Enter the important Brand and product words visible on the package."
      );

      return;
    }

    if (
      ownershipType ===
        "external_creator" &&
      !externalCreatorName
        .trim()
    ) {
      setError(
        "Enter the Creator's name."
      );

      return;
    }

    if (
      !requiredRightsComplete
    ) {
      setError(
        "Complete all required rights certifications before creating the Retail Media draft."
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

    setMediaUploadProgress(
      0
    );

    setTargetUploadProgress(
      0
    );

    /*
    * Upload the source video directly from the browser
    * to Firebase Storage.
    *
    * The Vercel API route receives only the Storage path,
    * not the video bytes.
    */
    const mediaStoragePath =
      await uploadDirectRetailMediaFile({
        file:
          originalMedia,

        userId:
          currentUser.uid,

        kind:
          "media",

        onProgress:
          setMediaUploadProgress,
      });

    /*
    * Upload the scannable target directly from the browser
    * to Firebase Storage.
    */
    const targetImageStoragePath =
      await uploadDirectRetailMediaFile({
        file:
          targetImage,

        userId:
          currentUser.uid,

        kind:
          "target",

        onProgress:
          setTargetUploadProgress,
      });

    /*
    * Send metadata only to the server.
    *
    * The server verifies that both Firebase Storage objects:
    *
    * 1. exist,
    * 2. belong to this authenticated Brand,
    * 3. have valid authoritative metadata,
    *
    * before promoting them into the permanent
    * Retail Media Storage locations.
    */
    const response =
      await fetch(
        "/api/brand/retail-media/create-direct-draft",
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
              brandName:
                brandName.trim(),

              productName:
                productName.trim(),

              linkUrl:
                cleanedLinkUrl,

              rawOcr:
                rawOcr.trim(),

              contentOwnershipType:
                ownershipType,

              externalCreatorName:
                externalCreatorName.trim(),

              contentRightsConfirmed,

              appearanceRightsConfirmed,

              brandUsageApproved,

              goshshaDistributionLicenseGranted:
                distributionLicenseGranted,

              audioRightsConfirmed,

              mediaStoragePath,

              targetImageStoragePath,
            }),
        }
      );

    /*
    * Do not assume every infrastructure error is JSON.
    *
    * For example, Vercel may return plain text for an
    * infrastructure-level error.
    */
    const responseText =
      await response.text();

    let data: any = {};

    try {
      data =
        responseText
          ? JSON.parse(
              responseText
            )
          : {};
    } catch {
      throw new Error(
        response.ok
          ? "The server returned an unexpected response."
          : responseText ||
              "Failed to create Retail Media draft."
      );
    }

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Failed to create Retail Media draft."
        );
      }

      const result =
        data as DirectDraftResponse;

      setDraftResponse(
        result
      );

      try {
        sessionStorage.setItem(
            "goshsha_product_2_draft",
            JSON.stringify(
            result
            )
        );
        sessionStorage.setItem(
          "goshsha_product_2_brand_name",
          brandName.trim()
        );

        sessionStorage.setItem(
          "goshsha_product_2_product_name",
          productName.trim()
        );

        sessionStorage.setItem(
          "goshsha_product_2_link_url",
          cleanedLinkUrl
        );
        } catch {
        // Browser storage is a convenience only.
        }

      setMessage(
        result
          .reusedExistingDraft
          ? "Your existing Retail Media draft was found and loaded."
          : "Retail Media draft created successfully. Review the product resolution before purchasing the activation."
      );
      await loadActivationStatus(
        result.retailAsset
            .retailAssetId
        );
    } catch (
      err: any
    ) {
      console.error(
        "IRL Retail Media draft error:",
        err
      );

      setError(
        err?.message ||
          "Failed to create Retail Media draft."
      );
    } finally {
      setCreatingDraft(
        false
      );
    }
  }

  async function loadActivationStatus(
    retailAssetId: string,
    options?: {
        silent?: boolean;
    }
    ): Promise<ActivationStatusResponse | null> {
    if (!currentUser) {
        return null;
    }

    const silent =
        options?.silent ===
        true;

    if (!silent) {
        setLoadingActivationStatus(
        true
        );
    }

    try {
        const idToken =
        await currentUser.getIdToken(
            true
        );

        const response =
        await fetch(
            `/api/brand/retail-media/activation-status?retailAssetId=${encodeURIComponent(
            retailAssetId
            )}`,
            {
            headers: {
                Authorization:
                `Bearer ${idToken}`,
            },

            cache:
                "no-store",
            }
        );

        const data =
        await response.json();

        if (!response.ok) {
        throw new Error(
            data.error ||
            "Failed to load activation status."
        );
        }

        const result =
        data as ActivationStatusResponse;

        setActivationStatus(
        result
        );

        return result;
    } catch (err: any) {
        console.error(
        "IRL Retail Media activation status error:",
        err
        );

        if (!silent) {
        setError(
            err?.message ||
            "Failed to verify activation payment."
        );
        }

        return null;
    } finally {
        if (!silent) {
        setLoadingActivationStatus(
            false
        );
        }
    }
    }

  async function handlePurchaseActivation() {
    setError("");
    setMessage("");

    if (!currentUser) {
        setError(
        "Please log in again."
        );

        return;
    }

    const retailAssetId =
        draftResponse
        ?.retailAsset
        ?.retailAssetId;

    if (!retailAssetId) {
        setError(
        "Create the Retail Media draft before purchasing an activation."
        );

        return;
    }

    setStartingCheckout(
        true
    );

    try {
        const idToken =
        await currentUser.getIdToken(
            true
        );

        const response =
        await fetch(
            "/api/brand/retail-media/create-activation-checkout",
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
                purchaseDefinitionKey:
                    "product_2_single_activation",

                retailAssetId,
                }),
            }
        );

        const data =
        await response.json();

        if (!response.ok) {
        throw new Error(
            data.error ||
            "Unable to start Retail Media checkout."
        );
        }

        if (
          data.alreadyPurchased ===
          true
        ) {
          setMessage(
            "Payment has already been received for this Retail Media activation. Confirming your activation credit..."
          );

          await loadActivationStatus(
            retailAssetId
          );

          setStartingCheckout(
            false
          );

          return;
        }

        if (
          data.existingCheckout ===
            true &&
          data.checkoutUrl
        ) {
        /*
        * Preserve the current draft and Brand-entered
        * fields across the Stripe redirect.
        */
        if (
          draftResponse
        ) {
          try {
            sessionStorage.setItem(
              "goshsha_product_2_draft",
              JSON.stringify(
                draftResponse
              )
            );

            sessionStorage.setItem(
              "goshsha_product_2_brand_name",
              brandName.trim()
            );

            sessionStorage.setItem(
              "goshsha_product_2_product_name",
              productName.trim()
            );

            sessionStorage.setItem(
              "goshsha_product_2_link_url",
              linkUrl.trim()
            );
          } catch {
            // Browser storage is a convenience only.
          }
        }

          window.location.href =
            data.checkoutUrl;

          return;
        }

        if (!data.checkoutUrl) {
          throw new Error(
            "Stripe Checkout URL was not returned."
          );
        }

       /*
        * Preserve the current draft across the Stripe redirect.
        */
        if (
        draftResponse
        ) {
        try {
            sessionStorage.setItem(
            "goshsha_product_2_draft",
            JSON.stringify(
                draftResponse
            )
            );
        } catch {
            // Convenience only.
        }
      }

        window.location.href =
        data.checkoutUrl;
    } catch (err: any) {
        console.error(
        "IRL Retail Media activation checkout error:",
        err
        );

        setError(
        err?.message ||
            "Unable to start Retail Media activation checkout."
        );

        setStartingCheckout(
        false
        );
    }
    }

    async function handlePublishProduct2() {
        setError("");
        setMessage("");

        if (!currentUser) {
            setError(
            "Please log in again."
            );

            return;
        }

        const retailAssetId =
            draftResponse
            ?.retailAsset
            ?.retailAssetId ||
            activationStatus
            ?.retailAssetId;

        if (!retailAssetId) {
            setError(
            "Retail Asset could not be found."
            );

            return;
        }

        /*
        * UI safety check.
        *
        * The server publisher independently verifies and consumes
        * the paid credit, so this cannot bypass billing.
        */
        if (
            !activationStatus
            ?.activation
            ?.canPublish
        ) {
            setError(
            "A paid activation credit is required before this Retail Asset can be published."
            );

            return;
        }

        const confirmed =
            window.confirm(
            [
                "Publish this IRL Retail Media activation?",
                "",
                "Publishing will:",
                "• consume 1 paid Retail Media activation credit",
                "• begin the 90-day activation period",
                "• begin qualified-view tracking",
                "• make this content scan-ready in the Goshsha app",
                "",
                "The 90-day activation period begins when you publish.",
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

            if (
            data.publication
            ) {
            setPublication(
                data.publication
            );
            }

            await loadActivationStatus(
            retailAssetId
            );

            setMessage(
            "Retail Media is now active and scan-ready in the Goshsha app."
            );
        } catch (err: any) {
            console.error(
            "IRL Retail Media publish error:",
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


  /*
   * -------------------------------------------------------
   * Page
   * -------------------------------------------------------
   */

  if (
    authLoading
  ) {
    return (
      <ProtectedRoute allowedRole="brand">
        <main className="min-h-screen bg-gradient-to-br from-white via-pink-50 to-blue-50 px-6 py-10 text-slate-950">
          <div className="mx-auto max-w-7xl">
            <p className="text-slate-600">
              Loading Retail Media...
            </p>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  const draft =
    draftResponse
      ?.retailAsset;

  const resolution =
    draft
      ?.productResolution;

  const commerce =
    draftResponse
      ?.commerce;

  const paymentProcessing =
    activationStatus
      ?.state ===
      "payment_processing" ||
    activationStatus
      ?.state ===
      "payment_confirmed_waiting_for_credit";

  const paymentConfirmed =
    activationStatus
        ?.payment
        ?.paid ===
    true;

  const purchaseLocked =
    startingCheckout ||
    paymentProcessing ||
    paymentConfirmed;

    const creditReady =
    activationStatus
        ?.credit
        ?.available ===
    true;

    const readyToPublish =
    activationStatus
        ?.state ===
        "ready_to_publish" &&
    activationStatus
        ?.activation
        ?.canPublish ===
        true;

    const product2IsLive =
    activationStatus
        ?.state ===
        "active" ||
    activationStatus
        ?.distribution
        ?.published ===
        true;

    const currentRetailAssetId =
    draft
        ?.retailAssetId ||
    activationStatus
        ?.retailAssetId ||
    "";

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
                    IRL Retail Media
                </h1>

              <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">
                Already have content?
                Turn it into an
                interactive,
                measurable
                experience at the
                physical shelf.
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
                href="/brand/retail-media"
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50"
              >
                Activate Campaign Content
              </Link>
            </div>
          </header>

          {/* PRODUCT 2 PRICE SUMMARY */}

          <section className="mt-8 rounded-3xl border border-violet-200 bg-white p-6 shadow-lg">
            <div className="grid gap-5 md:grid-cols-[180px_1fr] md:items-center">

              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-violet-700">
                  Pay As You Go
                </p>

                <p className="mt-1 text-5xl font-black text-violet-950">
                  $99
                </p>

                <p className="mt-1 text-sm font-bold text-slate-600">
                  per video activation
                </p>
              </div>

              <div className="grid gap-2 text-sm font-semibold text-slate-700 sm:grid-cols-2">
                <p>
                  ✓ 1 video
                </p>

                <p>
                  ✓ 1 product
                </p>

                <p>
                  ✓ 90-day activation
                </p>

                <p>
                  ✓ Up to 1,000 qualified views
                </p>

                <p>
                  ✓ Shelf engagement tracking
                </p>

                <p>
                  ✓ No subscription required
                </p>
              </div>
            </div>
          </section>

          {/* ALERTS */}

          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700">
              {error}
            </div>
          )}

          {message && (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 font-semibold text-emerald-700">
              {message}
            </div>
          )}

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">

            {/* =================================================
                LEFT — CREATE ACTIVATION
               ================================================= */}

            <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl">

              <p className="text-sm font-black uppercase tracking-wide text-pink-600">
                Create Retail Media
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Bring Your Own Content
              </h2>

              <p className="mt-3 leading-7 text-slate-600">
                Upload an existing
                Brand or Creator
                video and connect it
                to the exact physical
                product shoppers will
                scan.
              </p>

              {/* STEP 1 */}

              <div className="mt-8">
                <h3 className="text-2xl font-black">
                  1. Identify the Product
                </h3>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">
                      Brand Name
                    </span>

                    <input
                      value={
                        brandName
                      }
                      onChange={(
                        event
                      ) => {
                        setBrandName(
                          event
                            .target
                            .value
                        );

                        setDraftResponse(
                          null
                        );
                      }}
                      placeholder="Example: e.l.f."
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">
                      Product Name
                    </span>

                    <input
                      value={
                        productName
                      }
                      onChange={(
                        event
                      ) => {
                        setProductName(
                          event
                            .target
                            .value
                        );

                        setDraftResponse(
                          null
                        );
                      }}
                      placeholder="Example: Halo Glow"
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="text-sm font-bold text-slate-700">
                        Link URL
                    </span>

                    <p className="mt-1 text-sm leading-6 text-slate-500">
                        Where should shoppers go when they tap the Link button?
                        This can be your product page, retailer page, campaign page,
                        social post, or another destination.
                    </p>

                    <input
                        type="url"
                        value={
                        linkUrl
                        }
                        onChange={(
                        event
                        ) => {
                        setLinkUrl(
                            event
                            .target
                            .value
                        );

                        setDraftResponse(
                            null
                        );
                        }}
                        placeholder="https://www.yourbrand.com/product"
                        className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                    />
                    </label>
                </div>
              </div>

              {/* STEP 2 */}

              <div className="mt-8 border-t border-slate-200 pt-7">
                <h3 className="text-2xl font-black">
                  2. Upload Your Video
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Upload the existing
                  content you want
                  shoppers to
                  experience at the
                  shelf.
                </p>

                <input
                  type="file"
                  accept=".mp4,.MP4,video/mp4"
                  onChange={(
                    event
                  ) =>
                    handleMediaChange(
                      event
                        .target
                        .files?.[0] ||
                        null
                    )
                  }
                  className="mt-5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
                />

                {mediaError && (
                  <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm font-bold leading-6 text-red-700">
                      {mediaError}
                    </p>
                  </div>
                )}

                <p className="mt-2 text-xs text-slate-500">
                  MP4 only. Maximum
                  250 MB.
                </p>

                {originalMedia && (
                  <div className="mt-5 rounded-2xl bg-slate-100 p-4">
                    <p className="font-bold">
                      {
                        originalMedia.name
                      }
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {formatBytes(
                        originalMedia.size
                      )}
                    </p>

                    {mediaPreviewUrl && (
                      <video
                        src={
                          mediaPreviewUrl
                        }
                        controls
                        playsInline
                        className="mt-4 max-h-[420px] w-full rounded-xl bg-black object-contain"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* STEP 3 */}

              <div className="mt-8 border-t border-slate-200 pt-7">
                <h3 className="text-2xl font-black">
                  3. Upload the Exact Product Image
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Use a clear,
                  front-facing image
                  of the exact package
                  shoppers will scan
                  in the Goshsha app.
                </p>

                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif"
                  onChange={(
                    event
                  ) =>
                    handleTargetImageChange(
                      event
                        .target
                        .files?.[0] ||
                        null
                    )
                  }
                  className="mt-5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
                />

                {targetImageError && (
                  <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm font-bold leading-6 text-red-700">
                      {targetImageError}
                    </p>
                  </div>
                )}

                {targetPreviewUrl && (
                  <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-4">
                    <img
                      src={
                        targetPreviewUrl
                      }
                      alt="Scannable product target"
                      className="mx-auto max-h-96 w-full object-contain"
                    />
                  </div>
                )}
              </div>

              {/* STEP 4 */}

              <div className="mt-8 border-t border-slate-200 pt-7">
                <h3 className="text-2xl font-black">
                  4. Verify Product Packaging Text
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Enter the important
                  Brand and product
                  words visible on the
                  package. Goshsha
                  uses this to resolve
                  the Product
                  Collection
                  recognized by the
                  app.
                </p>

                <textarea
                  value={
                    rawOcr
                  }
                  onChange={(
                    event
                  ) => {
                    setRawOcr(
                      event
                        .target
                        .value
                    );

                    setDraftResponse(
                      null
                    );
                  }}
                  placeholder="Example: e.l.f. Halo Glow Liquid Filter complexion booster"
                  className="mt-5 min-h-32 w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>

              {/* STEP 5 */}

              <div className="mt-8 border-t border-slate-200 pt-7">
                <h3 className="text-2xl font-black">
                  5. Content Ownership
                </h3>

                <div className="mt-5 grid gap-4">

                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4">
                    <input
                      type="radio"
                      checked={
                        ownershipType ===
                        "brand_owned"
                      }
                      onChange={() => {
                        setOwnershipType(
                          "brand_owned"
                        );

                        setExternalCreatorName(
                          ""
                        );

                        setDraftResponse(
                          null
                        );
                      }}
                      className="mt-1"
                    />

                    <span>
                      <span className="block font-black">
                        Brand-owned content
                      </span>

                      <span className="mt-1 block text-sm leading-6 text-slate-600">
                        Your Brand created,
                        commissioned or
                        otherwise owns or
                        controls the content.
                      </span>
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4">
                    <input
                      type="radio"
                      checked={
                        ownershipType ===
                        "external_creator"
                      }
                      onChange={() => {
                        setOwnershipType(
                          "external_creator"
                        );

                        setDraftResponse(
                          null
                        );
                      }}
                      className="mt-1"
                    />

                    <span>
                      <span className="block font-black">
                        External Creator content
                      </span>

                      <span className="mt-1 block text-sm leading-6 text-slate-600">
                        The content was
                        created by a Creator
                        outside the Goshsha
                        Creator Network.
                      </span>
                    </span>
                  </label>
                </div>

                {ownershipType ===
                  "external_creator" && (
                  <label className="mt-5 block">
                    <span className="text-sm font-bold text-slate-700">
                      Creator Name
                    </span>

                    <input
                      value={
                        externalCreatorName
                      }
                      onChange={(
                        event
                      ) => {
                        setExternalCreatorName(
                          event
                            .target
                            .value
                        );

                        setDraftResponse(
                          null
                        );
                      }}
                      placeholder="Creator or content owner"
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                    />
                  </label>
                )}
              </div>

              {/* STEP 6 */}

              <div className="mt-8 border-t border-slate-200 pt-7">
                <h3 className="text-2xl font-black">
                  6. Rights Certification
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Before Goshsha can
                  distribute this
                  content in physical
                  retail, confirm that
                  your Brand has the
                  required permissions.
                </p>

                <div className="mt-5 space-y-4">

                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={
                        contentRightsConfirmed
                      }
                      onChange={(
                        event
                      ) =>
                        setContentRightsConfirmed(
                          event
                            .target
                            .checked
                        )
                      }
                      className="mt-1"
                    />

                    <span className="text-sm leading-6">
                      <strong>
                        Content rights.
                      </strong>{" "}
                      I confirm that
                      the Brand owns
                      or has permission
                      to use this
                      content for this
                      activation.
                    </span>
                  </label>

                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={
                        appearanceRightsConfirmed
                      }
                      onChange={(
                        event
                      ) =>
                        setAppearanceRightsConfirmed(
                          event
                            .target
                            .checked
                        )
                      }
                      className="mt-1"
                    />

                    <span className="text-sm leading-6">
                      <strong>
                        Appearance rights.
                      </strong>{" "}
                      I confirm that
                      any people
                      appearing in the
                      content may be
                      shown in this
                      retail activation.
                    </span>
                  </label>

                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={
                        brandUsageApproved
                      }
                      onChange={(
                        event
                      ) =>
                        setBrandUsageApproved(
                          event
                            .target
                            .checked
                        )
                      }
                      className="mt-1"
                    />

                    <span className="text-sm leading-6">
                      <strong>
                        Brand usage.
                      </strong>{" "}
                      I authorize this
                      content to be
                      associated with
                      the identified
                      product.
                    </span>
                  </label>

                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={
                        distributionLicenseGranted
                      }
                      onChange={(
                        event
                      ) =>
                        setDistributionLicenseGranted(
                          event
                            .target
                            .checked
                        )
                      }
                      className="mt-1"
                    />

                    <span className="text-sm leading-6">
                      <strong>
                        Goshsha distribution.
                      </strong>{" "}
                      I authorize
                      Goshsha to
                      distribute the
                      content through
                      this Retail Media
                      activation.
                    </span>
                  </label>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={
                          audioRightsConfirmed
                        }
                        onChange={(
                          event
                        ) =>
                          setAudioRightsConfirmed(
                            event
                              .target
                              .checked
                          )
                        }
                        className="mt-1"
                      />

                      <span className="text-sm leading-6">
                        <strong>
                          Audio rights
                          confirmed.
                        </strong>{" "}
                        I confirm the
                        Brand has the
                        right to
                        distribute the
                        video's audio
                        track.
                      </span>
                    </label>

                    <p className="mt-3 text-xs leading-5 text-amber-800">
                      Optional. If you
                      cannot confirm
                      audio rights,
                      Goshsha can keep
                      the Retail Media
                      video muted.
                    </p>
                  </div>
                </div>
              </div>

              {/* CREATE DRAFT */}

              <button
                type="button"
                onClick={
                  handleCreateDraft
                }
                disabled={
                  creatingDraft ||
                  !formReady ||
                  Boolean(draft)
                }
                className={
                  `mt-8 w-full rounded-xl px-6 py-4 text-lg font-black text-white shadow-lg disabled:cursor-not-allowed ${
                    draft
                      ? "bg-emerald-600"
                      : "bg-pink-600 hover:bg-pink-700 disabled:opacity-50"
                  }`
                }
              >
                {creatingDraft
                  ? "Creating Retail Media Draft..."
                  : draft
                    ? "✓ Product Resolved — Retail Media Draft Created"
                    : "Resolve Product and Create Retail Media Draft"}
              </button>

              {draft && (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
                  <p className="font-bold text-emerald-800">
                    Success! Your product has been resolved and your Retail Media draft is ready.
                  </p>

                  <p className="mt-1 text-sm text-emerald-700">
                    Continue to the Retail Media Review section to purchase and activate it.
                  </p>
                </div>
              )}

              {!formReady &&
                !draft && (
                <p className="mt-3 text-center text-xs text-slate-500">
                  Complete the
                  product, media,
                  target image and
                  required rights
                  sections to
                  continue.
                </p>
              )}
            </section>

            {/* =================================================
                RIGHT — REVIEW
               ================================================= */}

            <section className="space-y-6">

              <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl">

                <p className="text-sm font-black uppercase tracking-wide text-pink-600">
                  Product Resolution
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Retail Media Review
                </h2>

                {!draft ? (
                  <div className="mt-5 rounded-2xl bg-slate-100 p-5 text-sm leading-6 text-slate-600">
                    Complete the
                    IRL Retail Media form to
                    resolve the
                    scannable product
                    and create the
                    Retail Asset.
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">

                    <div className="rounded-2xl bg-slate-100 p-5">

                      <p className="text-xs font-black uppercase tracking-wide text-pink-600">
                        Resolved Product
                      </p>

                      <h3 className="mt-2 text-xl font-black">
                        {
                          resolution
                            ?.canonicalName
                        }
                      </h3>

                        <div className="mt-4 space-y-3 text-sm">
                        <p>
                            <strong>
                            Brand:
                            </strong>{" "}
                            {brandName}
                        </p>

                        <p>
                            <strong>
                            Product:
                            </strong>{" "}
                            {productName}
                        </p>

                        <p>
                            <strong>
                            Source:
                            </strong>{" "}
                            IRL Retail Media
                        </p>
                        </div>
                    </div>

                    {draftResponse
                      ?.targetImage
                      ?.url && (
                      <div className="rounded-2xl border border-slate-200 p-5">

                        <p className="text-xs font-black uppercase tracking-wide text-pink-600">
                          Scannable Target
                        </p>

                        <img
                          src={
                            draftResponse
                              .targetImage
                              .url
                          }
                          alt="Published scan target"
                          className="mt-4 max-h-80 w-full rounded-xl bg-slate-100 object-contain"
                        />

                        <p className="mt-3 text-xs text-slate-500">
                          This is the
                          exact product
                          image linked
                          to this Retail
                          Asset.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* COMMERCE */}

              <div className="rounded-3xl border border-violet-200 bg-white p-7 shadow-xl">

                <p className="text-sm font-black uppercase tracking-wide text-violet-700">
                  Activation
                </p>

                <h2 className="mt-2 text-2xl font-black">
                IRL Retail Media Activation
                </h2>

                {!draft ? (
                  <div className="mt-5 rounded-2xl bg-slate-100 p-5 text-sm text-slate-600">
                    Activation
                    details appear
                    after the Retail
                    Media draft is
                    created.
                  </div>
                ) : (
                  <>
                    <div className="mt-5 rounded-2xl bg-violet-50 p-5">
                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <p className="text-sm font-bold text-violet-800">
                            Single Video
                            Activation
                          </p>

                          <p className="mt-1 text-4xl font-black text-violet-950">
                            $
                            {
                              commerce
                                ?.priceUsd ??
                              99
                            }
                          </p>
                        </div>

                        <span
                        className={
                            product2IsLive
                            ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase text-emerald-800"
                            : paymentConfirmed
                            ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase text-emerald-800"
                            : "rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase text-amber-800"
                        }
                        >
                        {product2IsLive
                            ? "active"
                            : paymentConfirmed
                            ? "paid"
                            : activationStatus
                                ?.payment
                                ?.status ||
                            commerce
                                ?.paymentStatus ||
                            "payment required"}
                        </span>
                      </div>

                      <div className="mt-5 grid gap-2 text-sm text-slate-700">
                        <p>
                          ✓ 90 days
                        </p>

                        <p>
                          ✓ Up to{" "}
                          {(
                            commerce
                              ?.includedQualifiedViews ??
                            1000
                          ).toLocaleString()}{" "}
                          qualified
                          views
                        </p>

                        <p>
                          ✓ Product
                          recognition
                        </p>

                        <p>
                          ✓ App
                          distribution
                        </p>

                        <p>
                          ✓ Basic shelf
                          analytics
                        </p>
                      </div>
                    </div>

                    {!product2IsLive && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                        <p className="font-black text-amber-900">
                          Draft — not yet scan-ready
                        </p>

                        <p className="mt-3 text-sm leading-6 text-amber-800">
                          Your Retail Asset exists, but the activation has not been purchased or published. The 90-day activation has not started.
                        </p>
                      </div>
                    )}

                    {loadingActivationStatus ? (
                        <div className="mt-4 rounded-2xl bg-slate-100 p-5 text-center">
                            <p className="font-bold text-slate-700">
                            Verifying activation status...
                            </p>
                        </div>
                        ) : product2IsLive ? (
                        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                            <p className="text-lg font-black text-emerald-900">
                            ✓ Active and Scan-Ready
                            </p>

                            <p className="mt-2 text-sm leading-6 text-emerald-800">
                            This Retail Media activation is now live in the Goshsha
                            experience. The activation period and qualified-view
                            tracking are underway.
                            </p>
                        </div>
                        ) : readyToPublish ? (
                        <>
                            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

                            <p className="text-lg font-black text-emerald-900">
                                Ready to Publish
                            </p>

                            <div className="mt-4 space-y-2 text-sm text-emerald-800">
                                <p>
                                ✓ Payment confirmed
                                </p>

                                <p>
                                ✓ Activation credit issued
                                </p>

                                <p>
                                ✓ Activation credit available
                                </p>

                                <p>
                                ✓{" "}
                                {(
                                    activationStatus
                                    ?.credit
                                    ?.includedQualifiedViews ??
                                    1000
                                ).toLocaleString()}{" "}
                                qualified views included
                                </p>

                                <p>
                                ✓{" "}
                                {
                                    activationStatus
                                    ?.credit
                                    ?.activationDays ??
                                    90
                                }-day activation
                                </p>
                            </div>
                            </div>

                            <button
                            type="button"
                            onClick={
                                handlePublishProduct2
                            }
                            disabled={
                                publishing
                            }
                            className="mt-4 w-full rounded-xl bg-slate-950 px-5 py-4 text-lg font-black text-white shadow-lg hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                            {publishing
                                ? "Publishing Retail Media..."
                                : "Publish AR and Make Scan-Ready"}
                            </button>

                            <p className="mt-2 text-center text-xs leading-5 text-slate-500">
                            Publishing consumes this activation credit and starts
                            the 90-day activation period.
                            </p>
                        </>
                        ) : paymentConfirmed ? (
                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                            <p className="font-black text-amber-900">
                            Payment confirmed — preparing activation credit
                            </p>

                            <p className="mt-2 text-sm leading-6 text-amber-800">
                            Stripe confirmed your payment. Goshsha is completing
                            the activation entitlement. This normally takes only
                            a moment.
                            </p>

                            <button
                            type="button"
                            onClick={() => {
                                if (
                                currentRetailAssetId
                                ) {
                                loadActivationStatus(
                                    currentRetailAssetId
                                );
                                }
                            }}
                            className="mt-4 rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-900"
                            >
                            Refresh Activation Status
                            </button>
                        </div>
                        ) : (
                        <>
                            <button
                            type="button"
                            onClick={
                                handlePurchaseActivation
                            }
                            disabled={
                              purchaseLocked
                            }
                            className="mt-4 w-full rounded-xl bg-violet-700 px-5 py-4 font-black text-white shadow-lg hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                            {startingCheckout
                              ? "Opening Secure Checkout..."
                              : paymentProcessing
                                ? "Confirming Payment..."
                                : paymentConfirmed
                                  ? "Payment Confirmed"
                                  : "Purchase $99 Activation"}
                            </button>

                            <p className="mt-2 text-center text-xs leading-5 text-slate-500">
                            Secure payment through Stripe. Purchasing does not
                            start the 90-day activation. The activation begins
                            only when you publish this Retail Asset.
                            </p>
                        </>
                        )}
                  </>
                )}
              </div>

              {/* ARCHITECTURE */}

              <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl">

                <h2 className="text-xl font-black">
                  What happens next
                </h2>

                <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600">

                  <p>
                    <strong className="text-slate-950">
                      1. Retail Asset
                    </strong>{" "}
                    — your uploaded
                    content, rights,
                    product identity
                    and activation
                    record are stored.
                  </p>

                  <p>
                    <strong className="text-slate-950">
                      2. Purchase
                    </strong>{" "}
                    — one IRL Retail Media
                    activation credit
                    is purchased or
                    applied.
                  </p>

                  <p>
                    <strong className="text-slate-950">
                      3. Publish
                    </strong>{" "}
                    — the content is
                    projected into the
                    Product Master
                    playlist.
                  </p>

                  <p>
                    <strong className="text-slate-950">
                      4. Scan
                    </strong>{" "}
                    — shoppers scan
                    the physical
                    product and
                    experience the
                    Retail Media in
                    the Goshsha app.
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