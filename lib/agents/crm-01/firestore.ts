import type { Firestore } from "firebase-admin/firestore";

import type { CrmSalesIngestionV1 } from "../sales-01/crm-export";
import { CrmIngestionError, verifyFounderApproval } from "./ingestion";
import { buildCrmIngestionPlan } from "./planner";
import type { CrmFounderApproval, CrmIngestionPlan, CrmIngestionReceipt, CrmSnapshot, CrmStoredRecord } from "./types";
import type { SalesPlaybookArtifactV1, SalesPlaybookCurrentReferenceV1 } from "./sales-playbook-artifact";

function refFor(db: Firestore, path: string) { return db.doc(path); }
function extractIdentityKeys(record: CrmStoredRecord): string[] { return Array.isArray(record.data.identityKeys) ? record.data.identityKeys.filter((x): x is string => typeof x === "string") : []; }
function sourceIdentityKeys(artifact: CrmSalesIngestionV1): string[] {
  const keys: string[] = [];
  for (const contact of artifact.source.acceptedSalesPlaybook.contacts) {
    if (!contact.contactRoute.value) continue;
    try {
      const url = new URL(contact.contactRoute.value);
      if (contact.contactRoute.type === "general_company") keys.push(`account:domain:${url.hostname.toLowerCase().replace(/^www\./, "")}`);
      if (contact.contactRoute.type === "public_professional_profile" || contact.contactRoute.type === "direct_public_business") keys.push(`contact:route:${url.toString()}`);
    } catch { /* deterministic validation rejects malformed routes before this layer */ }
  }
  return [...new Set(keys)];
}

export async function loadCrmSnapshot(db: Firestore, artifact: CrmSalesIngestionV1, planPaths: string[] = []): Promise<CrmSnapshot> {
  const [receiptSnap, accountSnaps, contactSnaps] = await Promise.all([
    db.doc(`crm/ingestions/records/${artifact.artifactSha256}`).get(),
    db.collection("crm/accounts/records").get(),
    db.collection("crm/contacts/records").get(),
  ]);
  const records: Record<string, CrmStoredRecord> = {};
  const sourceArtifacts: Record<string, SalesPlaybookArtifactV1> = {};
  const sourceArtifactReferences: Record<string, SalesPlaybookCurrentReferenceV1> = {};
  if (planPaths.length) {
    const snaps = await db.getAll(...planPaths.map((path) => refFor(db, path)));
    snaps.forEach((snap, index) => { if (!snap.exists) return; const path = planPaths[index]; if (path.startsWith("crm/sourceArtifacts/")) sourceArtifacts[path] = snap.data() as SalesPlaybookArtifactV1; else if (path.startsWith("crm/sourceArtifactReferences/")) sourceArtifactReferences[path] = snap.data() as SalesPlaybookCurrentReferenceV1; else records[path] = snap.data() as CrmStoredRecord; });
  }
  const identityKeys: Record<string, string> = {};
  for (const key of sourceIdentityKeys(artifact)) {
    const snap = await db.doc(`crm/identityKeys/records/${Buffer.from(key).toString("base64url")}`).get();
    if (snap.exists && typeof snap.data()?.recordId === "string") identityKeys[key] = snap.data()!.recordId;
  }
  const possibleAccountMatches = accountSnaps.docs.map((snap) => ({ id: snap.id, displayName: String((snap.data() as CrmStoredRecord).data?.displayName ?? "") })).filter((item) => item.displayName);
  const possibleContactMatches = contactSnaps.docs.map((snap) => { const data = (snap.data() as CrmStoredRecord).data; return { id: snap.id, name: String(data?.name ?? ""), accountId: String(data?.accountId ?? "") }; }).filter((item) => item.name && item.accountId);
  return { records, identityKeys, possibleAccountMatches, possibleContactMatches, completedReceipt: receiptSnap.exists ? receiptSnap.data() as CrmIngestionReceipt : null, sourceArtifacts, sourceArtifactReferences };
}

export async function commitCrmIngestion(params: { db: Firestore; artifact: CrmSalesIngestionV1; submittedPlan: CrmIngestionPlan; approval: CrmFounderApproval; uid: string; crmContractSha256: string; at: string }): Promise<CrmIngestionReceipt> {
  const { db, artifact, submittedPlan, approval, uid, crmContractSha256, at } = params;
  const ledgerRef = db.doc(`crm/ingestions/records/${artifact.artifactSha256}`);
  return db.runTransaction(async (transaction) => {
    const ledger = await transaction.get(ledgerRef);
    if (ledger.exists) return { ...(ledger.data() as CrmIngestionReceipt), replayed: true };
    const accountSnaps = await transaction.get(db.collection("crm/accounts/records"));
    const contactSnaps = await transaction.get(db.collection("crm/contacts/records"));
    const paths = [...submittedPlan.creates, ...submittedPlan.updates, ...submittedPlan.infrastructureOperations].map((op) => op.path);
    const recordSnaps = paths.length ? await transaction.getAll(...paths.map((path) => db.doc(path))) : [];
    const records: Record<string, CrmStoredRecord> = {};
    const sourceArtifacts: Record<string, SalesPlaybookArtifactV1> = {};
    const sourceArtifactReferences: Record<string, SalesPlaybookCurrentReferenceV1> = {};
    recordSnaps.forEach((snap, index) => { if (!snap.exists) return; const path = paths[index]; if (path.startsWith("crm/sourceArtifacts/")) sourceArtifacts[path] = snap.data() as SalesPlaybookArtifactV1; else if (path.startsWith("crm/sourceArtifactReferences/")) sourceArtifactReferences[path] = snap.data() as SalesPlaybookCurrentReferenceV1; else records[path] = snap.data() as CrmStoredRecord; });
    const keys = sourceIdentityKeys(artifact);
    const keySnaps = keys.length ? await transaction.getAll(...keys.map((key) => db.doc(`crm/identityKeys/records/${Buffer.from(key).toString("base64url")}`))) : [];
    const identityKeys: Record<string, string> = {};
    keySnaps.forEach((snap, index) => { if (snap.exists && typeof snap.data()?.recordId === "string") identityKeys[keys[index]] = snap.data()!.recordId; });
    const possibleAccountMatches = accountSnaps.docs.map((snap) => ({ id: snap.id, displayName: String((snap.data() as CrmStoredRecord).data?.displayName ?? "") })).filter((item) => item.displayName);
    const possibleContactMatches = contactSnaps.docs.map((snap) => { const data = (snap.data() as CrmStoredRecord).data; return { id: snap.id, name: String(data?.name ?? ""), accountId: String(data?.accountId ?? "") }; }).filter((item) => item.name && item.accountId);
    const current = buildCrmIngestionPlan({ artifact, snapshot: { records, identityKeys, possibleAccountMatches, possibleContactMatches, completedReceipt: null, sourceArtifacts, sourceArtifactReferences }, mappings: submittedPlan.mappings, crmContractSha256, at: artifact.source.acceptedSalesPlaybook.createdAt });
    if (current.planSha256 !== submittedPlan.planSha256) throw new CrmIngestionError("revision_conflict", "The canonical CRM state changed after preview.");
    verifyFounderApproval(current, approval, uid);
    const ops = [...current.creates, ...current.updates];
    for (const op of ops) {
      transaction.set(db.doc(op.path), op.record);
      for (const key of extractIdentityKeys(op.record)) transaction.set(db.doc(`crm/identityKeys/records/${Buffer.from(key).toString("base64url")}`), { key, entityType: op.entityType, recordId: op.record.id, recordPath: op.path, updatedAt: at });
    }
    for (const op of current.infrastructureOperations) {
      if (op.kind === "create_immutable_artifact") transaction.create(db.doc(op.path), op.value);
      else transaction.set(db.doc(op.path), op.value);
    }
    const receipt: CrmIngestionReceipt = { schemaVersion: "crm-ingestion-receipt-v1", ingestionId: artifact.artifactSha256, artifactSha256: artifact.artifactSha256, planSha256: current.planSha256, committedAt: at, committedByUid: uid, recordPaths: [...ops.map((x) => x.path), ...current.infrastructureOperations.map((x) => x.path)], replayed: false };
    transaction.create(ledgerRef, receipt);
    return receipt;
  });
}
