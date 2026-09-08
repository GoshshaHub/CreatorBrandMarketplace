import { randomUUID } from "crypto";

import { adminStorage } from "../firebase-admin";

export type VerifiedRetailMediaUpload = {
  storagePath: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function downloadUrl(bucketName: string, objectName: string, token: string): string {
  return (
    "https://firebasestorage.googleapis.com/v0/b/" +
    `${encodeURIComponent(bucketName)}/o/${encodeURIComponent(objectName)}` +
    `?alt=media&token=${encodeURIComponent(token)}`
  );
}

export async function verifyRetailMediaStagedUpload(params: {
  storagePath: string;
  brandUserId: string;
  kind: "media" | "target";
}): Promise<VerifiedRetailMediaUpload> {
  const expectedPrefix =
    `retail-media-direct-uploads/${params.brandUserId}/${params.kind}/`;
  if (!params.storagePath.startsWith(expectedPrefix)) {
    throw new Error("Invalid Retail Media upload path.");
  }

  const file = adminStorage.bucket().file(params.storagePath);
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(
      params.kind === "media"
        ? "The uploaded video could not be found."
        : "The uploaded product image could not be found."
    );
  }

  const [metadata] = await file.getMetadata();
  const sizeBytes = Number(metadata.size || 0);
  const originalName = clean(metadata.metadata?.originalFileName);
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new Error("The uploaded file appears to be empty.");
  }
  if (!originalName) {
    throw new Error("Uploaded file metadata is incomplete.");
  }

  return {
    storagePath: params.storagePath,
    originalName,
    contentType: clean(metadata.contentType),
    sizeBytes,
  };
}

export async function promoteRetailMediaStagedUpload(params: {
  sourcePath: string;
  destinationPath: string;
  contentType: string;
  metadata: Record<string, string>;
}): Promise<{ url: string; storagePath: string }> {
  const bucket = adminStorage.bucket();
  const source = bucket.file(params.sourcePath);
  const destination = bucket.file(params.destinationPath);

  const [destinationExists] = await destination.exists();
  if (!destinationExists) {
    const [sourceExists] = await source.exists();
    if (!sourceExists) {
      throw new Error("The staged upload is no longer available.");
    }
    await source.copy(destination);
  }

  const [existingMetadata] = await destination.getMetadata();
  const existingToken = clean(
    existingMetadata.metadata?.firebaseStorageDownloadTokens
  );
  const token = existingToken || randomUUID();
  await destination.setMetadata({
    contentType: params.contentType,
    cacheControl: "public,max-age=3600",
    metadata: {
      ...(existingMetadata.metadata || {}),
      firebaseStorageDownloadTokens: token,
      ...params.metadata,
    },
  });

  return {
    url: downloadUrl(bucket.name, params.destinationPath, token),
    storagePath: params.destinationPath,
  };
}
