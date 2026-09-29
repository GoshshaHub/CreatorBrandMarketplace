import { APPROVED_ACTION_PACKAGE_CONTRACT_SHA256, APPROVED_ACTION_PACKAGE_SCHEMA, type ApprovedActionPackageV1 } from "../revenue-01/approved-action";
import { revenueSha256, revenueStableId } from "../revenue-01/canonical";
import type { RevenueAssignmentType, RevenueObjectiveFamily } from "../revenue-01/types";

export const WORKFORCE_HANDOFF_SCHEMA="goshsha-workforce-handoff-v1" as const;
export const WORKFORCE_HANDOFF_VERSION="v1" as const;
export const WORKFORCE_HANDOFF_CANONICALIZATION="goshsha-workforce-handoff-canonical-json-v1" as const;
export const WORKFORCE_HANDOFF_CONTRACT={schemaVersion:WORKFORCE_HANDOFF_SCHEMA,version:WORKFORCE_HANDOFF_VERSION,canonicalizationVersion:WORKFORCE_HANDOFF_CANONICALIZATION,deliveryState:"validated_not_delivered",receiverInvoked:false,executionAuthorized:false,persisted:false,maximumAuthority:"prepare"}as const;
export const WORKFORCE_HANDOFF_CONTRACT_SHA256=revenueSha256(WORKFORCE_HANDOFF_CONTRACT);
export const APPROVED_WORKFORCE_HANDOFF_CONTRACT_SHA256="9b7afb2d91251fc0167d28ab3ea9d5190f697e7e125a7c29008cadf548bfa1b6" as const;

export const WORKFORCE_RECEIVER_REGISTRY_VERSION="goshsha-workforce-receiver-registry-v1" as const;
export const WORKFORCE_RECEIVER_REGISTRY={version:WORKFORCE_RECEIVER_REGISTRY_VERSION,receivers:{
  "CRM-01":{contractVersion:"V1.1",contractSha256:"68129fc2d2d4fdd5646b93879d0b469a71c3ef4c93e84fd0e4aaccc011fa8194",capabilityId:"canonical-resolution-preparation-v1",mode:"preparation_preview_only",families:["resolve_evidence_or_safety_blocker","pause_no_commercial_action"],assignmentTypes:["None"],invocationAuthorized:false,mutationAuthorized:false},
  "SALES-01":{contractVersion:"V1.2",contractSha256:"0428ae67558fb21d288e3588139a8f46d2fdd17cc436b07f7ce1f17f14c265e6",capabilityId:"strategy-playbook-preparation-v1",mode:"preparation_preview_only",families:["establish_qualified_engagement"],assignmentTypes:["Pursuit"],invocationAuthorized:false,providerAuthorized:false,outreachAuthorized:false},
  "future CLOSER-01":{contractVersion:"V1",contractSha256:"097371ac3333f12321ae834c805eece1e2f6a967009de44bf742df4242cb0368",capabilityId:"tier0-simulation-preparation-v1",mode:"tier0_simulation_preview_only",families:["complete_proof_milestone","pursue_standard_paid_conversion","pursue_repeat_or_retention"],assignmentTypes:["Proof / Progression","Conversion","Expansion / Retention"],invocationAuthorized:false,requiredInputs:["conversationThreadId","growthSourceVersion","salesPlaybookIdVersion","crmCanonicalRevision","revenueObjectiveIdVersionState","founderAuthorityIdVersion","recipientParticipantChannelScope","freshnessAndSupersession"]},
  "GROWTH-01":{contractVersion:"V1",contractSha256:"618b895eb97479db83edc668a32bc4db93a222429b27e2a8f6cbadc2bbb7e860",capabilityId:null,mode:"unsupported",families:[],assignmentTypes:[],invocationAuthorized:false}
}}as const;
export const WORKFORCE_RECEIVER_REGISTRY_SHA256=revenueSha256(WORKFORCE_RECEIVER_REGISTRY);
export const APPROVED_WORKFORCE_RECEIVER_REGISTRY_SHA256="8907bd68c96c41a029894b136079e36805465af194c991a734e244eae93ee3b6" as const;

export class WorkforceHandoffError extends Error{code:string;constructor(code:string,message:string){super(message);this.name="WorkforceHandoffError";this.code=code;}}
type ReceiverName=keyof typeof WORKFORCE_RECEIVER_REGISTRY.receivers;
export type WorkforceRoutingPreviewV1={schemaVersion:typeof WORKFORCE_HANDOFF_SCHEMA;version:typeof WORKFORCE_HANDOFF_VERSION;canonicalizationVersion:typeof WORKFORCE_HANDOFF_CANONICALIZATION;handoffContractSha256:string;receiverRegistryVersion:typeof WORKFORCE_RECEIVER_REGISTRY_VERSION;receiverRegistrySha256:string;handoffId:string;handoffSha256:string;createdAt:string;sourceOperative:"REVENUE-01";sourcePackage:{schemaVersion:typeof APPROVED_ACTION_PACKAGE_SCHEMA;packageId:string;packageSha256:string;contractSha256:string};binding:{accountId:string;pursuitId:string;crmSnapshotId:string;crmSnapshotSha256:string;crmRevisionSetSha256:string};objective:{family:RevenueObjectiveFamily;assignmentType:RevenueAssignmentType};requestedDestination:ApprovedActionPackageV1["selectedRecommendation"]["intendedDownstreamOperative"];validatedDestination:ReceiverName|null;receiverCapability:{receiver:ReceiverName;operativeContractVersion:string;capabilityId:string;mode:string}|null;compatibility:"compatible"|"incompatible";reasons:string[];authority:{inheritedMaximum:"prepare";inheritedProhibited:ApprovedActionPackageV1["authority"]["prohibited"];permitted:["validate","preview_routing"];executionAuthorized:false;downstreamInvocationAuthorized:false};deliveryState:"validated_not_delivered";receiverInvoked:false;executionAuthorized:false;persisted:false};

function verifyPackage(p:ApprovedActionPackageV1){
  if(p.schemaVersion!==APPROVED_ACTION_PACKAGE_SCHEMA)throw new WorkforceHandoffError("package_schema_unknown","The source package schema is unsupported.");
  if(p.schemaContractSha256!==APPROVED_ACTION_PACKAGE_CONTRACT_SHA256)throw new WorkforceHandoffError("package_contract_mismatch","The source package contract identity is invalid.");
  const{packageId,packageSha256,...body}=p;
  if(revenueSha256(body)!==packageSha256||revenueStableId("revact",body)!==packageId)throw new WorkforceHandoffError("package_integrity_failed","The source package identity or hash is invalid.");
  if(p.authority.maximum!=="prepare"||p.authority.executionAuthorized||p.authority.downstreamInvocationAuthorized||p.authority.capabilities.execute||p.persistence.persisted||!p.persistence.sessionOnly)throw new WorkforceHandoffError("authority_escalation","The source package exceeds the approved prepare-only authority.");
}

export function verifyWorkforceContractIntegrity(){if(WORKFORCE_HANDOFF_CONTRACT_SHA256!==APPROVED_WORKFORCE_HANDOFF_CONTRACT_SHA256)throw new WorkforceHandoffError("handoff_contract_drift","The workforce handoff contract failed its approved integrity check.");if(WORKFORCE_RECEIVER_REGISTRY_SHA256!==APPROVED_WORKFORCE_RECEIVER_REGISTRY_SHA256)throw new WorkforceHandoffError("receiver_registry_drift","The workforce receiver registry failed its approved integrity check.");}

export function createWorkforceRoutingPreview(params:{package:ApprovedActionPackageV1;currentBinding:{accountId:string;pursuitId:string;crmRevisionSetSha256:string};createdAt:string}) : WorkforceRoutingPreviewV1{
  verifyWorkforceContractIntegrity();const p=params.package;verifyPackage(p);
  if(p.binding.accountId!==params.currentBinding.accountId||p.binding.pursuitId!==params.currentBinding.pursuitId)throw new WorkforceHandoffError("scope_mismatch","The source package Account/Pursuit does not match current authoritative scope.");
  if(p.binding.crmRevisionSetSha256!==params.currentBinding.crmRevisionSetSha256)throw new WorkforceHandoffError("stale_binding","The source package CRM revision binding is stale.");
  const requested=p.selectedRecommendation.intendedDownstreamOperative;
  const reasons:string[]=[];let validated:ReceiverName|null=null,capability:WorkforceRoutingPreviewV1["receiverCapability"]=null;
  if(!requested)reasons.push("No authoritative destination exists; routing cannot be inferred.");
  else if(!(requested in WORKFORCE_RECEIVER_REGISTRY.receivers))reasons.push("The authoritative destination is unsupported by the receiver registry.");
  else{
    const receiver=requested as ReceiverName,entry=WORKFORCE_RECEIVER_REGISTRY.receivers[receiver],family=p.selectedRecommendation.family,assignment=p.selectedRecommendation.assignmentType;
    if(entry.capabilityId===null)reasons.push(`${receiver} declares no REVENUE-package receiver capability.`);
    if(!(entry.families as readonly string[]).includes(family))reasons.push("The objective family is incompatible with the destination capability.");
    if(!(entry.assignmentTypes as readonly string[]).includes(assignment))reasons.push("The assignment type is incompatible with the destination capability.");
    if(receiver==="future CLOSER-01")reasons.push("The authoritative Conversation Intelligence Packet required for CLOSER Tier-0 simulation is incomplete.");
    if(!reasons.length&&entry.capabilityId){validated=receiver;capability={receiver,operativeContractVersion:entry.contractVersion,capabilityId:entry.capabilityId,mode:entry.mode};}
  }
  const body={schemaVersion:WORKFORCE_HANDOFF_SCHEMA,version:WORKFORCE_HANDOFF_VERSION,canonicalizationVersion:WORKFORCE_HANDOFF_CANONICALIZATION,handoffContractSha256:WORKFORCE_HANDOFF_CONTRACT_SHA256,receiverRegistryVersion:WORKFORCE_RECEIVER_REGISTRY_VERSION,receiverRegistrySha256:WORKFORCE_RECEIVER_REGISTRY_SHA256,createdAt:params.createdAt,sourceOperative:"REVENUE-01" as const,sourcePackage:{schemaVersion:p.schemaVersion,packageId:p.packageId,packageSha256:p.packageSha256,contractSha256:p.schemaContractSha256},binding:{accountId:p.binding.accountId,pursuitId:p.binding.pursuitId,crmSnapshotId:p.binding.crmSnapshotId,crmSnapshotSha256:p.binding.crmSnapshotSha256,crmRevisionSetSha256:p.binding.crmRevisionSetSha256},objective:{family:p.selectedRecommendation.family,assignmentType:p.selectedRecommendation.assignmentType as RevenueAssignmentType},requestedDestination:requested,validatedDestination:validated,receiverCapability:capability,compatibility:validated?"compatible" as const:"incompatible" as const,reasons,authority:{inheritedMaximum:p.authority.maximum,inheritedProhibited:p.authority.prohibited,permitted:["validate","preview_routing"]as["validate","preview_routing"],executionAuthorized:false as const,downstreamInvocationAuthorized:false as const},deliveryState:"validated_not_delivered" as const,receiverInvoked:false as const,executionAuthorized:false as const,persisted:false as const};
  return{...body,handoffId:revenueStableId("wfho",body),handoffSha256:revenueSha256(body)};
}
