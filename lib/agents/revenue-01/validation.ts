import { COMMERCIAL_GOAL_BODY, COMMERCIAL_GOAL_SHA256 } from "./commercial-goals";
import { APPROVED_REVENUE_CONTRACT_SHA256, REVENUE_CONTRACT_VERSION } from "./contract";
import type { RevenueEngineInput, RevenueRunContext } from "./types";

export const APPROVED_CRM_CONTRACT_SHA256 = "68129fc2d2d4fdd5646b93879d0b469a71c3ef4c93e84fd0e4aaccc011fa8194" as const;
export const APPROVED_OFFER_CATALOG_SHA256 = "c0873122fb7b3c88d7f21989f04e05e8f566ae78a0fa1aba26a051f64f95d339" as const;

export class RevenueValidationError extends Error { code: string; constructor(code: string, message: string) { super(message); this.name="RevenueValidationError"; this.code=code; } }

export function normalizeRevenueRunContext(value: RevenueRunContext): RevenueRunContext {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value.reportingMonth)) throw new RevenueValidationError("invalid_reporting_month","Reporting month must be YYYY-MM.");
  if (value.founderSuppliedCollectedBaseline !== null && (!Number.isFinite(value.founderSuppliedCollectedBaseline) || value.founderSuppliedCollectedBaseline < 0)) throw new RevenueValidationError("invalid_founder_baseline","Founder baseline must be null or a nonnegative number.");
  if (!["authoritative_reference_available","founder_supplied_unverified","unknown"].includes(value.baselineEvidenceClassification)) throw new RevenueValidationError("invalid_baseline_classification","Founder baseline evidence classification is invalid.");
  if (value.founderSuppliedCollectedBaseline === null && value.baselineEvidenceClassification !== "unknown") throw new RevenueValidationError("baseline_evidence_mismatch","A missing Founder baseline must remain unknown.");
  return { reportingMonth:value.reportingMonth, founderSuppliedCollectedBaseline:value.founderSuppliedCollectedBaseline, baselineEvidenceClassification:value.baselineEvidenceClassification };
}

export function validateRevenueEngineInput(input: RevenueEngineInput): RevenueEngineInput {
  const s=input.snapshot;
  if (s.schemaVersion!=="crm-revenue-snapshot-v1") throw new RevenueValidationError("snapshot_schema_mismatch","Unsupported CRM Revenue snapshot schema.");
  if (s.crmContract.version!=="V1.1"||s.crmContract.sha256!==APPROVED_CRM_CONTRACT_SHA256) throw new RevenueValidationError("crm_contract_mismatch","CRM contract identity does not match the approved frozen contract.");
  if (s.offerCatalog.version!=="goshsha-commercial-offers-v1"||s.offerCatalog.sha256!==APPROVED_OFFER_CATALOG_SHA256) throw new RevenueValidationError("catalog_mismatch","Commercial-offer catalog identity does not match the approved catalog.");
  if (input.revenueContract.version!==REVENUE_CONTRACT_VERSION||input.revenueContract.sha256!==APPROVED_REVENUE_CONTRACT_SHA256) throw new RevenueValidationError("revenue_contract_mismatch","REVENUE contract identity does not match V1.1.");
  if (input.commercialGoal.goalId!==COMMERCIAL_GOAL_BODY.goalId||input.commercialGoal.version!==COMMERCIAL_GOAL_BODY.version||input.commercialGoal.sha256!==COMMERCIAL_GOAL_SHA256) throw new RevenueValidationError("commercial_goal_mismatch","Commercial goal identity is invalid.");
  if (!s.snapshotIdentity.accountId||!s.snapshotIdentity.pursuitId||s.account.accountId!==s.snapshotIdentity.accountId||s.pursuit.pursuitId!==s.snapshotIdentity.pursuitId||s.upstream.sales.pursuitId!==s.snapshotIdentity.pursuitId) throw new RevenueValidationError("scope_mismatch","Snapshot Account/Pursuit identities are inconsistent.");
  if (!s.snapshotIdentity.snapshotId||!s.snapshotIdentity.snapshotSha256||!s.revisionBinding.revisionSetSha256||!s.revisionBinding.records.length) throw new RevenueValidationError("malformed_revision_binding","Snapshot identity and revision binding are required.");
  const paths=new Set<string>();for(const record of s.revisionBinding.records){if(!record.recordPath||!record.recordId||!Number.isInteger(record.revision)||record.revision<1||!record.recordSha256||Number.isNaN(Date.parse(record.updatedAt))||paths.has(record.recordPath))throw new RevenueValidationError("malformed_revision_binding","Snapshot revision binding is malformed.");paths.add(record.recordPath);}
  if (s.commercialEvidence.freeFirst.priceUsd!==0||s.commercialEvidence.freeFirst.revenueEligible!==false) throw new RevenueValidationError("free_first_revenue_violation","Free First must remain $0 and nonrevenue.");
  if (input.generatedAt===""||Number.isNaN(Date.parse(input.generatedAt))) throw new RevenueValidationError("invalid_generated_at","Recommendation generatedAt is invalid.");
  return {...input,runContext:normalizeRevenueRunContext(input.runContext)};
}
