import type { CrmSalesIngestionV1 } from "../sales-01/crm-export";

export type CrmEntityType = "account" | "contact" | "growthOpportunity" | "salesPursuit" | "interaction" | "decision" | "milestone" | "attentionItem";
export type CrmStage = "Growth Qualified" | "Sales Prepared" | "Founder Review";
export type CrmDncEvaluation = "allowed" | "blocked" | "review_required";
export type CrmProvenance = "growth_derived_evidence" | "sales_public_evidence" | "sales_strategic_inference" | "founder_provided_information" | "future_closer_observation" | "future_brand_statement" | "production_system_reference" | "payment_provider_reference" | "system_generated_state" | "unknown" | "conflicting";

export type CrmStoredRecord = {
  id: string;
  entityType: CrmEntityType;
  revision: number;
  createdAt: string;
  updatedAt: string;
  data: Record<string, unknown>;
  provenance: CrmProvenance[];
  history: Array<{ revision: number; event: string; artifactSha256: string; at: string }>;
};

export type CrmSnapshot = {
  records: Record<string, CrmStoredRecord>;
  identityKeys: Record<string, string>;
  possibleAccountMatches: Array<{ id: string; displayName: string }>;
  possibleContactMatches: Array<{ id: string; name: string; accountId: string }>;
  completedReceipt: CrmIngestionReceipt | null;
};

export type CrmPlanOperation = { kind: "create" | "update"; entityType: CrmEntityType; path: string; expectedRevision: number | null; record: CrmStoredRecord };

export type CrmIngestionPlan = {
  schemaVersion: "crm-ingestion-plan-v1";
  artifactSha256: string;
  crmContractSha256: string;
  mappings: Record<string, string>;
  creates: CrmPlanOperation[];
  updates: CrmPlanOperation[];
  matches: Array<{ sourceId: string; canonicalId: string; basis: string }>;
  possibleMatches: Array<{ sourceId: string; candidateId: string; reason: string }>;
  conflicts: string[];
  expectedRevisions: Record<string, number | null>;
  stage: CrmStage;
  disposition: "Active" | "Nurture / Revisit" | "Not Pursued";
  unknowns: string[];
  dncEvaluation: CrmDncEvaluation;
  planSha256: string;
};

export type CrmFounderApproval = {
  approved: true;
  scope: "crm_ingestion";
  approvedByUid: string;
  approvedAt: string;
  artifactSha256: string;
  ingestionPlanSha256: string;
  expectedRevisions: Record<string, number | null>;
  approvedMappings: Record<string, string>;
  authority: { outreach: false; campaigns: false; payments: false; revenueInvocation: false; closerInvocation: false; externalAction: false };
};

export type CrmIngestionReceipt = { schemaVersion: "crm-ingestion-receipt-v1"; ingestionId: string; artifactSha256: string; planSha256: string; committedAt: string; committedByUid: string; recordPaths: string[]; replayed: boolean };
export type CrmPreviewRequest = { export: CrmSalesIngestionV1; mappings?: Record<string, string> };
export type CrmIngestRequest = CrmPreviewRequest & { plan: CrmIngestionPlan; approval: CrmFounderApproval };
