import type { CrmRevenueSnapshotV1 } from "../crm-01/revenue-snapshot-types";

export const RECOMMENDATION_ENGINE_VERSION = "revenue-01-deterministic-engine-v1" as const;
export const RECOMMENDATION_SCHEMA_VERSION = "revenue-01-recommendation-v1" as const;

export type RevenueObjectiveFamily = "resolve_evidence_or_safety_blocker" | "establish_qualified_engagement" | "complete_proof_milestone" | "pursue_standard_paid_conversion" | "pursue_repeat_or_retention" | "pause_no_commercial_action";
export type RevenueAssignmentType = "Pursuit" | "Proof / Progression" | "Conversion" | "Expansion / Retention" | "None";
export type RevenueRunContext = { reportingMonth: string; founderSuppliedCollectedBaseline: number | null; baselineEvidenceClassification: "authoritative_reference_available" | "founder_supplied_unverified" | "unknown" };
export type RevenueContractMetadata = { version: "V1.1"; sha256: string };
export type RevenueGoalIdentity = { goalId: string; version: string; sha256: string };
export type EligibilityRecord = { family: RevenueObjectiveFamily; eligible: boolean; reasons: string[]; desiredOutcome: string | null; assignmentType: RevenueAssignmentType; successCondition: string | null; requiredEvidence: string[] };
export type RevenueBlocker = { code: string; description: string; owner: "Founder" | "CRM-01" | "SALES-01" | "Brand" | "Production" | "Payment System"; hard: boolean };
export type RevenuePrerequisite = { code: string; description: string; evidenceRequired: string[] };
export type RevenueAssessment = { eligibility: EligibilityRecord[]; blockers: RevenueBlocker[]; prerequisites: RevenuePrerequisite[]; primaryFamily: RevenueObjectiveFamily; alternatives: RevenueObjectiveFamily[]; proofState: "not_engaged" | "free_first_not_accepted" | "rights_or_inputs_unresolved" | "accepted_ready_not_live" | "live_scan_unverified" | "proof_verified_paid_readiness_unknown" | "paid_progression_evidenced" | "unknown"; revenueState: "hypothesis" | "opportunity" | "expected" | "committed" | "collected" | "unknown"; collectionState: "collected" | "not_collected" | "unknown"; opportunityAmountUsd: number | null; proximity: "Immediate" | "Near" | "Developing" | "Distant" | "Unknown"; velocity: "Fast" | "Moderate" | "Slow" | "Unknown"; friction: "Low / Repeatable" | "Moderate" | "High / Custom" | "Unknown"; priority: "Now" | "Next" | "Develop" | "Monitor" | "Blocked" | "No Current Revenue Path"; timing: "Monetize Now" | "Complete Proof Milestone First" | "Resolve Evidence First" | "Pause"; executionState: "eligible_for_founder_review" | "review_required" | "blocked"; economicDesirability: boolean | null; unknowns: string[] };

export type RevenueRecommendationV1 = {
  schemaVersion: typeof RECOMMENDATION_SCHEMA_VERSION;
  identity: { recommendationId: string; recommendationSha256: string; generatedAt: string; status: "Proposed" };
  binding: { accountId: string; pursuitId: string; crmSnapshotId: string; crmSnapshotSha256: string; crmRevisionSetSha256: string; crmContractVersion: "V1.1"; crmContractSha256: string; offerCatalogVersion: "goshsha-commercial-offers-v1"; offerCatalogSha256: string; commercialGoalId: string; commercialGoalVersion: string; commercialGoalSha256: string; revenueContractVersion: "V1.1"; revenueContractSha256: string; recommendationEngineVersion: typeof RECOMMENDATION_ENGINE_VERSION; normalizedRunContext: RevenueRunContext };
  observedState: { snapshotCompleteness: "complete" | "incomplete"; growthScore: number | null; growthBand: string | null; salesPursuitDecision: string | null; crmStage: string | null; selectedEntryOfferId: string | null; proofState: RevenueAssessment["proofState"]; relationshipSafety: CrmRevenueSnapshotV1["relationshipSafety"]; nextAction: CrmRevenueSnapshotV1["nextAction"]; evidenceIds: string[] };
  deterministicAssessment: { eligibility: EligibilityRecord[]; blockers: RevenueBlocker[]; prerequisites: RevenuePrerequisite[]; dataLimitations: string[] };
  economics: Omit<RevenueAssessment,"eligibility"|"blockers"|"prerequisites"|"primaryFamily"|"alternatives"|"proofState"|"unknowns">;
  recommendation: { family: RevenueObjectiveFamily; desiredOutcome: string; assignmentType: RevenueAssignmentType; rationale: string; assumptions: string[]; unknowns: string[]; successCondition: string; requiredSuccessEvidence: string[]; owningAgent: "Founder" | "CRM-01" | "SALES-01" | "future CLOSER-01" };
  alternatives: Array<{ family: RevenueObjectiveFamily; reasonNotPrimary: string }>;
  horizons: { nextDollar: { classification: "not_close" | "conditional" | "supported" | "unknown"; rationale: string }; first1000Monthly: { targetUsd: 1000; founderBaselineUsd: number | null; baselineEvidenceClassification: RevenueRunContext["baselineEvidenceClassification"]; accountContributionClassification: "opportunity" | "hypothesis" | "unknown"; doesNotEstablishAccountRevenue: true }; repeatableRevenueEngine: { classification: "supported" | "unvalidated" | "unavailable"; rationale: string } };
  authority: { founderApprovalState: "Not Requested"; executionAuthorized: false; closerInvocationAuthorized: false; crmMutationAuthorized: false; paymentActionAuthorized: false; externalActionAuthorized: false };
  freshness: { currentForExactSnapshotOnly: true; invalidatedByAnyBindingChange: true };
};

export type RevenueEngineInput = { snapshot: CrmRevenueSnapshotV1; runContext: RevenueRunContext; revenueContract: RevenueContractMetadata; commercialGoal: RevenueGoalIdentity; generatedAt: string };
