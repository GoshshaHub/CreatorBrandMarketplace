import type { Firestore } from "firebase-admin/firestore";
import { readCrmAccountRecord, readCrmRelatedRecords } from "./read-repository";
import type { CrmStoredRecord } from "./types";

const RELATED_COLLECTIONS = ["contacts", "growthOpportunities", "salesPursuits", "interactions", "decisions", "milestones", "attentionItems"] as const;

export async function readRevenueSnapshotRecords(db: Firestore, accountId: string): Promise<{ records: CrmStoredRecord[]; truncatedCollections: string[] }> {
  const [account, ...related] = await Promise.all([
    readCrmAccountRecord(db, accountId),
    ...RELATED_COLLECTIONS.map((collection) => readCrmRelatedRecords(db, collection, accountId)),
  ]);
  if (!account) return { records: [], truncatedCollections: [] };
  return {
    records: [account, ...related.flatMap((result) => result.records)],
    truncatedCollections: related.flatMap((result, index) => result.truncated ? [RELATED_COLLECTIONS[index]] : []),
  };
}
