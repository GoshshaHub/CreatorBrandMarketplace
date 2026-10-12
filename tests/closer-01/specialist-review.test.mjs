import assert from "node:assert/strict";
import test from "node:test";
import { buildFounderRecommendationDisposition, buildSpecialistReviewArtifact, verifyFounderRecommendationDisposition, verifySpecialistReviewArtifact } from "../../lib/agents/closer-01/specialist-review.ts";

const assessment = { assessmentId: "assessment", packetSha256: "a".repeat(64), binding: { interactionId: "interaction", conversationId: "conversation" }, sourceEvidence: { exactAttributedStatement: "Give us custom implementation, guaranteed ROI, and a discount.", provenance: "synthetic_demo_fixture" } };
const review = (owner) => ({ reviewItemId: `assessment-${owner}`, reviewOwner: owner, status: "open" });

test("SALES and REVENUE deterministic artifacts preserve evidence and ownership without applying changes", () => {
  const sales = buildSpecialistReviewArtifact({ owner: "sales", assessment, reviewItem: review("sales"), currentContextRevision: 2, requestedByUid: "founder" });
  const revenue = buildSpecialistReviewArtifact({ owner: "revenue", assessment, reviewItem: review("revenue"), currentContextRevision: 3, requestedByUid: "founder" });
  verifySpecialistReviewArtifact(sales); verifySpecialistReviewArtifact(revenue);
  assert.equal(sales.analysis.conclusion, "revise_strategy"); assert.equal(revenue.analysis.conclusion, "seek_more_evidence");
  for (const artifact of [sales, revenue]) { assert.equal(artifact.sourceEvidence.exactAttributedStatement, assessment.sourceEvidence.exactAttributedStatement); assert.equal(artifact.syntheticDemo, true); assert.equal(artifact.authority.proposedChangesApplied, false); assert.equal(artifact.authority.closerContinuationAuthorized, false); assert.equal(artifact.authority.agentInvoked, false); }
});

test("wrong ownership, completed dependency, altered artifact and stale context fail", () => {
  assert.throws(() => buildSpecialistReviewArtifact({ owner: "sales", assessment, reviewItem: review("revenue"), currentContextRevision: 1, requestedByUid: "founder" }), /specialist_review_not_open/);
  assert.throws(() => buildSpecialistReviewArtifact({ owner: "sales", assessment, reviewItem: { ...review("sales"), status: "completed" }, currentContextRevision: 1, requestedByUid: "founder" }), /specialist_review_not_open/);
  const artifact = buildSpecialistReviewArtifact({ owner: "sales", assessment, reviewItem: review("sales"), currentContextRevision: 1, requestedByUid: "founder" });
  assert.throws(() => verifySpecialistReviewArtifact({ ...artifact, currentContextRevision: 2 }), /specialist_review_integrity_failed/);
});

test("Founder disposition binds both later-created recommendations and grants no continuation", () => {
  const artifacts = ["sales", "revenue"].map((owner, index) => buildSpecialistReviewArtifact({ owner, assessment, reviewItem: review(owner), currentContextRevision: index + 1, requestedByUid: "founder" }));
  const value = buildFounderRecommendationDisposition({ assessment, artifacts, currentContextRevision: 4, disposition: "accept_for_later_change", rationale: "Accept only for a future change phase.", reviewerUid: "founder" });
  verifyFounderRecommendationDisposition(value);
  assert.equal(value.recommendationBindings.length, 2); assert.equal(value.pendingApprovedChanges, true); assert.equal(value.changesApplied, false); assert.equal(value.closerContinuationAuthorized, false);
  assert.throws(() => buildFounderRecommendationDisposition({ assessment, artifacts: [artifacts[0]], currentContextRevision: 4, disposition: "defer", rationale: "Wait", reviewerUid: "founder" }), /specialist_reviews_incomplete/);
});
