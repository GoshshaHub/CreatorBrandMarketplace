export type ScoreCategory =
  | "physicalRetailRelevance"
  | "currentTimelyTrigger"
  | "creatorContentActivity"
  | "shelfEducationNeed"
  | "currentGoshshaFit"
  | "commercialRepeatablePotential"
  | "practicalActionability"
  | "evidenceQualityCompleteness";

export type ScoreBreakdown = Record<ScoreCategory, number>;

export type DeductionType =
  | "staleTrigger"
  | "speculativeFit"
  | "materialContradiction"
  | "unavailableCapabilityDependency"
  | "unresolvedRightsAssumption"
  | "weakRetailConnection";
export type Deductions = Partial<Record<DeductionType, number>>;

export type ScoreCap =
  | "noVerifiedRetailPresence"
  | "noCurrentTrigger"
  | "unsupportedCentralClaim"
  | "primarilyUnavailableCapability"
  | "unresolvedMaterialContradiction"
  | "noSpecificCurrentProductUse";
export type ScoreBand =
  | "Immediate Priority"
  | "Strong Opportunity"
  | "Watch"
  | "Low Priority";

export type EvidenceClassification =
  | "verified_fact"
  | "reasonable_inference"
  | "hypothesis"
  | "unknown";

export type EvidenceSourceType =
  | "official_brand"
  | "official_retailer"
  | "direct_observation"
  | "trade_business_reporting"
  | "credible_secondary"
  | "founder_supplied_benchmark";

export type EvidenceItem = {
  id: string;
  publisher: string;
  sourceUrl: string;
  sourceType: EvidenceSourceType;
  publicationDate?: string | null;
  accessDate: string;
  supportedClaim: string;
  classification: EvidenceClassification;
  reliability: "high" | "medium" | "low";
  syntheticBenchmark?: boolean;
};

export type MaterialClaim = {
  id: string;
  claim: string;
  material: boolean;
  evidenceIds: string[];
};

export type RetailerAssessment = {
  posture: "retailer_independent" | "evidence_supported_dependency";
  dependencyDescription?: string | null;
  evidenceIds?: string[];
};

export type FreeFirstRole = {
  recommendation: "Recommended" | "Not Recommended";
  intendedLearningOrProofPoint: string;
  paidConversionHypothesis:
    | "Product 2"
    | "Multiple Product 2 activations"
    | "Creator Network"
    | "Combined path"
    | "Unclear";
  scoreContribution: number;
};

export type FastestRevenuePath =
  | "$75/month IRL Creator Network subscription after 14-day trial"
  | "$99 IRL Retail Media activation"
  | "Multiple IRL Retail Media activations"
  | "IRL Creator Network + IRL Retail Media"
  | "Unclear";

export type GrowthCandidateInput = {
  id: string;
  brand: string;
  productOrEvent: string;
  opportunityType: "Timely Trigger" | "Exceptional Structural";
  executiveSummary: string;
  trigger: string;
  whyNow: string;
  retailRelevance: string;
  creatorActivity: string;
  shelfNeed: string;
  goshshaWedge: string;
  retailerAssessment: RetailerAssessment;
  currentFit: string;
  recommendedOffering: "Free First IRL Campaign" | "IRL Creator Network" | "IRL Retail Media" | "Combined" | "Unclear";
  freeFirst: FreeFirstRole;
  fastestRevenuePath: FastestRevenuePath | string;
  revenuePathRationale: string;
  commercialHypothesis: string;
  founderStagePursuitFeasibility: "High" | "Medium" | "Low";
  feasibilityRationale: string;
  confidence: "High" | "Medium" | "Low";
  nextAction: string;
  handoff: "SALES-01" | "Research" | "Watch" | "Reject";
  knownUnknowns: string[];
  evidence: EvidenceItem[];
  claims: MaterialClaim[];
  scores: ScoreBreakdown;
  deductions?: Deductions;
  caps?: ScoreCap[];
  claimedGrossScore?: number;
  claimedFinalScore?: number;
  claimedBand?: ScoreBand;
  selectionStatus: "qualified" | "watch" | "rejected";
  benchmarkFixture?: boolean;
};

export type ScoredCandidate = GrowthCandidateInput & {
  computed: {
    grossScore: number;
    deductionTotal: number;
    scoreBeforeCap: number;
    applicableCap: number | null;
    finalScore: number;
    band: ScoreBand;
  };
};

export type ValidationFinding = {
  code: string;
  severity: "error" | "warning";
  candidateId?: string;
  field?: string;
  message: string;
};

export type CandidateValidation = {
  valid: boolean;
  findings: ValidationFinding[];
};

export type GrowthMarketCategory =
  | "supplements"
  | "vitamins"
  | "wellness_supplements"
  | "skincare"
  | "haircare"
  | "oral_care"
  | "beauty"
  | "makeup";

export type GrowthRunRequest = {
  asOfDate: string;
  marketFocus: GrowthMarketCategory[];
  maximumQualified?: number;
  marketPattern?: string;
  candidates: GrowthCandidateInput[];
};

export type ContractMetadata = {
  name: "GROWTH-01";
  version: "V1";
  path: "agents/growth-01/AGENT.md";
  sha256: string;
  byteLength: number;
  loadedAt: string;
  repositoryCommit: string | null;
};

export type ValidatedGrowthRun = {
  run: {
    id: string;
    requestedByUid: string;
    requestedAt: string;
    asOfDate: string;
    marketFocus: GrowthRunRequest["marketFocus"];
    status: "valid" | "validation_failed";
    candidateCount: number;
    qualifiedCount: number;
    authority: "founder_supervised_preview_only";
    persistence: false;
    externalCommunication: false;
  };
  contract: ContractMetadata;
  candidates: ScoredCandidate[];
  findings: ValidationFinding[];
  dailyBriefMarkdown: string;
};
