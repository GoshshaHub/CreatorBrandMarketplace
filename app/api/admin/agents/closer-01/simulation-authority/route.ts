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
import { buildFounderSimulationAuthority, buildFounderSimulationAuthorityPreview, CLOSER_SIMULATION_ACTIONS, CLOSER_SIMULATION_CHANNELS, CloserSimulationAuthorityError, verifyFounderSimulationAuthorityPreview, type CloserSimulationAction, type CloserSimulationChannel } from "../../../../../../lib/agents/closer-01/simulation-authority";
import { issueFounderSimulationAuthorityProof } from "../../../../../../lib/agents/closer-01/simulation-authority-proof";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX = 32_768, GOAL = "692a00c032d7ac1fea441b7d1bdf695fe2d6125e7a47bcd704fde0d17bb446d6";
const families: RevenueObjectiveFamily[] = ["complete_proof_milestone","pursue_standard_paid_conversion","pursue_repeat_or_retention"];
const headers = { "Cache-Control":"no-store, max-age=0", Pragma:"no-cache" } as const;
const out = (body:unknown,status=200) => NextResponse.json(body,{status,headers});
const id = (x:unknown):x is string => typeof x === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(x);
const sha = (x:unknown):x is string => typeof x === "string" && /^[a-f0-9]{64}$/.test(x);
const exact = (x:Record<string,unknown>,keys:string[]) => Object.keys(x).length === keys.length && keys.every(k => Object.hasOwn(x,k));
function parse(value:unknown){
  if(!value||typeof value!=="object"||Array.isArray(value))throw new CloserSimulationAuthorityError("invalid_authority_request","Request must be an object.");
  const b=value as Record<string,unknown>,common=["mode","accountId","pursuitId","runContext","displayedRecommendationId","expectedRevisionSetSha256","selectedFamily","recipientContactId","simulationChannelContext","simulationAction","approvedPackage"],mode=b.mode;
  const keys=mode==="preview"?common:mode==="approve"?[...common,"previewCreatedAt","expectedPreviewId","expectedPreviewSha256","explicitFounderApproval"]:[];
  if(!keys.length||!exact(b,keys)||!id(b.accountId)||!id(b.pursuitId)||!id(b.displayedRecommendationId)||!sha(b.expectedRevisionSetSha256)||!families.includes(b.selectedFamily as RevenueObjectiveFamily)||!id(b.recipientContactId)||!CLOSER_SIMULATION_CHANNELS.includes(b.simulationChannelContext as CloserSimulationChannel)||!CLOSER_SIMULATION_ACTIONS.includes(b.simulationAction as CloserSimulationAction)||!b.runContext||typeof b.runContext!=="object"||Array.isArray(b.runContext)||!b.approvedPackage||typeof b.approvedPackage!=="object"||Array.isArray(b.approvedPackage))throw new CloserSimulationAuthorityError("invalid_authority_request","Exact bound inputs and the session-only REVENUE Approved Action Package are required.");
  if(mode==="approve"&&(!id(b.expectedPreviewId)||!sha(b.expectedPreviewSha256)||typeof b.previewCreatedAt!=="string"||Number.isNaN(Date.parse(b.previewCreatedAt))||b.explicitFounderApproval!==true))throw new CloserSimulationAuthorityError("invalid_authority_request","Exact preview identity and explicit Founder approval are required.");
  const c=b.runContext as Record<string,unknown>;if(!exact(c,["reportingMonth","founderSuppliedCollectedBaseline","baselineEvidenceClassification"]))throw new CloserSimulationAuthorityError("invalid_authority_request","Founder context contains unsupported fields.");
  return{mode:mode as "preview"|"approve",accountId:b.accountId,pursuitId:b.pursuitId,displayedRecommendationId:b.displayedRecommendationId,expectedRevisionSetSha256:b.expectedRevisionSetSha256,selectedFamily:b.selectedFamily as RevenueObjectiveFamily,recipientContactId:b.recipientContactId,simulationChannelContext:b.simulationChannelContext as CloserSimulationChannel,simulationAction:b.simulationAction as CloserSimulationAction,approvedPackage:b.approvedPackage as ApprovedActionPackageV1,runContext:normalizeRevenueRunContext(c as RevenueRunContext),previewCreatedAt:b.previewCreatedAt as string|undefined,expectedPreviewId:b.expectedPreviewId as string|undefined,expectedPreviewSha256:b.expectedPreviewSha256 as string|undefined,explicitFounderApproval:b.explicitFounderApproval===true};
}

export async function POST(request:Request){try{
  const length=Number(request.headers.get("content-length")||"0");if(length>MAX)return out({code:"request_too_large",error:"Request exceeds the approved size limit."},413);
  const admin=await authorizeCrmAdmin(request,{verifyIdToken:t=>adminAuth.verifyIdToken(t),loadUser:async uid=>{const u=await adminDb.collection("users").doc(uid).get();return{exists:u.exists,isAdmin:u.data()?.isAdmin===true};}});
  const raw=await request.text();if(Buffer.byteLength(raw,"utf8")>MAX)return out({code:"request_too_large",error:"Request exceeds the approved size limit."},413);
  let decoded:unknown;try{decoded=JSON.parse(raw);}catch{return out({code:"invalid_json",error:"Request must be valid JSON."},400);}const input=parse(decoded),now=new Date(),previewAt=input.mode==="approve"?new Date(input.previewCreatedAt!):now;
  if(previewAt.getTime()>now.getTime())throw new CloserSimulationAuthorityError("preview_time_invalid","Preview time cannot be in the future.");
  const previewTimestamp=previewAt.toISOString();
  if(COMMERCIAL_GOAL_SHA256!==GOAL)throw new RevenueValidationError("commercial_goal_mismatch","Commercial goal integrity check failed.");
  const[growth,sales,crm,revenue,closer]=await Promise.all([loadGrowthContractMetadata(now),loadSalesContractMetadata(now),loadCrmContractMetadata(now),loadRevenueContractMetadata(now),loadCloserContractMetadata(now)]);
  const[fresh,detail,playbook]=await Promise.all([getCrmRevenueSnapshot({db:adminDb,accountId:input.accountId,pursuitId:input.pursuitId,generatedAt:previewTimestamp,generatedByUid:admin.uid,crmContractVersion:crm.version,crmContractSha256:crm.sha256}),getCrmAccountDetail(adminDb,input.accountId,previewTimestamp),resolveCurrentSalesPlaybook(adminDb,input.accountId,input.pursuitId)]);
  const recommendation=await createDeterministicRevenueRecommendation({snapshot:fresh.snapshot,runContext:input.runContext,now:previewAt});
  const approvedPackage=verifyApprovedActionPackageCurrent({package:input.approvedPackage,recommendation,selectedFamily:input.selectedFamily,displayedRecommendationId:input.displayedRecommendationId,approvedByUid:admin.uid});
  const routingPreview=createWorkforceRoutingPreview({package:approvedPackage,currentBinding:{accountId:input.accountId,pursuitId:input.pursuitId,crmRevisionSetSha256:fresh.snapshot.revisionBinding.revisionSetSha256},createdAt:previewTimestamp});
  const packet=assembleCloserReadinessFromCanonical({snapshot:fresh.snapshot,detail,salesPlaybook:playbook,recommendation,approvedPackage,routingPreview,contracts:{growth:{version:growth.version,sha256:growth.sha256},sales:{version:sales.version,sha256:sales.sha256},crm:{version:crm.version,sha256:crm.sha256},revenue:{version:revenue.version,sha256:revenue.sha256},closer:{version:closer.version,sha256:closer.sha256}},uid:admin.uid,generatedAt:previewTimestamp,packetReadinessSelection:{recipientContactId:input.recipientContactId,channel:input.simulationChannelContext}});
  const proposedAuthority=buildFounderSimulationAuthority({packet,snapshot:fresh.snapshot,detail,playbook,approvedPackage,recipientContactId:input.recipientContactId,simulationChannelContext:input.simulationChannelContext,simulationAction:input.simulationAction,approvedByUid:admin.uid,approvedAt:previewAt.toISOString()});
  const preview=buildFounderSimulationAuthorityPreview(proposedAuthority);
  if(input.mode==="preview")return out({outcome:"founder_simulation_authority_previewed",packetReadiness:packet.readiness,authorityPreview:preview,exactFounderApprovalRequired:true,simulationGenerated:false,closerInvoked:false,messageGenerated:false,recommendedNextActionGenerated:false,crmMutation:false,providerInvocation:false,persisted:false,scheduling:false,paymentAction:false,externalAction:false});
  verifyFounderSimulationAuthorityPreview({preview,reconstructedAuthority:proposedAuthority,expectedPreviewId:input.expectedPreviewId!,expectedPreviewSha256:input.expectedPreviewSha256!,explicitFounderApproval:input.explicitFounderApproval,now:now.toISOString()});
  const authority=proposedAuthority;
  const authorityProof=issueFounderSimulationAuthorityProof({authority,issuedAt:now.toISOString(),signingSecret:process.env.CLOSER_SIMULATION_AUTHORITY_SIGNING_SECRET??""});
  return out({outcome:"founder_simulation_authority_prepared",packetReadiness:packet.readiness,simulationAuthority:"prepared",simulationReadiness:"production_preparation_gate_disabled_by_default",authority,authorityProof,simulationGenerated:false,closerInvoked:false,messageGenerated:false,recommendedNextActionGenerated:false,crmMutation:false,providerInvocation:false,persisted:false,scheduling:false,paymentAction:false,externalAction:false});
}catch(error){if(error instanceof CloserSimulationAuthorityError||error instanceof CloserPacketError||error instanceof WorkforceHandoffError||error instanceof RevenueApprovalError||error instanceof RevenueValidationError||error instanceof SalesPlaybookArtifactError)return out({code:error.code,error:error.message},409);if(error instanceof CloserContractIntegrityError)return out({code:"contract_integrity_failed",error:error.message},500);return crmReadErrorResponse(error);}}
