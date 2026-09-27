export const CRM_READ_DEFAULT_LIMIT = 25;
export const CRM_READ_MAX_LIMIT = 100;
export const CRM_DETAIL_RELATION_LIMIT = 100;

export type CrmReadWarning = {
  code: "missing_field" | "invalid_field" | "unknown_state" | "conflicting_state" | "truncated_history";
  field: string;
  message: string;
};
export type CrmDncReadModel = {
  state: "active" | "inactive" | "unknown" | "conflicting";
  evaluation: "allowed" | "blocked" | "review_required";
  scope: "account" | "contact" | "channel" | "unknown";
  reason: string | null;
  evidenceRefs: string[];
  effectiveAt: string | null;
  expiresAt: string | null;
};

export type CrmAccountListItem = {
  id: string;
  revision: number | null;
  displayName: string | null;
  relationshipStatus: string | null;
  dnc: CrmDncReadModel;
  updatedAt: string | null;
  provenance: string[];
  warnings: CrmReadWarning[];
};

export type CrmContactReadModel = {
  id: string;
  revision: number | null;
  accountId: string | null;
  name: string | null;
  currentTitle: string | null;
  strategicRoles: string[];
  strategicRoleRationale: string | null;
  recommendedAsBestFirstContact: boolean;
  recommendationClassification: "sales_inference" | "unavailable";
  buyingAuthority: "supported" | "unknown";
  contactRoute: { type: string; value: string | null };
  dnc: CrmDncReadModel;
  updatedAt: string | null;
  provenance: string[];
  warnings: CrmReadWarning[];
};

export type CrmPursuitListItem = {
  id: string;
  revision: number | null;
  accountId: string | null;
  opportunityId: string | null;
  stage: string | null;
  disposition: string | null;
  salesPursuitDecision: string | null;
  rationale: string | null;
  nextAction: { description: string | null; owner: string | null; status: string | null; dueAt: string | null; executionAuthorized: false };
  dncEvaluation: "allowed" | "blocked" | "review_required";
  unknowns: Array<{ text: string; status: string | null }>;
  rights: { status: string | null; conditionalRequirement: string | null };
  retailerIndependence: { posture: string | null; description: string | null };
  updatedAt: string | null;
  provenance: string[];
  warnings: CrmReadWarning[];
};

export type CrmAttentionListItem = {
  id: string;
  revision: number | null;
  accountId: string | null;
  pursuitId: string | null;
  contactId: string | null;
  type: "reminder" | "condition_alert" | "unknown";
  reason: string | null;
  priority: "low" | "normal" | "medium" | "high" | "critical" | "unknown";
  status: "open" | "snoozed" | "resolved" | "dismissed" | "unknown";
  dueAt: string | null;
  owner: string | null;
  source: string | null;
  triggeringCondition: string | null;
  updatedAt: string | null;
  provenance: string[];
  warnings: CrmReadWarning[];
};

export type CrmTimelineItem = {
  id: string;
  entityType: "interaction" | "decision" | "milestone" | "attentionItem" | "revision";
  revision: number | null;
  effectiveAt: string | null;
  recordedAt: string | null;
  title: string;
  summary: string | null;
  classification: string | null;
  provenance: string[];
  correctionOf: string | null;
  supersededBy: string | null;
  warnings: CrmReadWarning[];
};

export type CrmGrowthOpportunityReadModel = {
  id: string;
  revision: number | null;
  candidateId: string | null;
  brand: string | null;
  productOrEvent: string | null;
  score: number | null;
  band: string | null;
  confidence: string | null;
  feasibility: string | null;
  wedge: string | null;
  retailerAssessment: unknown;
  freeFirst: unknown;
  fastestRevenuePath: string | null;
  immutable: boolean;
  provenance: string[];
  warnings: CrmReadWarning[];
};

export type CrmCommercialReadModel = {
  freeFirst: { state: string | null; revenueUsd: 0; live: boolean; scanVerified: boolean };
  product2: { state: string | null; amountUsd: number | null; paymentReference: string | null };
  creatorNetwork: { state: string | null; amountUsd: number | null; paymentReference: string | null };
  revenueStates: {
    hypothesisOpportunity: string | null;
    proposed: string | null;
    expected: string | null;
    committed: string | null;
    collected: string | null;
    refundedReversed: string | null;
  };
  warnings: CrmReadWarning[];
};

export type CrmPage<T> = {
  schemaVersion: "crm-read-page-v1";
  items: T[];
  nextCursor: string | null;
  limit: number;
  filters: Record<string, string>;
  generatedAt: string;
  cache: "no-store";
};

export type CrmDashboardReadModel = {
  schemaVersion: "crm-dashboard-v1";
  generatedAt: string;
  boundedTo: number;
  counts: { accounts: number; activePursuits: number; founderReview: number; openAttention: number; dncBlocked: number; dncReviewRequired: number };
  needsFounderAttention: CrmAttentionListItem[];
  priorityAccounts: CrmAccountListItem[];
  recentPursuits: CrmPursuitListItem[];
  dataQualityWarnings: string[];
  cache: "no-store";
};

export type CrmAccountDetailReadModel = {
  schemaVersion: "crm-account-detail-v1";
  generatedAt: string;
  account: CrmAccountListItem;
  contacts: CrmContactReadModel[];
  growthOpportunities: CrmGrowthOpportunityReadModel[];
  pursuits: CrmPursuitListItem[];
  attentionItems: CrmAttentionListItem[];
  timeline: CrmTimelineItem[];
  commercial: CrmCommercialReadModel[];
  relationLimit: number;
  truncationWarnings: string[];
  cache: "no-store";
};
