import { COMMERCIAL_POSITIONING_SHA256 } from "../commercial-positioning";
import { COMMERCIAL_OFFER_CATALOG_SHA256 } from "../crm-01/commercial-offers";
import { revenueSha256, revenueStableId } from "../revenue-01/canonical";

export const CLOSER_SPECIALIST_REVIEW_SCHEMA = "closer-01-specialist-objection-review-v1" as const;
export const CLOSER_SPECIALIST_REVIEW_VERSION = "v1" as const;
export const CLOSER_RECOMMENDATION_DISPOSITION_SCHEMA = "closer-01-founder-specialist-recommendation-disposition-v1" as const;

export type SpecialistOwner = "sales" | "revenue";
export type SpecialistReviewArtifact = ReturnType<typeof buildSpecialistReviewArtifact>;

const INPUTS = {
  salesPlaybook: { artifactId: "playbook", artifactSha256: "playbook-sha", version: "sales-playbook-artifact-v1" },
  positioning: { schemaVersion: "goshsha-commercial-positioning-v1", sha256: COMMERCIAL_POSITIONING_SHA256 },
  offers: { version: "goshsha-commercial-offers-v1", sha256: COMMERCIAL_OFFER_CATALOG_SHA256 },
  revenue: { approvedPackageId: "package", approvedPackageSha256: "package-sha", objectiveId: "objective", objectiveFamily: "complete_proof_milestone" },
} as const;

export function buildSpecialistReviewArtifact(params: { owner: SpecialistOwner; assessment: any; reviewItem: any; currentContextRevision: number; requestedByUid: string }) {
  if (params.reviewItem.reviewOwner !== params.owner || !["open", "deferred"].includes(params.reviewItem.status)) throw new Error("specialist_review_not_open");
  if (!Number.isSafeInteger(params.currentContextRevision) || params.currentContextRevision < 0) throw new Error("specialist_context_revision_invalid");
  const common = {
    schemaVersion: CLOSER_SPECIALIST_REVIEW_SCHEMA,
    version: CLOSER_SPECIALIST_REVIEW_VERSION,
    adapter: `${params.owner}-01-deterministic-objection-review-demo-v1`,
    owner: params.owner,
    assessmentId: params.assessment.assessmentId,
    assessmentPacketSha256: params.assessment.packetSha256,
    reviewItemId: params.reviewItem.reviewItemId,
    currentContextRevision: params.currentContextRevision,
    sourceEvidence: { interactionId: params.assessment.binding.interactionId, conversationId: params.assessment.binding.conversationId, exactAttributedStatement: params.assessment.sourceEvidence.exactAttributedStatement, provenance: params.assessment.sourceEvidence.provenance, authenticProductionEvidence: false as const },
    inputs: INPUTS,
    requestedByUid: params.requestedByUid,
    syntheticDemo: true as const,
    limitations: ["Deterministic local-demo analysis only.", "No live SALES or REVENUE agent/provider was invoked.", "No positioning, offer, Playbook, or Revenue objective change is applied."],
    authority: { proposedChangesApplied: false as const, closerContinuationAuthorized: false as const, agentInvoked: false as const, externalActionAuthorized: false as const },
  };
  const analysis = params.owner === "sales" ? {
    conclusion: "revise_strategy" as const,
    reasons: ["The objection is outside approved Playbook coverage.", "Custom implementation, guaranteed ROI, and discounts require explicit strategy review."],
    proposedChanges: ["Consider a later SALES-owned Playbook revision that answers scope questions without promising custom implementation or guarantees."],
    unresolvedDependencies: ["Founder must decide whether to authorize a later SALES change phase."],
  } : {
    conclusion: "seek_more_evidence" as const,
    reasons: ["A discount request is economically material.", "No approved discount or changed Revenue objective is evidenced."],
    proposedChanges: ["Preserve the current objective and approved offers unless a later REVENUE review supports an exact economic change."],
    unresolvedDependencies: ["Founder must decide whether to authorize a later REVENUE change phase."],
  };
  const body = { ...common, analysis };
  return { ...body, artifactId: revenueStableId(`${params.owner}specialistreview`, body), artifactSha256: revenueSha256(body) };
}

export function verifySpecialistReviewArtifact(value: any) {
  const { artifactId, artifactSha256, recordedAt: _recordedAt, ...body } = value;
  if (revenueSha256(body) !== artifactSha256 || revenueStableId(`${body.owner}specialistreview`, body) !== artifactId) throw new Error("specialist_review_integrity_failed");
}

export function buildFounderRecommendationDisposition(params: { assessment: any; artifacts: SpecialistReviewArtifact[]; currentContextRevision: number; disposition: "accept_for_later_change" | "reject" | "defer"; rationale: string; reviewerUid: string }) {
  if (!params.rationale.trim()) throw new Error("recommendation_rationale_required");
  const byOwner = new Map(params.artifacts.map((artifact) => [artifact.owner, artifact]));
  if (!byOwner.has("sales") || !byOwner.has("revenue")) throw new Error("specialist_reviews_incomplete");
  const recommendationBindings = [byOwner.get("sales")!, byOwner.get("revenue")!].map((artifact) => ({ owner: artifact.owner, artifactId: artifact.artifactId, artifactSha256: artifact.artifactSha256 }));
  const body = { schemaVersion: CLOSER_RECOMMENDATION_DISPOSITION_SCHEMA, assessmentId: params.assessment.assessmentId, assessmentPacketSha256: params.assessment.packetSha256, currentContextRevision: params.currentContextRevision, recommendationBindings, disposition: params.disposition, rationale: params.rationale.trim(), reviewerUid: params.reviewerUid, syntheticDemo: true as const, pendingApprovedChanges: params.disposition === "accept_for_later_change", changesApplied: false as const, freshContextAndContinuationApprovalRequired: true as const, closerContinuationAuthorized: false as const, agentInvocationAuthorized: false as const, externalActionAuthorized: false as const };
  return { ...body, dispositionId: revenueStableId("founderspecialistdisposition", body), dispositionSha256: revenueSha256(body) };
}

export function verifyFounderRecommendationDisposition(value: any) {
  const { dispositionId, dispositionSha256, recordedAt: _recordedAt, ...body } = value;
  if (revenueSha256(body) !== dispositionSha256 || revenueStableId("founderspecialistdisposition", body) !== dispositionId) throw new Error("recommendation_disposition_integrity_failed");
}
