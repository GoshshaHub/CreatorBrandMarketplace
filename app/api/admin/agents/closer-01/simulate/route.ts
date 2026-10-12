import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../../../lib/firebase-admin";
import { authorizeCrmAdmin } from "../../../../../../lib/agents/crm-01/admin-auth";
import { loadCrmContractMetadata } from "../../../../../../lib/agents/crm-01/contract";
import { getCrmAccountDetail } from "../../../../../../lib/agents/crm-01/read-service";
import { crmReadErrorResponse } from "../../../../../../lib/agents/crm-01/read-route";
import { getCrmRevenueSnapshot } from "../../../../../../lib/agents/crm-01/revenue-snapshot-service";
import { resolveCurrentSalesPlaybook, SalesPlaybookArtifactError } from "../../../../../../lib/agents/crm-01/sales-playbook-artifact";
import { loadGrowthContractMetadata } from "../../../../../../lib/agents/growth-01/contract";
import { loadSalesContractMetadata } from "../../../../../../lib/agents/sales-01/contract";
import { RevenueApprovalError, verifyApprovedActionPackageCurrent, type ApprovedActionPackageV1 } from "../../../../../../lib/agents/revenue-01/approved-action";
import { COMMERCIAL_GOAL_SHA256 } from "../../../../../../lib/agents/revenue-01/commercial-goals";
import { loadRevenueContractMetadata } from "../../../../../../lib/agents/revenue-01/contract";
import { createDeterministicRevenueRecommendation } from "../../../../../../lib/agents/revenue-01/service";
import type { RevenueObjectiveFamily, RevenueRunContext } from "../../../../../../lib/agents/revenue-01/types";
import { normalizeRevenueRunContext, RevenueValidationError } from "../../../../../../lib/agents/revenue-01/validation";
import { createWorkforceRoutingPreview, WorkforceHandoffError } from "../../../../../../lib/agents/workforce/handoff";
import { loadCloserContractMetadata, CloserContractIntegrityError } from "../../../../../../lib/agents/closer-01/contract";
import { CloserPacketError } from "../../../../../../lib/agents/closer-01/conversation-intelligence";
import { assembleCloserReadinessFromCanonical } from "../../../../../../lib/agents/closer-01/service";
import { CLOSER_SIMULATION_ACTIONS, CLOSER_SIMULATION_CHANNELS, CloserSimulationAuthorityError, verifyFounderSimulationAuthority, type CloserSimulationAction, type CloserSimulationAuthorityV1, type CloserSimulationChannel } from "../../../../../../lib/agents/closer-01/simulation-authority";
import { verifyFounderSimulationAuthorityProof, type CloserSimulationAuthorityProofV1 } from "../../../../../../lib/agents/closer-01/simulation-authority-proof";
import { FirestoreAtomicSimulationConsumptionCoordinator, CloserSimulationConsumptionError } from "../../../../../../lib/agents/closer-01/simulation-consumption";
import { CloserSimulationError, executeFounderReviewedSimulation } from "../../../../../../lib/agents/closer-01/simulation";
import { CloserProviderProjectionError } from "../../../../../../lib/agents/closer-01/provider-projection";
import { CloserProviderError, CLOSER_PROVIDER_MODEL, OpenAIResponsesCloserProvider } from "../../../../../../lib/agents/closer-01/providers/openai-responses";
import { assertCloserLocalDemoEnvironment } from "../../../../../../lib/agents/closer-01/local-demo-guard";
import { DeterministicFixtureSimulationGenerator } from "../../../../../../lib/agents/closer-01/simulation-generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX = 32_768, GOAL = "692a00c032d7ac1fea441b7d1bdf695fe2d6125e7a47bcd704fde0d17bb446d6";
const PRODUCTION_CLOSER_PREPARATION_DEFAULT_ENABLED = false as const;
const families: RevenueObjectiveFamily[] = ["complete_proof_milestone", "pursue_standard_paid_conversion", "pursue_repeat_or_retention"];
const headers = { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" } as const;
const out = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
const id = (x: unknown): x is string => typeof x === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(x);
const sha = (x: unknown): x is string => typeof x === "string" && /^[a-f0-9]{64}$/.test(x);
const exact = (x: Record<string, unknown>, keys: string[]) => Object.keys(x).length === keys.length && keys.every(k => Object.hasOwn(x, k));

function parse(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CloserSimulationError("invalid_simulation_request", "Request must be an object.");
  const b = value as Record<string, unknown>;
  const keys = ["accountId", "pursuitId", "runContext", "displayedRecommendationId", "expectedRevisionSetSha256", "selectedFamily", "recipientContactId", "simulationChannelContext", "simulationAction", "approvedPackage", "authority", "authorityProof", "explicitSimulationRequest"];
  if (!exact(b, keys) || !id(b.accountId) || !id(b.pursuitId) || !id(b.displayedRecommendationId) || !sha(b.expectedRevisionSetSha256) || !families.includes(b.selectedFamily as RevenueObjectiveFamily) || !id(b.recipientContactId) || !CLOSER_SIMULATION_CHANNELS.includes(b.simulationChannelContext as CloserSimulationChannel) || !CLOSER_SIMULATION_ACTIONS.includes(b.simulationAction as CloserSimulationAction) || b.explicitSimulationRequest !== true || !b.runContext || typeof b.runContext !== "object" || Array.isArray(b.runContext) || !b.approvedPackage || typeof b.approvedPackage !== "object" || Array.isArray(b.approvedPackage) || !b.authority || typeof b.authority !== "object" || Array.isArray(b.authority) || !b.authorityProof || typeof b.authorityProof !== "object" || Array.isArray(b.authorityProof)) throw new CloserSimulationError("invalid_simulation_request", "Exact bound inputs, the session-only REVENUE package, server-issued authority proof, and a separate explicit preparation request are required.");
  const c = b.runContext as Record<string, unknown>;
  if (!exact(c, ["reportingMonth", "founderSuppliedCollectedBaseline", "baselineEvidenceClassification"])) throw new CloserSimulationError("invalid_simulation_request", "Founder context contains unsupported fields.");
  return { accountId: b.accountId, pursuitId: b.pursuitId, displayedRecommendationId: b.displayedRecommendationId, expectedRevisionSetSha256: b.expectedRevisionSetSha256, selectedFamily: b.selectedFamily as RevenueObjectiveFamily, recipientContactId: b.recipientContactId, simulationChannelContext: b.simulationChannelContext as CloserSimulationChannel, simulationAction: b.simulationAction as CloserSimulationAction, approvedPackage:b.approvedPackage as ApprovedActionPackageV1, authority: b.authority as CloserSimulationAuthorityV1, authorityProof: b.authorityProof as CloserSimulationAuthorityProofV1, explicitSimulationRequest: true as const, runContext: normalizeRevenueRunContext(c as RevenueRunContext) };
}

export async function POST(request: Request) { try {
  const length = Number(request.headers.get("content-length") || "0"); if (length > MAX) return out({ code: "request_too_large", error: "Request exceeds the approved size limit." }, 413);
  const admin = await authorizeCrmAdmin(request, { verifyIdToken: t => adminAuth.verifyIdToken(t), loadUser: async uid => { const u = await adminDb.collection("users").doc(uid).get(); return { exists: u.exists, isAdmin: u.data()?.isAdmin === true }; } });
  const raw = await request.text(); if (Buffer.byteLength(raw, "utf8") > MAX) return out({ code: "request_too_large", error: "Request exceeds the approved size limit." }, 413);
  let decoded: unknown; try { decoded = JSON.parse(raw); } catch { return out({ code: "invalid_json", error: "Request must be valid JSON." }, 400); }
  const input = parse(decoded), now = new Date(),reconstructionAt=new Date(input.authority.approvedAt);
  if(Number.isNaN(reconstructionAt.getTime())||reconstructionAt.getTime()>now.getTime())throw new CloserSimulationError("simulation_scope_mismatch","The prepared authority timestamp is invalid.");
  const reconstructionTimestamp=reconstructionAt.toISOString();
  if (COMMERCIAL_GOAL_SHA256 !== GOAL) throw new RevenueValidationError("commercial_goal_mismatch", "Commercial goal integrity check failed.");
  const [growth, sales, crm, revenue, closer] = await Promise.all([loadGrowthContractMetadata(now), loadSalesContractMetadata(now), loadCrmContractMetadata(now), loadRevenueContractMetadata(now), loadCloserContractMetadata(now)]);
  const [fresh, detail, playbook] = await Promise.all([getCrmRevenueSnapshot({ db: adminDb, accountId: input.accountId, pursuitId: input.pursuitId, generatedAt: reconstructionTimestamp, generatedByUid: admin.uid, crmContractVersion: crm.version, crmContractSha256: crm.sha256 }), getCrmAccountDetail(adminDb, input.accountId, reconstructionTimestamp), resolveCurrentSalesPlaybook(adminDb, input.accountId, input.pursuitId)]);
  const recommendation = await createDeterministicRevenueRecommendation({ snapshot: fresh.snapshot, runContext: input.runContext, now:reconstructionAt });
  const approvedPackage = verifyApprovedActionPackageCurrent({package:input.approvedPackage,recommendation,selectedFamily:input.selectedFamily,displayedRecommendationId:input.displayedRecommendationId,approvedByUid:admin.uid});
  const routingPreview = createWorkforceRoutingPreview({ package: approvedPackage, currentBinding: { accountId: input.accountId, pursuitId: input.pursuitId, crmRevisionSetSha256: fresh.snapshot.revisionBinding.revisionSetSha256 }, createdAt: reconstructionTimestamp });
  const packet = assembleCloserReadinessFromCanonical({ snapshot: fresh.snapshot, detail, salesPlaybook: playbook, recommendation, approvedPackage, routingPreview, contracts: { growth: { version: growth.version, sha256: growth.sha256 }, sales: { version: sales.version, sha256: sales.sha256 }, crm: { version: crm.version, sha256: crm.sha256 }, revenue: { version: revenue.version, sha256: revenue.sha256 }, closer: { version: closer.version, sha256: closer.sha256 } }, uid: admin.uid, generatedAt: reconstructionTimestamp, packetReadinessSelection: { recipientContactId: input.recipientContactId, channel: input.simulationChannelContext } });
  if (input.authority.approvedByUid !== admin.uid || input.authority.binding.accountId !== input.accountId || input.authority.binding.pursuitId !== input.pursuitId || input.authority.selection.recipientContactId !== input.recipientContactId || input.authority.selection.simulationChannelContext !== input.simulationChannelContext || input.authority.selection.simulationAction !== input.simulationAction || input.authority.binding.approvedPackageId !== approvedPackage.packageId || input.authority.binding.approvedPackageSha256 !== approvedPackage.packageSha256 || input.authority.binding.salesPlaybookArtifactId !== playbook.artifactId || input.authority.binding.salesPlaybookArtifactSha256 !== playbook.artifactSha256) throw new CloserSimulationError("simulation_scope_mismatch", "The prepared authority does not match current server-reconstructed scope.");
  verifyFounderSimulationAuthority({ authority: input.authority, currentPacket: packet, now: now.toISOString() });
  verifyFounderSimulationAuthorityProof({authority:input.authority,proof:input.authorityProof,authenticatedUid:admin.uid,now:now.toISOString(),signingSecret:process.env.CLOSER_SIMULATION_AUTHORITY_SIGNING_SECRET??""});
  const durableConsumptionCoordinator = new FirestoreAtomicSimulationConsumptionCoordinator(adminDb);
  const demo=process.env.CLOSER_LOCAL_DEMO_ENABLED==="true"?assertCloserLocalDemoEnvironment():null;
  const preparationEnabled=process.env.CLOSER_PRODUCTION_PREPARATION_ENABLED==="true"||demo!==null;
  if(!preparationEnabled)throw new CloserSimulationError("production_preparation_disabled","Production CLOSER message preparation remains disabled pending separate Founder enablement approval.");
  const generator=demo?new DeterministicFixtureSimulationGenerator():new OpenAIResponsesCloserProvider({apiKey:process.env.OPENAI_API_KEY??"",model:process.env.CLOSER_OPENAI_MODEL??CLOSER_PROVIDER_MODEL});
  const result=await executeFounderReviewedSimulation({authority:input.authority,currentPacket:packet,now:now.toISOString(),explicitSimulationRequest:input.explicitSimulationRequest,coordinator:durableConsumptionCoordinator,generator});
  return out({outcome:"founder_reviewed_unsent_draft",result,draftReviewState:"founder_review_required",sendingAuthorized:false,draftApprovalInherited:false,crmMutation:false,persisted:false,scheduling:false,paymentAction:false,externalAction:false});
} catch (error) {
  if(error instanceof CloserProviderError)return out({code:error.code,error:error.message,providerExecution:{provider:"openai_responses",requestedModel:process.env.CLOSER_OPENAI_MODEL??CLOSER_PROVIDER_MODEL,status:"failed",usage:null},sendingAuthorized:false,retryAttempted:false},error.status);
  if (error instanceof CloserProviderProjectionError || error instanceof CloserSimulationConsumptionError || error instanceof CloserSimulationError || error instanceof CloserSimulationAuthorityError || error instanceof CloserPacketError || error instanceof WorkforceHandoffError || error instanceof RevenueApprovalError || error instanceof RevenueValidationError || error instanceof SalesPlaybookArtifactError) return out({ code: error.code, error: error.message }, 409);
  if (error instanceof CloserContractIntegrityError) return out({ code: "contract_integrity_failed", error: error.message }, 500);
  return crmReadErrorResponse(error);
} }
