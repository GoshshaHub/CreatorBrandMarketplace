import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

import { adminDb } from "../firebase-admin";

import {
  isRetailAssetPlaylistEligible,
  type RetailAssetFields,
} from "../retail-media";

/*
 * =========================================================
 * Master Playlist Builder
 * =========================================================
 *
 * This service projects eligible AR Entries into the exact
 * Firestore contract currently consumed by the Goshsha iOS
 * application:
 *
 * masters/{collectionId}
 *   └── ar_playlist: [...]
 *
 * It does not:
 *
 * - create Product Collections
 * - create Retail Assets
 * - create AR Entries
 * - activate licenses
 * - activate Retail Assets
 * - alter campaign payout
 */

export const MASTER_PLAYLIST_SCHEMA_VERSION =
  2;

type FirestoreEntry =
  Record<string, any>;

export type MasterPlaylistRow = {
  entryId: string;
  collection: string;

  augmented_url: string;
  arcontent_url: string;

  created_at: Timestamp;
  updated_at: Timestamp;

  votes_up: number;
  votes_down: number;
  views: number;
  shares: number;

  /*
   * Additional metadata is ignored safely by the current
   * iOS app but will support future app versions.
   */
  retailAssetId?: string | null;
  campaignId?: string | null;
  creatorId?: string | null;
  brandId?: string | null;

  playback?: unknown;
  activation?: unknown;
  license?: unknown;

  retailAssetSchemaVersion?:
    | number
    | null;
};

export type RebuildMasterPlaylistResult = {
  collectionId: string;

  playlistItemCount: number;

  eligibleEntryIds: string[];
  excludedEntryIds: string[];

  masterPlaylistPath: string;

  playlistSchemaVersion: number;
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
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function toTimestamp(
  value: unknown
): Timestamp | null {
  if (value instanceof Timestamp) {
    return value;
  }

  if (value instanceof Date) {
    return Timestamp.fromDate(
      value
    );
  }

  /*
   * Supports Firestore timestamp-like values returned from
   * serialized records without accepting arbitrary objects.
   */
  if (
    value &&
    typeof value === "object" &&
    typeof (value as any).toDate ===
      "function"
  ) {
    const date =
      (value as any).toDate();

    if (
      date instanceof Date &&
      !Number.isNaN(
        date.getTime()
      )
    ) {
      return Timestamp.fromDate(
        date
      );
    }
  }

  return null;
}

function getEntryCreatedAt(
  entry: FirestoreEntry
): Timestamp {
  return (
    toTimestamp(
      entry.created_at
    ) ||
    toTimestamp(
      entry.createdAt
    ) ||
    toTimestamp(
      entry.audit?.createdAt
    ) ||
    Timestamp.now()
  );
}

function getEntryUpdatedAt(
  entry: FirestoreEntry
): Timestamp {
  return (
    toTimestamp(
      entry.updated_at
    ) ||
    toTimestamp(
      entry.updatedAt
    ) ||
    toTimestamp(
      entry.audit?.updatedAt
    ) ||
    getEntryCreatedAt(entry)
  );
}

function getAugmentedUrl(
  entry: FirestoreEntry
): string {
  return cleanOptionalString(
    entry["Augmented URL"] ||
      entry.augmentedUrl ||
      entry.augmented_url ||
      entry.media?.url
  );
}

function getArContentUrl(
  entry: FirestoreEntry
): string {
  return cleanOptionalString(
    entry["ARContent URL"] ||
      entry.arContentUrl ||
      entry.arcontent_url ||
      entry.publicPostUrl ||
      entry.sourceContentUrl
  );
}

function getNumericMetric(
  entry: FirestoreEntry,
  legacyField: string,
  nestedField: string
): number {
  const legacyNumber =
    Number(
      entry[legacyField]
    );

  if (
    Number.isFinite(
      legacyNumber
    )
  ) {
    return Math.max(
      legacyNumber,
      0
    );
  }

  const nestedNumber =
    Number(
      entry.metrics?.[
        nestedField
      ]
    );

  if (
    Number.isFinite(
      nestedNumber
    )
  ) {
    return Math.max(
      nestedNumber,
      0
    );
  }

  return 0;
}

/*
 * Existing production entries predate the Retail Asset
 * schema. They must remain eligible when rebuilding a master
 * playlist, or currently live AR could disappear.
 */
function isLegacyEntry(
  entry: FirestoreEntry
): boolean {
  return !(
    entry
      .retailAssetSchemaVersion ||
    entry.audit?.schemaVersion ||
    entry.retailAssetId
  );
}

function hasAugmentedMedia(
  entry: FirestoreEntry
): boolean {
  return Boolean(
    getAugmentedUrl(entry)
  );
}

/*
 * Legacy entries retain their existing behavior.
 *
 * New Retail Asset entries must satisfy the shared rights,
 * license, activation, and playback rules before entering the
 * production playlist.
 */
export function isEntryPlaylistEligible(
  entry: FirestoreEntry
): boolean {
  if (
    !hasAugmentedMedia(entry)
  ) {
    return false;
  }

  if (isLegacyEntry(entry)) {
    return true;
  }

  if (
    !entry.rights ||
    !entry.license ||
    !entry.activation ||
    !entry.playback
  ) {
    return false;
  }

  return isRetailAssetPlaylistEligible(
    entry as RetailAssetFields
  );
}

/*
 * Produces the exact projection consumed by the current iOS
 * ARPlaylistService.
 *
 * Do not rename these snake_case fields without first
 * updating and deploying the iOS application.
 */
export function projectEntryToPlaylistRow(
  params: {
    collectionId: string;
    entryId: string;
    entry: FirestoreEntry;
  }
): MasterPlaylistRow {
  const collectionId =
    cleanRequiredString(
      params.collectionId,
      "collectionId"
    );

  const entryId =
    cleanRequiredString(
      params.entryId,
      "entryId"
    );

  const entry =
    params.entry;

  const augmentedUrl =
    getAugmentedUrl(entry);

  if (!augmentedUrl) {
    throw new Error(
      `Entry ${entryId} does not contain an Augmented URL.`
    );
  }

  const creatorId =
    cleanOptionalString(
      entry.creatorId ||
        entry.ownership
          ?.creatorId ||
        entry.user_id
    ) || null;

  const brandId =
    cleanOptionalString(
      entry.brandId ||
        entry.ownership
          ?.brandId
    ) || null;

  return {
    /*
     * Existing iOS contract.
     */
    entryId,

    collection:
      collectionId,

    augmented_url:
      augmentedUrl,

    arcontent_url:
      getArContentUrl(entry),

    created_at:
      getEntryCreatedAt(
        entry
      ),

    updated_at:
      getEntryUpdatedAt(
        entry
      ),

    votes_up:
      getNumericMetric(
        entry,
        "votes_up",
        "votesUp"
      ),

    votes_down:
      getNumericMetric(
        entry,
        "votes_down",
        "votesDown"
      ),

    views:
      getNumericMetric(
        entry,
        "views",
        "views"
      ),

    shares:
      getNumericMetric(
        entry,
        "shares",
        "shares"
      ),

    /*
     * Future-facing metadata. The current app ignores fields
     * it does not recognize.
     */
    retailAssetId:
      cleanOptionalString(
        entry.retailAssetId
      ) || null,

    campaignId:
      cleanOptionalString(
        entry.campaignId
      ) || null,

    creatorId,

    brandId,

    playback:
      entry.playback ||
      null,

    activation:
      entry.activation ||
      null,

    license:
      entry.license ||
      null,

    retailAssetSchemaVersion:
      Number.isFinite(
        Number(
          entry
            .retailAssetSchemaVersion
        )
      )
        ? Number(
            entry
              .retailAssetSchemaVersion
          )
        : null,
  };
}

/*
 * Rebuilds the complete master playlist from the authoritative
 * Product Collection entries.
 *
 * Firestore path read:
 *
 * {collectionId}/_meta/entries/*
 *
 * Firestore path written:
 *
 * masters/{collectionId}
 */
export async function rebuildMasterPlaylist(
  collectionIdInput: string
): Promise<RebuildMasterPlaylistResult> {
  const collectionId =
    cleanRequiredString(
      collectionIdInput,
      "collectionId"
    );

  const entriesRef =
    adminDb
      .collection(
        collectionId
      )
      .doc("_meta")
      .collection(
        "entries"
      );

  const entriesSnapshot =
    await entriesRef.get();

  const eligibleEntries: Array<{
    entryId: string;
    entry: FirestoreEntry;
  }> = [];

  const excludedEntryIds:
    string[] = [];

  for (
    const document
    of entriesSnapshot.docs
  ) {
    const entry =
      document.data();

    if (
      isEntryPlaylistEligible(
        entry
      )
    ) {
      eligibleEntries.push({
        entryId:
          document.id,

        entry,
      });
    } else {
      excludedEntryIds.push(
        document.id
      );
    }
  }

  /*
   * The current iOS app performs its own vote and recency
   * ordering after loading. We nevertheless keep the master
   * projection deterministic by storing newest-updated first.
   */
  eligibleEntries.sort(
    (first, second) => {
      const firstTime =
        getEntryUpdatedAt(
          first.entry
        ).toMillis();

      const secondTime =
        getEntryUpdatedAt(
          second.entry
        ).toMillis();

      if (
        firstTime !==
        secondTime
      ) {
        return (
          secondTime -
          firstTime
        );
      }

      return first.entryId.localeCompare(
        second.entryId
      );
    }
  );

  const playlist =
    eligibleEntries.map(
      ({
        entryId,
        entry,
      }) =>
        projectEntryToPlaylistRow({
          collectionId,
          entryId,
          entry,
        })
    );

  const masterRef =
    adminDb
      .collection("masters")
      .doc(collectionId);

  await masterRef.set(
    {
      collectionId,

      ar_playlist:
        playlist,

      playlistItemCount:
        playlist.length,

      playlistSchemaVersion:
        MASTER_PLAYLIST_SCHEMA_VERSION,

      /*
       * Production-projection metadata. Existing iOS clients
       * ignore these fields.
       */
      sourceEntriesPath:
        `${collectionId}/_meta/entries`,

      eligibleEntryIds:
        eligibleEntries.map(
          ({ entryId }) =>
            entryId
        ),

      excludedEntryIds,

      rebuilt_at:
        FieldValue.serverTimestamp(),

      updated_at:
        FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    }
  );

  return {
    collectionId,

    playlistItemCount:
      playlist.length,

    eligibleEntryIds:
      eligibleEntries.map(
        ({ entryId }) =>
          entryId
      ),

    excludedEntryIds,

    masterPlaylistPath:
      `masters/${collectionId}`,

    playlistSchemaVersion:
      MASTER_PLAYLIST_SCHEMA_VERSION,
  };
}

/*
 * Convenience function for updating a playlist after one
 * entry changes.
 *
 * The first Phase 1 implementation rebuilds the complete
 * playlist because this is safer than performing an array
 * mutation that could create duplicate entry IDs.
 */
export async function rebuildMasterPlaylistForEntry(
  params: {
    collectionId: string;
    entryId: string;
  }
): Promise<RebuildMasterPlaylistResult> {
  cleanRequiredString(
    params.entryId,
    "entryId"
  );

  return rebuildMasterPlaylist(
    params.collectionId
  );
}