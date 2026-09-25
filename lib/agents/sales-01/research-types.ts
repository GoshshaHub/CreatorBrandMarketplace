import type { GrowthSalesHandoffEnvelopeV1, SalesContractMetadata } from "./types";
import type { SalesProviderProjectionMetadata } from "./provider-intelligence-contract";

export type SalesResearchRequest = {
  envelope: GrowthSalesHandoffEnvelopeV1;
  founderAuthorization: { authorized: true; scope: "one_sales_research_run" };
  budgetAuthority: {
    confirmedByFounder: true;
    salesMonthSpendUsd: number;
    commercialDepartmentMonthSpendUsd: number;
  };
};

export type SalesSpendingAuthority = {
  perRunCeilingUsd: 1;
  salesMonthlyCeilingUsd: 20;
  commercialDepartmentMonthlyCeilingUsd: 50;
  remainingSalesBudgetUsd: number;
  remainingCommercialDepartmentBudgetUsd: number;
  effectiveRunAuthorityUsd: number;
  fullProfileAuthorized: boolean;
  cumulativeAccounting: "founder_supplied_nonpersistent";
  providerDollarCutoffGuaranteed: false;
};

export type SalesResearchUsage = {
  inputTokens: number | null;
  cachedInputTokens: number | null;
  cacheWriteTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
  webSearchCalls: number;
};

export type SalesProviderExecutionMetadata = {
  provider: "openai";
  outcome: "accepted" | "provider_completed_local_rejection";
  requestedModel: string;
  returnedModel: string | null;
  providerResponseId: string | null;
  providerStatus: string | null;
  providerCreatedAt: string | null;
  providerCompletedAt: string | null;
  serverReceivedAt: string;
  usage: SalesResearchUsage;
};

export type SalesEvidence = {
  id: string;
  publisher: string;
  rawUrl: string;
  canonicalUrl: string;
  title: string;
  publicationDate: string | null;
  accessDate: string;
  supportedClaim: string;
  classification: "verified_fact" | "attributed_brand_claim" | "reasonable_inference" | "hypothesis" | "unknown";
};

export type SalesClaimClassification =
  | "verified_fact"
  | "attributed_brand_claim"
  | "goshsha_capability"
  | "reasonable_inference"
  | "hypothesis"
  | "unknown"
  | "prohibited_unsupported";

export type SalesClaim = {
  id: string;
  statement: string;
  classification: SalesClaimClassification;
  evidenceRefs: Array<{ kind: "growth_evidence" | "sales_evidence" | "goshsha_capability"; id: string }>;
};

export type SalesContact = {
  id: string;
  name: string;
  currentTitle: string;
  company: string;
  strategicRoles: Array<"Best First Contact" | "Internal Champion" | "Economic Buyer" | "Executive Sponsor" | "Operational Owner">;
  strategicRoleRationale: string;
  buyingAuthority: "unknown" | "supported";
  buyingAuthorityEvidenceIds: string[];
  contactRoute: {
    type: "direct_public_business" | "general_company" | "public_professional_profile" | "unknown";
    value: string | null;
    evidenceIds: string[];
  };
  evidenceIds: string[];
};

export type SalesPlaybookV1 = {
  schemaVersion: "sales-playbook-v1";
  createdAt: string;
  growthQualification: {
    candidateId: string;
    brand: string;
    productOrEvent: string;
    score: number;
    band: string;
    confidence: string;
    feasibility: string;
    candidateSha256: string;
  };
  salesPursuitDecision: "Pursue Now" | "Nurture / Revisit" | "Do Not Pursue";
  salesPursuitRationale: string;
  opportunityStrategy: {
    observedTrigger: string;
    specificProblem: string;
    goshshaWedge: string;
    retailerIndependenceAssessment: string;
    selectedEntryOffer: "Free First" | "IRL Retail Media" | "Creator Network" | "Combined";
    offerFacts: {
      freeFirst: "$0 / one product / one properly licensed uploaded video / 30 days / first 250 qualified views / proof-acquisition only";
      irlRetailMedia: "$99 / one product / one video / 90 days / first 1,000 qualified views";
      creatorNetwork: "14-day trial with card / then $75/month";
    };
    offerRationale: string;
    physicalScanProofPoint: string;
    paidConversionHypothesis: string;
    desiredNextAction: string;
  };
  contacts: SalesContact[];
  proofStrategy: string;
  claims: SalesClaim[];
  inheritedUnknowns: Array<{
    originalText: string;
    status: "unresolved" | "resolved_by_sales_evidence";
    resolution: string | null;
    salesEvidenceIds: string[];
  }>;
  rights: { status: "unknown" | "explicitly_supported" | "not_applicable"; evidenceIds: string[]; conditionalRequirement: string };
  retailerIndependence: { posture: "retailer_independent" | "evidence_supported_dependency"; description: string; evidenceIds: string[] };
  objections: Array<{ objection: string; response: string; claimIds: string[]; escalate: boolean }>;
  outreach: {
    recommendedChannel: string;
    objective: string;
    initialMessage: string;
    firstFollowUp: string;
    secondFollowUp: string;
    closeTheLoop: string | null;
    claimIds: string[];
    sendingAuthorized: false;
  };
  fastestRevenuePath: string;
  evidence: SalesEvidence[];
  crmReadyPacket: {
    schemaVersion: "sales-crm-ready-v1";
    account: string;
    opportunity: string;
    salesPursuitDecision: SalesPlaybookV1["salesPursuitDecision"];
    bestFirstContactId: string | null;
    contactIds: string[];
    trigger: string;
    wedge: string;
    entryOffer: string;
    nextAction: string;
    inheritedUnknowns: SalesPlaybookV1["inheritedUnknowns"];
    sourceIds: string[];
    crmWriteAuthorized: false;
  };
  authority: {
    founderReviewed: false;
    sendingAuthorized: false;
    crmWriteAuthorized: false;
    persistence: false;
    revenueInvocationAuthorized: false;
    closerInvocationAuthorized: false;
    externalAction: false;
  };
};

export type SalesResearchProposal = {
  playbook: SalesPlaybookV1;
  execution: SalesProviderExecutionMetadata;
  normalizedSourceCount: number;
};

export type SalesResearchProviderContext = {
  salesContract: SalesContractMetadata;
  providerProjection: SalesProviderProjectionMetadata & { body: string };
  envelope: GrowthSalesHandoffEnvelopeV1;
};

export type SalesResearchResult = {
  outcome: "accepted";
  providerProfile: {
    timeoutMs: 150_000;
    maximumWebSearchCalls: 6;
    maximumContacts: 6;
    maximumContactsPerRole: 2;
    maximumSources: 30;
    maximumOutputTokens: 12_000;
  };
  contract: SalesContractMetadata;
  providerProjection: SalesProviderProjectionMetadata;
  spendingAuthority: SalesSpendingAuthority;
  proposal: SalesResearchProposal;
};
