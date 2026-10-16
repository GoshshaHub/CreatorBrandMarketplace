import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "../../../../../../lib/firebase-admin";
import { authorizeGrowthAdmin, GrowthAdminAuthError } from "../../../../../../lib/agents/growth-01/admin-auth";
import { buildGrowthCommercialOutcomeFeedback } from "../../../../../../lib/agents/growth-01/commercial-outcome-feedback";
import { getCrmRevenueSnapshot } from "../../../../../../lib/agents/crm-01/revenue-snapshot-service";
import { resolveCurrentSalesPlaybook } from "../../../../../../lib/agents/crm-01/sales-playbook-artifact";
import { loadCrmContractMetadata } from "../../../../../../lib/agents/crm-01/contract";
import { loadRevenueContractMetadata } from "../../../../../../lib/agents/revenue-01/contract";
import { COMMERCIAL_GOAL_BODY, COMMERCIAL_GOAL_SHA256 } from "../../../../../../lib/agents/revenue-01/commercial-goals";
import { buildRevenueRecommendation } from "../../../../../../lib/agents/revenue-01/recommendation";

export const runtime = "nodejs";
const MAX_REQUEST_BYTES = 2048;
const ID = /^[A-Za-z0-9_-]{1,128}$/;

type TestDependencies = {
  authorize(request: Request): Promise<{ uid: string }>;
  reconstruct(input: { accountId: string; pursuitId: string; uid: string; generatedAt: string }): Promise<{ snapshot: any; playbook: any; recommendation: any }>;
};
function testDependencies(): TestDependencies | null {
  if (process.env.NODE_ENV !== "test") return null;
  return (globalThis as typeof globalThis & { __growthFeedbackRouteTestDependencies?: TestDependencies }).__growthFeedbackRouteTestDependencies ?? null;
}
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") || "0") > MAX_REQUEST_BYTES) return reply({ code: "request_too_large" }, 413);
    const injected = testDependencies();
    const founder = injected ? await injected.authorize(request) : await authorizeGrowthAdmin(request, {
      verifyIdToken: (token) => adminAuth.verifyIdToken(token),
      loadUser: async (uid) => { const user = await adminDb.collection("users").doc(uid).get(); return { exists: user.exists, isAdmin: user.data()?.isAdmin === true }; },
    });
    const raw = await request.text();
    if (Buffer.byteLength(raw) > MAX_REQUEST_BYTES) return reply({ code: "request_too_large" }, 413);
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (Object.keys(body).sort().join(",") !== "accountId,pursuitId" || !ID.test(String(body.accountId)) || !ID.test(String(body.pursuitId))) return reply({ code: "scope_invalid", error: "Exact Account and Pursuit IDs are required." }, 422);
    const accountId = String(body.accountId), pursuitId = String(body.pursuitId), generatedAt = new Date().toISOString();
    const reconstructed = injected ? await injected.reconstruct({ accountId, pursuitId, uid: founder.uid, generatedAt }) : await (async () => {
      const [crm, revenue, playbook] = await Promise.all([loadCrmContractMetadata(), loadRevenueContractMetadata(), resolveCurrentSalesPlaybook(adminDb, accountId, pursuitId)]);
      const { snapshot } = await getCrmRevenueSnapshot({ db: adminDb, accountId, pursuitId, generatedAt, generatedByUid: founder.uid, crmContractVersion: crm.version, crmContractSha256: crm.sha256 });
      const recommendation = buildRevenueRecommendation({ snapshot, runContext: { reportingMonth: generatedAt.slice(0, 7), founderSuppliedCollectedBaseline: null, baselineEvidenceClassification: "unknown" }, revenueContract: { version: revenue.version, sha256: revenue.sha256 }, commercialGoal: { goalId: COMMERCIAL_GOAL_BODY.goalId, version: COMMERCIAL_GOAL_BODY.version, sha256: COMMERCIAL_GOAL_SHA256 }, generatedAt });
      return { snapshot, playbook, recommendation };
    })();
    const { snapshot, playbook, recommendation } = reconstructed;
    const feedback = buildGrowthCommercialOutcomeFeedback({
      accountId, pursuitId,
      growthCandidateSha256: snapshot.upstream.growth.candidateSha256,
      crmRevisionSetSha256: snapshot.revisionBinding.revisionSetSha256,
      interactions: snapshot.interactions,
      salesPlaybookArtifactId: playbook.playbookId,
      salesPlaybookArtifactSha256: playbook.artifactSha256,
      revenueRecommendationId: recommendation.identity.recommendationId,
      revenueRecommendationFamily: recommendation.recommendation.family,
      generatedAt,
    });
    return reply({ feedback, source: { crmSnapshotId: snapshot.snapshotIdentity.snapshotId, salesPlaybookArtifactId: playbook.playbookId, revenueRecommendationId: recommendation.identity.recommendationId }, paidRunTriggered: false, providerInvoked: false, strategyRewritten: false, persisted: false, externalAction: false });
  } catch (error) {
    if (error instanceof GrowthAdminAuthError) return reply({ code: "authorization_failed", error: error.message }, error.status);
    if (error instanceof SyntaxError) return reply({ code: "invalid_json", error: "Valid JSON is required." }, 400);
    return reply({ code: "feedback_unavailable", error: error instanceof Error ? error.message : "Feedback is unavailable." }, 409);
  }
}
