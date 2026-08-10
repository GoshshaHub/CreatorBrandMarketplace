import { randomUUID } from "crypto";

import {
  adminStorage,
} from "../firebase-admin";

export type PlaybackCopyInput = {
  retailAssetId: string;

  sourceStoragePath: string;
  sourceUrl: string;

  campaignId?: string | null;
  creatorId?: string | null;
  brandId?: string | null;

  contentType?: string | null;
};

export type PlaybackCopyResult = {
  sourceUrl: string;
  sourceStoragePath: string;

  playbackUrl: string;
  playbackStoragePath: string;

  contentType: string;

  reusedExistingCopy: boolean;
};

function cleanRequiredString(
  value: unknown,
  fieldName: string
): string {
  const cleaned =
    typeof value === "string"
      ? value.trim()
      : "";

  if (!cleaned) {
    throw new Error(
      `${fieldName} is required.`
    );
  }

  return cleaned;
}

function cleanOptionalString(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned =
    value.trim();

  return cleaned || null;
}

function isMp4Media(
  params: {
    sourceStoragePath: string;
    contentType: string | null;
  }
): boolean {
  const {
    sourceStoragePath,
    contentType,
  } = params;

  const lowerPath =
    sourceStoragePath.toLowerCase();

  const lowerContentType =
    (contentType || "")
      .toLowerCase();

  return (
    lowerPath.endsWith(".mp4") ||
    lowerContentType === "video/mp4"
  );
}

function firebaseDownloadUrl(
  params: {
    bucketName: string;
    storagePath: string;
    token: string;
  }
): string {
  const {
    bucketName,
    storagePath,
    token,
  } = params;

  return (
    "https://firebasestorage.googleapis.com/v0/b/" +
    `${encodeURIComponent(bucketName)}/o/` +
    `${encodeURIComponent(storagePath)}` +
    `?alt=media&token=${encodeURIComponent(token)}`
  );
}

/*
 * =========================================================
 * Create iOS-Compatible Playback Copy
 * =========================================================
 *
 * Creator's original media remains untouched:
 *
 * creator-submissions/.../original.MP4
 *
 * Production playback copy becomes:
 *
 * retail-media-playback/{retailAssetId}.mp4
 *
 * This is intentionally a STORAGE COPY, not transcoding.
 *
 * Therefore this helper currently accepts genuine MP4 media
 * only. A MOV/M4V file should eventually go through a real
 * transcoding service rather than merely being renamed.
 */
export async function createPlaybackCopy(
  input: PlaybackCopyInput
): Promise<PlaybackCopyResult> {
  const retailAssetId =
    cleanRequiredString(
      input.retailAssetId,
      "retailAssetId"
    );

  const sourceStoragePath =
    cleanRequiredString(
      input.sourceStoragePath,
      "sourceStoragePath"
    );

  const sourceUrl =
    cleanRequiredString(
      input.sourceUrl,
      "sourceUrl"
    );

  const contentType =
    cleanOptionalString(
      input.contentType
    ) || "video/mp4";

  /*
   * Do not pretend a MOV file is an MP4 merely by changing
   * its extension. For this Phase 1 playback bridge we only
   * canonicalize genuine MP4 files.
   */
  if (
    !isMp4Media({
      sourceStoragePath,
      contentType,
    })
  ) {
    throw new Error(
      "PLAYBACK_COPY_REQUIRES_MP4"
    );
  }

  const bucket =
    adminStorage.bucket();

  const sourceFile =
    bucket.file(
      sourceStoragePath
    );

  const playbackStoragePath =
    `retail-media-playback/${retailAssetId}.mp4`;

  const playbackFile =
    bucket.file(
      playbackStoragePath
    );

  /*
   * If the standardized playback object already exists,
   * reuse it. This makes publication/republication safe.
   */
  const [
    playbackExists,
  ] =
    await playbackFile.exists();

  if (playbackExists) {
    const [
      metadata,
    ] =
      await playbackFile.getMetadata();

    const existingToken =
      String(
        metadata.metadata
          ?.firebaseStorageDownloadTokens ||
          ""
      )
        .split(",")
        .map((value) =>
          value.trim()
        )
        .filter(Boolean)[0];

    const token =
      existingToken ||
      randomUUID();

    if (!existingToken) {
      await playbackFile.setMetadata({
        contentType:
          "video/mp4",

        cacheControl:
          "public,max-age=3600",

        metadata: {
          ...(metadata.metadata ||
            {}),

          firebaseStorageDownloadTokens:
            token,

          retailAssetId,

          campaignId:
            cleanOptionalString(
              input.campaignId
            ) || "",

          creatorId:
            cleanOptionalString(
              input.creatorId
            ) || "",

          brandId:
            cleanOptionalString(
              input.brandId
            ) || "",

          playbackPurpose:
            "ios_retail_media",
        },
      });
    }

    return {
      sourceUrl,
      sourceStoragePath,

      playbackUrl:
        firebaseDownloadUrl({
          bucketName:
            bucket.name,

          storagePath:
            playbackStoragePath,

          token,
        }),

      playbackStoragePath,

      contentType:
        "video/mp4",

      reusedExistingCopy:
        true,
    };
  }

  /*
   * Confirm the Creator's original object actually exists.
   */
  const [
    sourceExists,
  ] =
    await sourceFile.exists();

  if (!sourceExists) {
    throw new Error(
      "SOURCE_MEDIA_NOT_FOUND"
    );
  }

  /*
   * Server-side Storage copy.
   *
   * No video bytes are downloaded into the Vercel process,
   * which avoids loading a potentially large Creator video
   * into server memory.
   */
  await sourceFile.copy(
    playbackFile
  );

  const downloadToken =
    randomUUID();

  await playbackFile.setMetadata({
    contentType:
      "video/mp4",

    cacheControl:
      "public,max-age=3600",

    metadata: {
      firebaseStorageDownloadTokens:
        downloadToken,

      retailAssetId,

      campaignId:
        cleanOptionalString(
          input.campaignId
        ) || "",

      creatorId:
        cleanOptionalString(
          input.creatorId
        ) || "",

      brandId:
        cleanOptionalString(
          input.brandId
        ) || "",

      sourceStoragePath,

      playbackPurpose:
        "ios_retail_media",
    },
  });

  const playbackUrl =
    firebaseDownloadUrl({
      bucketName:
        bucket.name,

      storagePath:
        playbackStoragePath,

      token:
        downloadToken,
    });

  return {
    sourceUrl,
    sourceStoragePath,

    playbackUrl,
    playbackStoragePath,

    contentType:
      "video/mp4",

    reusedExistingCopy:
      false,
  };
}