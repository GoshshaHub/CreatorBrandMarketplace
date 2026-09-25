import type { GrowthProviderProjectionMetadata } from "../growth-01/provider-research-contract";
import type {
  ContractMetadata,
  ScoredCandidate,
  ValidatedGrowthRun,
  ValidationFinding,
} from "../growth-01/types";

export type SalesContractMetadata = {
  name: "SALES-01";
  version: "V1.1";
  path: "agents/sales-01/AGENT.md";
  sha256: string;
  byteLength: number;
  loadedAt: string;
  repositoryCommit: string | null;
};

export type UnknownField = {
  value: string | null;
  provenance: "explicit_growth_field" | "founder_supplied_clarification" | "unknown";
};

export type RegulatedClaimClassification =
  | "attributed_brand_claim"
  | "authoritative_fact"
  | "hypothesis"
  | "unknown"
  | "prohibited_unsupported";

export type SalesBoundarySnapshot = {
  rightsStatus: "unknown" | "explicitly_supported" | "not_applicable";
  rightsEvidenceIds: string[];
  regulatedClaims: Array<{
    claimId: string;
    classification: RegulatedClaimClassification;
    evidenceIds: string[];
    attribution: string | null;
  }>;
  retailerAuthorizationClaimed: boolean;
  buyerAuthorityKnown: boolean;
  budgetKnown: boolean;
  purchaseIntentKnown: boolean;
  timingCommitmentKnown: boolean;
  unsupportedCapabilityIntroduced: boolean;
};

export type GrowthSalesCandidateContext = {
  candidateId: string;
  triggerDate: UnknownField;
  physicalScanExperience: UnknownField;
  boundarySnapshot: SalesBoundarySnapshot;
};

export type GrowthSalesExportV1 = {
  exportVersion: "growth-sales-export-v1";
  exportedAt: string;
  validatedRun: ValidatedGrowthRun;
  providerProjection: GrowthProviderProjectionMetadata | null;
  candidateContexts: GrowthSalesCandidateContext[];
  authority: {
    exportOnly: true;
    founderApprovedForSales: false;
    salesInvoked: false;
    persisted: false;
    downstreamInvoked: false;
    externalAction: false;
  };
};

export type SalesIntakeRequest = {
  export: GrowthSalesExportV1;
  candidateId: string;
  founderApproval: {
    approved: boolean;
    scope: "sales_preparation_only";
  };
};

export type SalesIntakeFinding = ValidationFinding;

export type GrowthSalesHandoffEnvelopeV1 = Readonly<{
  schemaVersion: "growth-sales-handoff-v1";
  envelope: {
    id: string;
    createdAt: string;
    canonicalizationVersion: "growth-sales-canonical-json-v1";
    payloadSha256: string;
  };
  source: {
    growthRunId: string;
    growthRunRequestedAt: string;
    growthAsOfDate: string;
    growthRunStatus: "valid";
    growthAuthority: "founder_supervised_preview_only";
    growthPersistence: false;
    growthExternalCommunication: false;
    growthContract: ContractMetadata;
    providerProjection: GrowthProviderProjectionMetadata | null;
  };
  candidate: {
    candidateId: string;
    candidateVersion: "growth-candidate-v1";
    candidateSha256: string;
    candidateIndex: number;
    completeCandidate: ScoredCandidate;
  };
  qualification: {
    status: "valid";
    selectionStatus: "qualified";
    score: number;
    scoreBreakdown: ScoredCandidate["scores"];
    deductions: NonNullable<ScoredCandidate["deductions"]>;
    caps: NonNullable<ScoredCandidate["caps"]>;
    band: ScoredCandidate["computed"]["band"];
    confidence: ScoredCandidate["confidence"];
    founderStagePursuitFeasibility: ScoredCandidate["founderStagePursuitFeasibility"];
    validationFindings: ValidationFinding[];
  };
  opportunity: {
    brand: string;
    productOrEvent: string;
    trigger: string;
    triggerDate: UnknownField;
    whyNow: string;
    goshshaWedge: string;
    retailerAssessment: ScoredCandidate["retailerAssessment"];
    recommendedOffering: ScoredCandidate["recommendedOffering"];
    freeFirst: ScoredCandidate["freeFirst"];
    physicalScanExperience: UnknownField;
    fastestRevenuePath: string;
    revenuePathRationale: string;
    commercialHypothesis: string;
    handoffRecommendation: ScoredCandidate["handoff"];
  };
  evidence: {
    items: ScoredCandidate["evidence"];
    materialClaims: ScoredCandidate["claims"];
    knownUnknowns: string[];
  };
  boundarySnapshot: SalesBoundarySnapshot;
  founderApproval: {
    approved: true;
    approvedByUid: string;
    approvedAt: string;
    scope: "sales_preparation_only";
    candidateId: string;
    candidateSha256: string;
    externalActionAuthorized: false;
    persistenceAuthorized: false;
  };
  salesContract: SalesContractMetadata;
  authority: {
    salesPreparationAuthorized: true;
    externalActionAuthorized: false;
    contactResearchPerformed: false;
    messageGenerated: false;
    crmWriteAuthorized: false;
    revenueInvocationAuthorized: false;
    closerInvocationAuthorized: false;
    persistence: false;
  };
}>;

export type SalesIntakeResult = {
  status: "valid" | "validation_failed";
  findings: SalesIntakeFinding[];
  envelope: GrowthSalesHandoffEnvelopeV1 | null;
  summaryMarkdown: string;
};
