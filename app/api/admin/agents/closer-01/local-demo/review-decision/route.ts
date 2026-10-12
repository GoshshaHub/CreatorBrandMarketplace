import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../../../../lib/firebase-admin";
import { authorizeCrmAdmin } from "../../../../../../../lib/agents/crm-01/admin-auth";
import { assertCloserLocalDemoEnvironment } from "../../../../../../../lib/agents/closer-01/local-demo-guard";
import { buildObjectionDecision, verifyObjectionDecision } from "../../../../../../../lib/agents/closer-01/objection-decision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const HEADERS = { "Cache-Control": "no-store" };
const proof = (value: unknown, secret: string) => createHmac("sha256", secret).update(JSON.stringify(value)).digest("hex");
const safe = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);

function verifyProof(value: unknown, suppliedProof: unknown, secret: string) {
  const expected = proof(value, secret), supplied = String(suppliedProof ?? "");
  if (expected.length !== supplied.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) throw new Error("decision_preview_not_server_issued");
}

async function sources(assessmentId: string) {
  const assessment = (await adminDb.doc(`crm/closerObservationAssessments/records/${safe(assessmentId)}`).get()).data();
  if (!assessment) throw new Error("assessment_not_found");
  const reviewItem = (await adminDb.doc(`crm/closerReviewItems/records/${safe(`${assessmentId}-founder`)}`).get()).data();
  if (!reviewItem) throw new Error("founder_review_not_required");
  const context = (await adminDb.doc("crm/closerDemoContextState/records/demo-pursuit").get()).data();
  return { assessment, reviewItem, currentContextRevision: Number(context?.assessmentRevision ?? 0) };
}

export async function POST(req: Request) {
  try {
    const env = assertCloserLocalDemoEnvironment();
    const admin = await authorizeCrmAdmin(req, {
      verifyIdToken: (token) => adminAuth.verifyIdToken(token),
      loadUser: async (uid) => { const user = await adminDb.collection("users").doc(uid).get(); return { exists: user.exists, isAdmin: user.data()?.isAdmin === true }; },
    });
    const body = await req.json(), decision = String(body.decision);
    if (!["acknowledge", "defer", "resolve"].includes(decision)) throw new Error("decision_invalid");
    const { assessment, reviewItem, currentContextRevision } = await sources(String(body.assessmentId));
    const proposal = buildObjectionDecision({ assessment, reviewItem, currentContextRevision, decision: decision as "acknowledge" | "defer" | "resolve", rationale: String(body.rationale ?? ""), reviewerUid: admin.uid });
    if (body.operation === "preview") return NextResponse.json({ proposal, previewProof: proof(proposal, env.signingSecret) }, { headers: HEADERS });
    if (body.operation !== "record" || body.explicitFounderApproval !== true) throw new Error("decision_approval_missing");
    verifyProof(body.proposal, body.previewProof, env.signingSecret);
    verifyObjectionDecision(body.proposal);
    const receiptRef = adminDb.doc(`crm/closerReviewDecisionReceipts/receipts/${safe(body.proposal.decisionId)}`);
    const decisionRef = adminDb.doc(`crm/closerReviewDecisions/records/${safe(body.proposal.decisionId)}`);
    const reviewRef = adminDb.doc(`crm/closerReviewItems/records/${safe(`${body.proposal.assessmentId}-founder`)}`);
    const contextRef = adminDb.doc("crm/closerDemoContextState/records/demo-pursuit");
    const result = await adminDb.runTransaction(async (transaction) => {
      const receipt = await transaction.get(receiptRef);
      if (receipt.exists) return { ...receipt.data(), replayed: true };
      const currentReview = (await transaction.get(reviewRef)).data();
      const currentAssessment = (await transaction.get(adminDb.doc(`crm/closerObservationAssessments/records/${safe(body.proposal.assessmentId)}`))).data();
      const context = await transaction.get(contextRef), revision = Number(context.data()?.assessmentRevision ?? 0);
      if (!currentReview || !currentAssessment) throw new Error("decision_source_missing");
      const current = buildObjectionDecision({ assessment: currentAssessment, reviewItem: currentReview, currentContextRevision: revision, decision: body.proposal.decision, rationale: body.proposal.rationale, reviewerUid: admin.uid });
      if (current.decisionId !== body.proposal.decisionId || current.decisionSha256 !== body.proposal.decisionSha256) throw new Error("decision_approval_stale");
      const recordedAt = new Date().toISOString();
      transaction.create(decisionRef, { ...body.proposal, recordedAt });
      if (body.proposal.decision !== "acknowledge") transaction.update(reviewRef, { status: body.proposal.decision === "defer" ? "deferred" : "resolved", updatedAt: recordedAt, lastDecisionId: body.proposal.decisionId });
      transaction.set(contextRef, { schemaVersion: "closer-demo-context-state-v1", assessmentRevision: revision + 1, updatedAt: recordedAt }, { merge: true });
      const output = { schemaVersion: "crm-closer-review-decision-receipt-v1", decisionId: body.proposal.decisionId, decision: body.proposal.decision, recordedAt, reviewItemStatus: body.proposal.decision === "acknowledge" ? currentReview.status : body.proposal.decision === "defer" ? "deferred" : "resolved", specialistDependenciesRemain: true, readyToContinue: false, replayed: false };
      transaction.create(receiptRef, output);
      return output;
    });
    return NextResponse.json({ receipt: result }, { headers: HEADERS });
  } catch (error: any) {
    return NextResponse.json({ code: error.code ?? error.message, error: error.message }, { status: 409, headers: HEADERS });
  }
}
