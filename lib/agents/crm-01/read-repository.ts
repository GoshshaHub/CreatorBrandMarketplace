import { FieldPath, type DocumentData, type Firestore, type Query, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { CrmStoredRecord } from "./types";
import { CRM_DETAIL_RELATION_LIMIT, CRM_READ_MAX_LIMIT } from "./read-types";
import { decodeReadCursor, encodeReadCursor } from "./read-validation";

export type CrmReadCollection = "accounts" | "contacts" | "growthOpportunities" | "salesPursuits" | "interactions" | "decisions" | "milestones" | "attentionItems";
export type CrmRecordPage = { records: CrmStoredRecord[]; nextCursor: string | null; scanned: number };

function collectionPath(collection: CrmReadCollection) { return `crm/${collection}/records`; }
function asStoredRecord(snapshot: QueryDocumentSnapshot<DocumentData>): CrmStoredRecord {
  const data = snapshot.data() as Partial<CrmStoredRecord>;
  return { id: typeof data.id === "string" && data.id ? data.id : snapshot.id, entityType: data.entityType as CrmStoredRecord["entityType"], revision: typeof data.revision === "number" ? data.revision : 0, createdAt: typeof data.createdAt === "string" ? data.createdAt : "", updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "", data: data.data && typeof data.data === "object" ? data.data : {}, provenance: Array.isArray(data.provenance) ? data.provenance : [], history: Array.isArray(data.history) ? data.history : [] };
}
function recordMatches(record: CrmStoredRecord, filters: Record<string, string>): boolean {
  const data = record.data ?? {};
  return Object.entries(filters).every(([key, expected]) => {
    if (key === "search") return String(data.displayName ?? data.name ?? "").toLowerCase().includes(expected.toLowerCase());
    if (key === "dnc") return String(data.dncEvaluation ?? (data.dnc && typeof data.dnc === "object" ? (data.dnc as Record<string, unknown>).status : data.dnc) ?? "unknown") === expected;
    if (key === "attentionStatus" && record.entityType === "attentionItem") return String(data.status ?? "unknown") === expected;
    if (key === "stage" && record.entityType === "salesPursuit") return String(data.stage ?? "unknown") === expected;
    if (key === "disposition" && record.entityType === "salesPursuit") return String(data.disposition ?? "unknown") === expected;
    return true;
  });
}

export async function readCrmRecordPage(params: { db: Firestore; collection: CrmReadCollection; resource: string; limit: number; filters: Record<string, string>; cursorValue: string | null }): Promise<CrmRecordPage> {
  const cursor = decodeReadCursor(params.cursorValue, params.resource, params.filters);
  const scanLimit = Math.min(CRM_READ_MAX_LIMIT, Math.max(params.limit + 1, params.limit * 4));
  let query: Query<DocumentData> = params.db.collection(collectionPath(params.collection)).orderBy("updatedAt", "desc").orderBy(FieldPath.documentId(), "desc").limit(scanLimit);
  if (cursor) query = query.startAfter(cursor.updatedAt, cursor.id);
  const snapshot = await query.get();
  const scanned = snapshot.docs.map((document) => ({ document, record: asStoredRecord(document) }));
  const matching = scanned.filter(({ record }) => recordMatches(record, params.filters));
  const items = matching.slice(0, params.limit).map(({ record }) => record);
  const lastReturned = matching.at(params.limit - 1)?.document;
  const lastScanned = snapshot.docs.at(-1);
  const cursorDocument = matching.length > params.limit || (matching.length === params.limit && snapshot.size === scanLimit) ? lastReturned : snapshot.size === scanLimit ? lastScanned : null;
  const nextCursor = cursorDocument ? encodeReadCursor(params.resource, params.filters, String(cursorDocument.data().updatedAt ?? ""), cursorDocument.id) : null;
  return { records: items, nextCursor, scanned: snapshot.size };
}

export async function readCrmRecentRecords(db: Firestore, collection: CrmReadCollection, limit = CRM_READ_MAX_LIMIT): Promise<CrmStoredRecord[]> {
  const safeLimit = Math.min(CRM_READ_MAX_LIMIT, Math.max(1, limit));
  const snapshot = await db.collection(collectionPath(collection)).orderBy("updatedAt", "desc").limit(safeLimit).get();
  return snapshot.docs.map(asStoredRecord);
}

export async function readCrmAccountRecord(db: Firestore, accountId: string): Promise<CrmStoredRecord | null> {
  const snapshot = await db.doc(`${collectionPath("accounts")}/${accountId}`).get();
  if (!snapshot.exists) return null;
  return asStoredRecord(snapshot as QueryDocumentSnapshot<DocumentData>);
}

export async function readCrmRelatedRecords(db: Firestore, collection: Exclude<CrmReadCollection, "accounts">, accountId: string): Promise<{ records: CrmStoredRecord[]; truncated: boolean }> {
  const snapshot = await db.collection(collectionPath(collection)).where("data.accountId", "==", accountId).limit(CRM_DETAIL_RELATION_LIMIT + 1).get();
  return { records: snapshot.docs.slice(0, CRM_DETAIL_RELATION_LIMIT).map(asStoredRecord), truncated: snapshot.size > CRM_DETAIL_RELATION_LIMIT };
}
