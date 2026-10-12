import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../../../../lib/firebase-admin";
import { authorizeCrmAdmin } from "../../../../../../../lib/agents/crm-01/admin-auth";
import { assertCloserLocalDemoEnvironment } from "../../../../../../../lib/agents/closer-01/local-demo-guard";
import { buildSpecialistReviewArtifact, verifySpecialistReviewArtifact, type SpecialistOwner } from "../../../../../../../lib/agents/closer-01/specialist-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const HEADERS = { "Cache-Control": "no-store" };
const safe = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
const sign = (value: unknown, secret: string) => createHmac("sha256", secret).update(JSON.stringify(value)).digest("hex");
function verifyProof(value: unknown, supplied: unknown, secret: string) { const expected = sign(value, secret), actual = String(supplied ?? ""); if (expected.length !== actual.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))) throw new Error("specialist_preview_not_server_issued"); }

async function authorize(req: Request) {
  return authorizeCrmAdmin(req, { verifyIdToken: (token) => adminAuth.verifyIdToken(token), loadUser: async (uid) => { const user = await adminDb.collection("users").doc(uid).get(); return { exists: user.exists, isAdmin: user.data()?.isAdmin === true }; } });
}

async function reconstruct(assessmentId: string, owner: SpecialistOwner) {
  const assessment = (await adminDb.doc(`crm/closerObservationAssessments/records/${safe(assessmentId)}`).get()).data();
  const reviewItem = (await adminDb.doc(`crm/closerReviewItems/records/${safe(`${assessmentId}-${owner}`)}`).get()).data();
  const context = (await adminDb.doc("crm/closerDemoContextState/records/demo-pursuit").get()).data();
  if (!assessment || !reviewItem) throw new Error("specialist_review_source_missing");
  return { assessment, reviewItem, currentContextRevision: Number(context?.assessmentRevision ?? 0) };
}

export async function POST(req: Request) {
  try {
    const env = assertCloserLocalDemoEnvironment(), admin = await authorize(req), body = await req.json(), owner = String(body.owner) as SpecialistOwner;
    if (!(["sales", "revenue"] as string[]).includes(owner)) throw new Error("specialist_owner_invalid");
    if (body.operation === "preview") {
      const source = await reconstruct(String(body.assessmentId), owner);
      const artifact = buildSpecialistReviewArtifact({ ...source, owner, requestedByUid: admin.uid });
      return NextResponse.json({ artifact, previewProof: sign(artifact, env.signingSecret) }, { headers: HEADERS });
    }
    if (body.operation !== "record" || body.explicitFounderRequest !== true) throw new Error("specialist_review_request_missing");
    verifyProof(body.artifact, body.previewProof, env.signingSecret);
    verifySpecialistReviewArtifact(body.artifact);
    const artifactRef = adminDb.doc(`crm/closerSpecialistReviews/records/${safe(body.artifact.artifactId)}`), receiptRef = adminDb.doc(`crm/closerSpecialistReviewReceipts/receipts/${safe(body.artifact.artifactId)}`), reviewRef = adminDb.doc(`crm/closerReviewItems/records/${safe(`${body.artifact.assessmentId}-${owner}`)}`), assessmentRef = adminDb.doc(`crm/closerObservationAssessments/records/${safe(body.artifact.assessmentId)}`), contextRef = adminDb.doc("crm/closerDemoContextState/records/demo-pursuit");
    const result = await adminDb.runTransaction(async (transaction) => {
      const receipt = await transaction.get(receiptRef);
      if (receipt.exists) return { ...receipt.data(), replayed: true };
      const currentAssessment = (await transaction.get(assessmentRef)).data(), currentReview = (await transaction.get(reviewRef)).data(), context = await transaction.get(contextRef), revision = Number(context.data()?.assessmentRevision ?? 0);
      if (!currentAssessment || !currentReview) throw new Error("specialist_review_source_missing");
      const current = buildSpecialistReviewArtifact({ owner, assessment: currentAssessment, reviewItem: currentReview, currentContextRevision: revision, requestedByUid: admin.uid });
      if (current.artifactId !== body.artifact.artifactId || current.artifactSha256 !== body.artifact.artifactSha256) throw new Error("specialist_review_stale");
      const recordedAt = new Date().toISOString();
      transaction.create(artifactRef, { ...body.artifact, recordedAt });
      transaction.update(reviewRef, { status: "completed", completedAt: recordedAt, lastArtifactId: body.artifact.artifactId, lastArtifactSha256: body.artifact.artifactSha256 });
      transaction.set(contextRef, { schemaVersion: "closer-demo-context-state-v1", assessmentRevision: revision + 1, updatedAt: recordedAt }, { merge: true });
      const output = { schemaVersion: "crm-closer-specialist-review-receipt-v1", artifactId: body.artifact.artifactId, artifactSha256: body.artifact.artifactSha256, owner, reviewItemStatus: "completed", recordedAt, replayed: false, proposedChangesApplied: false, closerContinuationAuthorized: false };
      transaction.create(receiptRef, output);
      return output;
    });
    return NextResponse.json({ receipt: result }, { headers: HEADERS });
  } catch (error: any) { return NextResponse.json({ code: error.code ?? error.message, error: error.message }, { status: 409, headers: HEADERS }); }
}
