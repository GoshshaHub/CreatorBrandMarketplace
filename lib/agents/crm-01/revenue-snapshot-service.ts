import type { Firestore } from "firebase-admin/firestore";
import { readRevenueSnapshotRecords } from "./revenue-snapshot-repository";
import { buildCrmRevenueSnapshot } from "./revenue-snapshot";

export async function getCrmRevenueSnapshot(params: { db: Firestore; accountId: string; pursuitId: string; generatedAt: string; generatedByUid: string; crmContractVersion: "V1.1"; crmContractSha256: string }) {
  const input = await readRevenueSnapshotRecords(params.db, params.accountId);
  return buildCrmRevenueSnapshot({ ...params, ...input });
}
