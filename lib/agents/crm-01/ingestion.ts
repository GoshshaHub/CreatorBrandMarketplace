import { crmSha256 } from "./canonical";
import type { CrmFounderApproval, CrmIngestionPlan, CrmIngestionReceipt, CrmSnapshot, CrmStoredRecord } from "./types";
import type { SalesPlaybookArtifactV1, SalesPlaybookCurrentReferenceV1 } from "./sales-playbook-artifact";

export class CrmIngestionError extends Error { code: string; constructor(code: string, message: string) { super(message); this.name = "CrmIngestionError"; this.code = code; } }

export function verifyFounderApproval(plan: CrmIngestionPlan, approval: CrmFounderApproval, uid: string): void {
  const expectedAuthority = { outreach: false, campaigns: false, payments: false, revenueInvocation: false, closerInvocation: false, externalAction: false };
  if (!approval.approved || approval.scope !== "crm_ingestion" || approval.approvedByUid !== uid || approval.artifactSha256 !== plan.artifactSha256 || approval.ingestionPlanSha256 !== plan.planSha256 || crmSha256(approval.expectedRevisions) !== crmSha256(plan.expectedRevisions) || crmSha256(approval.approvedMappings) !== crmSha256(plan.mappings) || crmSha256(approval.authority) !== crmSha256(expectedAuthority) || Number.isNaN(Date.parse(approval.approvedAt))) throw new CrmIngestionError("approval_invalid", "Founder approval does not match the exact CRM ingestion transaction.");
}

export class InMemoryCrmRepository {
  records = new Map<string, CrmStoredRecord>(); receipts = new Map<string, CrmIngestionReceipt>(); identityKeys = new Map<string, string>(); failAfter = -1;
  sourceArtifacts = new Map<string, SalesPlaybookArtifactV1>(); sourceArtifactReferences = new Map<string, SalesPlaybookCurrentReferenceV1>();
  snapshot(): CrmSnapshot { return { records: Object.fromEntries(this.records), identityKeys: Object.fromEntries(this.identityKeys), possibleAccountMatches: [], possibleContactMatches: [], completedReceipt: null, sourceArtifacts: Object.fromEntries(this.sourceArtifacts), sourceArtifactReferences: Object.fromEntries(this.sourceArtifactReferences) }; }
  commit(plan: CrmIngestionPlan, approval: CrmFounderApproval, uid: string, at: string): CrmIngestionReceipt {
    const previous = this.receipts.get(plan.artifactSha256); if (previous) return { ...previous, replayed: true };
    verifyFounderApproval(plan, approval, uid);
    const ops = [...plan.creates, ...plan.updates];
    for (const op of ops) if ((this.records.get(op.path)?.revision ?? null) !== op.expectedRevision) throw new CrmIngestionError("revision_conflict", `Revision changed for ${op.path}.`);
    const next = new Map(this.records), nextArtifacts = new Map(this.sourceArtifacts), nextReferences = new Map(this.sourceArtifactReferences);
    ops.forEach((op, index) => { if (index === this.failAfter) throw new CrmIngestionError("transaction_failed", "Synthetic atomic failure."); next.set(op.path, op.record); });
    plan.infrastructureOperations.forEach((op) => { if (op.kind === "create_immutable_artifact") { if (nextArtifacts.has(op.path)) throw new CrmIngestionError("immutable_artifact_conflict", "Immutable Sales Playbook artifact already exists."); nextArtifacts.set(op.path, op.value as SalesPlaybookArtifactV1); } else nextReferences.set(op.path, op.value as SalesPlaybookCurrentReferenceV1); });
    const receipt: CrmIngestionReceipt = { schemaVersion: "crm-ingestion-receipt-v1", ingestionId: plan.artifactSha256, artifactSha256: plan.artifactSha256, planSha256: plan.planSha256, committedAt: at, committedByUid: uid, recordPaths: [...ops.map((x) => x.path), ...plan.infrastructureOperations.map((x) => x.path)], replayed: false };
    const nextIdentityKeys = new Map(this.identityKeys); for (const op of ops) { const keys = Array.isArray(op.record.data.identityKeys) ? op.record.data.identityKeys : []; for (const key of keys) if (typeof key === "string") nextIdentityKeys.set(key, op.record.id); }
    this.records = next; this.identityKeys = nextIdentityKeys; this.sourceArtifacts = nextArtifacts; this.sourceArtifactReferences = nextReferences; this.receipts.set(plan.artifactSha256, receipt); return receipt;
  }
}
