import { crmSha256 } from "./canonical";
import type { CrmFounderApproval, CrmIngestionPlan, CrmIngestionReceipt, CrmSnapshot, CrmStoredRecord } from "./types";

export class CrmIngestionError extends Error { code: string; constructor(code: string, message: string) { super(message); this.name = "CrmIngestionError"; this.code = code; } }

export function verifyFounderApproval(plan: CrmIngestionPlan, approval: CrmFounderApproval, uid: string): void {
  const expectedAuthority = { outreach: false, campaigns: false, payments: false, revenueInvocation: false, closerInvocation: false, externalAction: false };
  if (!approval.approved || approval.scope !== "crm_ingestion" || approval.approvedByUid !== uid || approval.artifactSha256 !== plan.artifactSha256 || approval.ingestionPlanSha256 !== plan.planSha256 || crmSha256(approval.expectedRevisions) !== crmSha256(plan.expectedRevisions) || crmSha256(approval.approvedMappings) !== crmSha256(plan.mappings) || crmSha256(approval.authority) !== crmSha256(expectedAuthority) || Number.isNaN(Date.parse(approval.approvedAt))) throw new CrmIngestionError("approval_invalid", "Founder approval does not match the exact CRM ingestion transaction.");
}

export class InMemoryCrmRepository {
  records = new Map<string, CrmStoredRecord>(); receipts = new Map<string, CrmIngestionReceipt>(); identityKeys = new Map<string, string>(); failAfter = -1;
  snapshot(): CrmSnapshot { return { records: Object.fromEntries(this.records), identityKeys: Object.fromEntries(this.identityKeys), possibleAccountMatches: [], possibleContactMatches: [], completedReceipt: null }; }
  commit(plan: CrmIngestionPlan, approval: CrmFounderApproval, uid: string, at: string): CrmIngestionReceipt {
    const previous = this.receipts.get(plan.artifactSha256); if (previous) return { ...previous, replayed: true };
    verifyFounderApproval(plan, approval, uid);
    const ops = [...plan.creates, ...plan.updates];
    for (const op of ops) if ((this.records.get(op.path)?.revision ?? null) !== op.expectedRevision) throw new CrmIngestionError("revision_conflict", `Revision changed for ${op.path}.`);
    const next = new Map(this.records);
    ops.forEach((op, index) => { if (index === this.failAfter) throw new CrmIngestionError("transaction_failed", "Synthetic atomic failure."); next.set(op.path, op.record); });
    const receipt: CrmIngestionReceipt = { schemaVersion: "crm-ingestion-receipt-v1", ingestionId: plan.artifactSha256, artifactSha256: plan.artifactSha256, planSha256: plan.planSha256, committedAt: at, committedByUid: uid, recordPaths: ops.map((x) => x.path), replayed: false };
    this.records = next; this.receipts.set(plan.artifactSha256, receipt); return receipt;
  }
}
