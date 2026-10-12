import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../../../../lib/firebase-admin";
import { authorizeCrmAdmin } from "../../../../../../../lib/agents/crm-01/admin-auth";
import { assertCloserLocalDemoEnvironment } from "../../../../../../../lib/agents/closer-01/local-demo-guard";
import { buildFounderRecommendationDisposition, verifyFounderRecommendationDisposition, verifySpecialistReviewArtifact } from "../../../../../../../lib/agents/closer-01/specialist-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const HEADERS = { "Cache-Control": "no-store" }, safe = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100), sign = (value: unknown, secret: string) => createHmac("sha256", secret).update(JSON.stringify(value)).digest("hex");
function verifyProof(value: unknown, supplied: unknown, secret: string) { const expected = sign(value, secret), actual = String(supplied ?? ""); if (expected.length !== actual.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))) throw new Error("recommendation_preview_not_server_issued"); }
async function authorize(req: Request) { return authorizeCrmAdmin(req, { verifyIdToken: (token) => adminAuth.verifyIdToken(token), loadUser: async (uid) => { const user = await adminDb.collection("users").doc(uid).get(); return { exists: user.exists, isAdmin: user.data()?.isAdmin === true }; } }); }

async function reconstruct(assessmentId: string) {
  const assessment = (await adminDb.doc(`crm/closerObservationAssessments/records/${safe(assessmentId)}`).get()).data();
  if (!assessment) throw new Error("assessment_not_found");
  const artifacts = [];
  for (const owner of ["sales", "revenue"] as const) {
    const review = (await adminDb.doc(`crm/closerReviewItems/records/${safe(`${assessmentId}-${owner}`)}`).get()).data();
    if (review?.status !== "completed" || !review.lastArtifactId) throw new Error("specialist_reviews_incomplete");
    const artifact = (await adminDb.doc(`crm/closerSpecialistReviews/records/${safe(review.lastArtifactId)}`).get()).data();
    if (!artifact || artifact.artifactSha256 !== review.lastArtifactSha256) throw new Error("specialist_artifact_binding_invalid");
    verifySpecialistReviewArtifact(artifact);
    artifacts.push(artifact as any);
  }
  const context = (await adminDb.doc("crm/closerDemoContextState/records/demo-pursuit").get()).data();
  return { assessment, artifacts, currentContextRevision: Number(context?.assessmentRevision ?? 0) };
}

export async function POST(req: Request) {
  try {
    const env = assertCloserLocalDemoEnvironment(), admin = await authorize(req), body = await req.json(), disposition = String(body.disposition);
    if (!["accept_for_later_change", "reject", "defer"].includes(disposition)) throw new Error("recommendation_disposition_invalid");
    const source = await reconstruct(String(body.assessmentId));
    const proposal = buildFounderRecommendationDisposition({ ...source, disposition: disposition as any, rationale: String(body.rationale ?? ""), reviewerUid: admin.uid });
    if (body.operation === "preview") return NextResponse.json({ proposal, previewProof: sign(proposal, env.signingSecret) }, { headers: HEADERS });
    if (body.operation !== "record" || body.explicitFounderApproval !== true) throw new Error("recommendation_approval_missing");
    verifyProof(body.proposal, body.previewProof, env.signingSecret);
    verifyFounderRecommendationDisposition(body.proposal);
    const decisionRef = adminDb.doc(`crm/closerRecommendationDispositions/records/${safe(body.proposal.dispositionId)}`), receiptRef = adminDb.doc(`crm/closerRecommendationDispositionReceipts/receipts/${safe(body.proposal.dispositionId)}`), assessmentRef = adminDb.doc(`crm/closerObservationAssessments/records/${safe(body.proposal.assessmentId)}`), contextRef = adminDb.doc("crm/closerDemoContextState/records/demo-pursuit");
    const result = await adminDb.runTransaction(async (transaction) => {
      const receipt = await transaction.get(receiptRef);
      if (receipt.exists) return { ...receipt.data(), replayed: true };
      const currentAssessment = (await transaction.get(assessmentRef)).data(), context = await transaction.get(contextRef), revision = Number(context.data()?.assessmentRevision ?? 0), artifacts = [];
      if (!currentAssessment) throw new Error("assessment_not_found");
      for (const binding of body.proposal.recommendationBindings) {
        const artifact = (await transaction.get(adminDb.doc(`crm/closerSpecialistReviews/records/${safe(binding.artifactId)}`))).data();
        if (!artifact || artifact.artifactSha256 !== binding.artifactSha256) throw new Error("specialist_artifact_binding_invalid");
        artifacts.push(artifact as any);
      }
      const current = buildFounderRecommendationDisposition({ assessment: currentAssessment, artifacts, currentContextRevision: revision, disposition: body.proposal.disposition, rationale: body.proposal.rationale, reviewerUid: admin.uid });
      if (current.dispositionId !== body.proposal.dispositionId || current.dispositionSha256 !== body.proposal.dispositionSha256) throw new Error("recommendation_approval_stale");
      const recordedAt = new Date().toISOString();
      transaction.create(decisionRef, { ...body.proposal, recordedAt });
      transaction.set(contextRef, { schemaVersion: "closer-demo-context-state-v1", assessmentRevision: revision + 1, updatedAt: recordedAt }, { merge: true });
      const output = { schemaVersion: "crm-closer-recommendation-disposition-receipt-v1", dispositionId: body.proposal.dispositionId, disposition: body.proposal.disposition, recordedAt, replayed: false, pendingApprovedChanges: body.proposal.pendingApprovedChanges, changesApplied: false, closerContinuationAuthorized: false, readyToContinue: false };
      transaction.create(receiptRef, output);
      return output;
    });
    return NextResponse.json({ receipt: result }, { headers: HEADERS });
  } catch (error: any) { return NextResponse.json({ code: error.code ?? error.message, error: error.message }, { status: 409, headers: HEADERS }); }
}
