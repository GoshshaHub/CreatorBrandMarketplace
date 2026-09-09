import { createHash } from "crypto";
import { Timestamp } from "firebase-admin/firestore";

import {
  adminDb,
  adminStorage,
  getGoogleCloudAccessToken,
} from "../firebase-admin";

export const MAX_VISION_IMAGE_BYTES = 20 * 1024 * 1024;
export const TARGET_IMAGE_OCR_PROVIDER = "google_cloud_vision";
export const TARGET_IMAGE_OCR_VERSION = "document-text-detection-v1";

export type TargetImageOcrResult = {
  originalText: string;
  confidence: number | null;
  provider: typeof TARGET_IMAGE_OCR_PROVIDER;
  version: typeof TARGET_IMAGE_OCR_VERSION;
  targetSha256: string;
  extractedAt: unknown;
  cacheHit: boolean;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function meanWordConfidence(annotation: any): number | null {
  const values: number[] = [];
  for (const page of annotation?.pages || []) {
    for (const block of page?.blocks || []) {
      for (const paragraph of block?.paragraphs || []) {
        for (const word of paragraph?.words || []) {
          if (Number.isFinite(word?.confidence)) values.push(Number(word.confidence));
        }
      }
    }
  }
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function extractTargetImageOcr(params: {
  storagePath: string;
  brandUserId: string;
  allowPermanentFirstFreeTarget?: boolean;
}): Promise<TargetImageOcrResult> {
  const stagedPrefix = `retail-media-direct-uploads/${params.brandUserId}/target/`;
  const permanentPrefix = `retail-media-targets/${params.brandUserId}/rm-free-${params.brandUserId}/`;
  const pathAllowed = params.storagePath.startsWith(stagedPrefix) ||
    (params.allowPermanentFirstFreeTarget === true && params.storagePath.startsWith(permanentPrefix));
  if (!pathAllowed) throw new Error("Invalid Retail Media target-image path.");

  const bucket = adminStorage.bucket();
  const file = bucket.file(params.storagePath);
  const [exists] = await file.exists();
  if (!exists) throw new Error("The uploaded product image could not be found.");
  const [metadata] = await file.getMetadata();
  const sizeBytes = Number(metadata.size || 0);
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new Error("The uploaded product image appears to be empty.");
  }
  if (sizeBytes > MAX_VISION_IMAGE_BYTES) {
    throw new Error("The product image must be 20 MB or smaller for packaging recognition.");
  }

  const [bytes] = await file.download();
  const targetSha256 = createHash("sha256").update(bytes).digest("hex");
  const cacheRef = adminDb.collection("retailMediaOcr").doc(targetSha256);
  const cached = await cacheRef.get();
  if (cached.exists) {
    const data = cached.data() || {};
    if (clean(data.provider) === TARGET_IMAGE_OCR_PROVIDER && clean(data.version) === TARGET_IMAGE_OCR_VERSION) {
      return {
        originalText: clean(data.originalText),
        confidence: Number.isFinite(data.confidence) ? Number(data.confidence) : null,
        provider: TARGET_IMAGE_OCR_PROVIDER,
        version: TARGET_IMAGE_OCR_VERSION,
        targetSha256,
        extractedAt: data.extractedAt || null,
        cacheHit: true,
      };
    }
  }

  const accessToken = await getGoogleCloudAccessToken();
  const response = await fetch("https://vision.googleapis.com/v1/images:annotate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "x-goog-user-project": process.env.FIREBASE_PROJECT_ID || "",
    },
    body: JSON.stringify({
      requests: [{
        image: { source: { imageUri: `gs://${bucket.name}/${params.storagePath}` } },
        features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
      }],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Packaging recognition failed (${response.status}). Please try again.`);
  }
  const payload = await response.json() as any;
  const result = payload?.responses?.[0];
  if (result?.error) {
    throw new Error(clean(result.error.message) || "Packaging recognition failed. Please try again.");
  }
  const originalText = clean(result?.fullTextAnnotation?.text);
  const confidence = meanWordConfidence(result?.fullTextAnnotation);
  const extractedAt = Timestamp.now();
  await cacheRef.set({
    originalText,
    confidence,
    provider: TARGET_IMAGE_OCR_PROVIDER,
    version: TARGET_IMAGE_OCR_VERSION,
    targetSha256,
    extractedAt,
  }, { merge: false });

  return {
    originalText,
    confidence,
    provider: TARGET_IMAGE_OCR_PROVIDER,
    version: TARGET_IMAGE_OCR_VERSION,
    targetSha256,
    extractedAt,
    cacheHit: false,
  };
}
