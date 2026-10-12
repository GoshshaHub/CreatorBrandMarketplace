import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../../../../lib/firebase-admin";
import { authorizeCrmAdmin } from "../../../../../../../lib/agents/crm-01/admin-auth";
import { assertCloserLocalDemoEnvironment } from "../../../../../../../lib/agents/closer-01/local-demo-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const HEADERS = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  try {
    assertCloserLocalDemoEnvironment();
    await authorizeCrmAdmin(req, { verifyIdToken: (token) => adminAuth.verifyIdToken(token), loadUser: async (uid) => { const user = await adminDb.collection("users").doc(uid).get(); return { exists: user.exists, isAdmin: user.data()?.isAdmin === true }; } });
    const [assessmentSnapshot, reviewSnapshot, decisionSnapshot, artifactSnapshot, dispositionSnapshot] = await Promise.all([
      adminDb.collection("crm/closerObservationAssessments/records").limit(50).get(),
      adminDb.collection("crm/closerReviewItems/records").limit(100).get(),
      adminDb.collection("crm/closerReviewDecisions/records").limit(100).get(),
      adminDb.collection("crm/closerSpecialistReviews/records").limit(100).get(),
      adminDb.collection("crm/closerRecommendationDispositions/records").limit(100).get(),
    ]);
    const reviews = reviewSnapshot.docs.map((doc) => doc.data()), decisions = decisionSnapshot.docs.map((doc) => doc.data()), artifacts = artifactSnapshot.docs.map((doc) => doc.data()), dispositions = dispositionSnapshot.docs.map((doc) => doc.data());
    const items = assessmentSnapshot.docs.map((doc) => {
      const assessment = doc.data(), linkedReviews = reviews.filter((review) => review.sourceAssessmentId === assessment.assessmentId), linkedArtifacts = artifacts.filter((artifact) => artifact.assessmentId === assessment.assessmentId), linkedDispositions = dispositions.filter((disposition) => disposition.assessmentId === assessment.assessmentId), remaining = linkedReviews.filter((review) => review.status !== "resolved" && review.status !== "completed");
      return {
        assessment: { assessmentId: assessment.assessmentId, binding: assessment.binding, sourceEvidence: assessment.sourceEvidence, assessment: assessment.assessment, requestedReviews: assessment.requestedReviews, syntheticDemo: assessment.syntheticDemo },
        reviews: linkedReviews.map((review) => ({ reviewItemId: review.reviewItemId, reviewOwner: review.reviewOwner, status: review.status, reason: review.reason, sourceInteractionId: review.sourceInteractionId, sourceConversationId: review.sourceConversationId, lastArtifactId: review.lastArtifactId ?? null })),
        decisions: decisions.filter((decision) => decision.assessmentId === assessment.assessmentId).map((decision) => ({ decisionId: decision.decisionId, decision: decision.decision, rationale: decision.rationale, reviewerUid: decision.reviewerUid, recordedAt: decision.recordedAt })),
        specialistArtifacts: linkedArtifacts.map((artifact) => ({ artifactId: artifact.artifactId, artifactSha256: artifact.artifactSha256, owner: artifact.owner, adapter: artifact.adapter, conclusion: artifact.analysis.conclusion, reasons: artifact.analysis.reasons, proposedChanges: artifact.analysis.proposedChanges, unresolvedDependencies: artifact.analysis.unresolvedDependencies, limitations: artifact.limitations, sourceEvidence: artifact.sourceEvidence, inputs: artifact.inputs, recordedAt: artifact.recordedAt, syntheticDemo: artifact.syntheticDemo, proposedChangesApplied: false })),
        recommendationDispositions: linkedDispositions.map((disposition) => ({ dispositionId: disposition.dispositionId, disposition: disposition.disposition, rationale: disposition.rationale, recommendationBindings: disposition.recommendationBindings, reviewerUid: disposition.reviewerUid, recordedAt: disposition.recordedAt, pendingApprovedChanges: disposition.pendingApprovedChanges, changesApplied: false })),
        remainingDependencies: remaining.map((review) => review.reviewOwner),
        specialistReviewComplete: linkedArtifacts.some((artifact) => artifact.owner === "sales") && linkedArtifacts.some((artifact) => artifact.owner === "revenue"),
        readyToContinue: false,
        freshContextAndApprovalRequired: true,
      };
    });
    return NextResponse.json({ schemaVersion: "closer-01-founder-objection-review-queue-v1", items }, { headers: HEADERS });
  } catch (error: any) { return NextResponse.json({ code: error.code ?? error.message, error: error.message }, { status: 409, headers: HEADERS }); }
}
