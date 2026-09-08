import { ref, uploadBytesResumable } from "firebase/storage";

import { storage } from "../firebase";

export const MAX_RETAIL_MEDIA_VIDEO_BYTES = 250 * 1024 * 1024;
export const MAX_RETAIL_MEDIA_TARGET_BYTES = 25 * 1024 * 1024;

export type RetailMediaUploadKind = "media" | "target";

export function isMp4File(file: File | null): boolean {
  if (!file) return false;
  return file.name.toLowerCase().endsWith(".mp4");
}

export function isHeicFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return (
    name.endsWith(".heic") ||
    name.endsWith(".heif") ||
    type === "image/heic" ||
    type === "image/heif"
  );
}

export async function normalizeRetailMediaTargetImage(file: File): Promise<File> {
  if (!isHeicFile(file)) return file;

  const heic2anyModule = await import("heic2any");
  const converted = await heic2anyModule.default({
    blob: file,
    toType: "image/jpeg",
    quality: 0.92,
  });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  const baseName = file.name.replace(/\.(heic|heif)$/i, "");

  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}

function safeUploadFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

export async function uploadRetailMediaFile(params: {
  file: File;
  userId: string;
  kind: RetailMediaUploadKind;
  onProgress?: (progress: number) => void;
}): Promise<string> {
  const safeName = safeUploadFileName(params.file.name);
  const storagePath =
    `retail-media-direct-uploads/${params.userId}/${params.kind}/` +
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeName}`;
  const uploadPurpose =
    params.kind === "media"
      ? "retail_media_direct_source"
      : "retail_media_direct_target";
  const uploadTask = uploadBytesResumable(ref(storage, storagePath), params.file, {
    contentType: params.file.type || undefined,
    customMetadata: {
      originalFileName: params.file.name,
      uploadPurpose,
    },
  });

  await new Promise<void>((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = snapshot.totalBytes
          ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          : 0;
        params.onProgress?.(progress);
      },
      reject,
      resolve
    );
  });

  return storagePath;
}
