import { revenueSha256, revenueStableId } from "./canonical";
import type { RevenueObjectiveFamily, RevenueRecommendationV1 } from "./types";

export const APPROVED_ACTION_PACKAGE_SCHEMA = "revenue-01-approved-action-package-v1" as const;
export const APPROVED_ACTION_PACKAGE_VERSION = "v1" as const;
export const APPROVED_ACTION_PACKAGE_CANONICALIZATION = "revenue-01-approved-action-canonical-json-v1" as const;
export const APPROVED_ACTION_PACKAGE_CONTRACT = {schemaVersion:APPROVED_ACTION_PACKAGE_SCHEMA,version:APPROVED_ACTION_PACKAGE_VERSION,canonicalizationVersion:APPROVED_ACTION_PACKAGE_CANONICALIZATION,maximumAuthority:"prepare",capabilities:{recommend:true,prepare:true,requestApproval:false,execute:false},persistence:"session_only",executionAuthorized:false,downstreamInvocationAuthorized:false} as const;
export const APPROVED_ACTION_PACKAGE_CONTRACT_SHA256 = revenueSha256(APPROVED_ACTION_PACKAGE_CONTRACT);

export class RevenueApprovalError extends Error { code:string; constructor(code:string,message:string){super(message);this.name="RevenueApprovalError";this.code=code;} }

export type ApprovedActionPackageV1 = {
  schemaVersion:typeof APPROVED_ACTION_PACKAGE_SCHEMA;
  version:typeof APPROVED_ACTION_PACKAGE_VERSION;
  canonicalizationVersion:typeof APPROVED_ACTION_PACKAGE_CANONICALIZATION;
  schemaContractSha256:string;
  packageId:string;
  packageSha256:string;
  createdAt:string;
  approvedAt:string;
  approvedByUid:string;
  status:"APPROVED";
  handoffPackageState:"CREATED";
  sourceIntent:{displayedRecommendationId:string;selectedFamily:RevenueObjectiveFamily};
  binding:RevenueRecommendationV1["binding"];
  identities:{recommendationSchemaVersion:RevenueRecommendationV1["schemaVersion"];freshRecommendationId:string;freshRecommendationSha256:string};
  selectedRecommendation:{selection:"primary"|"alternative";family:RevenueObjectiveFamily;objective:string;assignmentType:string;rationale:string;intendedDownstreamOperative:RevenueRecommendationV1["recommendation"]["owningAgent"]|null};
  prerequisites:RevenueRecommendationV1["deterministicAssessment"]["prerequisites"];
  blockers:RevenueRecommendationV1["deterministicAssessment"]["blockers"];
  evidenceIds:string[];
  assumptions:string[];
  unknowns:string[];
  successCondition:string;
  requiredEvidence:string[];
  authority:{maximum:"prepare";capabilities:{recommend:true;prepare:true;requestApproval:false;execute:false};permitted:["prepare"];prohibited:["external_messaging","crm_mutation","payment_action","stripe_action","scheduling","provider_external_effect","closer_execution","sales_execution","growth_execution","autonomous_downstream_invocation","production_mutation"];executionAuthorized:false;downstreamInvocationAuthorized:false};
  persistence:{persisted:false;sessionOnly:true};
};

export function buildApprovedActionPackage(params:{recommendation:RevenueRecommendationV1;selectedFamily:RevenueObjectiveFamily;displayedRecommendationId:string;expectedRevisionSetSha256:string;approvedByUid:string;approvedAt:string}):ApprovedActionPackageV1{
  const {recommendation:r}=params;
  if(params.expectedRevisionSetSha256!==r.binding.crmRevisionSetSha256)throw new RevenueApprovalError("stale_recommendation","Canonical CRM revisions changed after Founder review. Generate and review a fresh recommendation.");
  const isPrimary=params.selectedFamily===r.recommendation.family;
  const eligibility=r.deterministicAssessment.eligibility.find(x=>x.family===params.selectedFamily);
  if(!isPrimary&&!r.alternatives.some(x=>x.family===params.selectedFamily))throw new RevenueApprovalError("recommendation_no_longer_eligible","The selected recommendation is no longer an engine-provided eligible choice.");
  if(!eligibility?.eligible)throw new RevenueApprovalError("recommendation_no_longer_eligible","The selected recommendation is not eligible under the fresh deterministic assessment.");
  const objective=isPrimary?r.recommendation.desiredOutcome:eligibility.desiredOutcome;
  const success=isPrimary?r.recommendation.successCondition:eligibility.successCondition;
  if(!objective||!success)throw new RevenueApprovalError("recommendation_incomplete","The selected recommendation does not contain a complete deterministic objective.");
  const operative=isPrimary?r.recommendation.owningAgent:null;
  const body={schemaVersion:APPROVED_ACTION_PACKAGE_SCHEMA,version:APPROVED_ACTION_PACKAGE_VERSION,canonicalizationVersion:APPROVED_ACTION_PACKAGE_CANONICALIZATION,schemaContractSha256:APPROVED_ACTION_PACKAGE_CONTRACT_SHA256,createdAt:params.approvedAt,approvedAt:params.approvedAt,approvedByUid:params.approvedByUid,status:"APPROVED" as const,handoffPackageState:"CREATED" as const,sourceIntent:{displayedRecommendationId:params.displayedRecommendationId,selectedFamily:params.selectedFamily},binding:r.binding,identities:{recommendationSchemaVersion:r.schemaVersion,freshRecommendationId:r.identity.recommendationId,freshRecommendationSha256:r.identity.recommendationSha256},selectedRecommendation:{selection:isPrimary?"primary" as const:"alternative" as const,family:params.selectedFamily,objective,assignmentType:isPrimary?r.recommendation.assignmentType:eligibility.assignmentType,rationale:isPrimary?r.recommendation.rationale:eligibility.reasons.join(" "),intendedDownstreamOperative:operative},prerequisites:r.deterministicAssessment.prerequisites,blockers:r.deterministicAssessment.blockers,evidenceIds:r.observedState.evidenceIds,assumptions:r.recommendation.assumptions,unknowns:r.recommendation.unknowns,successCondition:success,requiredEvidence:isPrimary?r.recommendation.requiredSuccessEvidence:eligibility.requiredEvidence,authority:{maximum:"prepare" as const,capabilities:{recommend:true as const,prepare:true as const,requestApproval:false as const,execute:false as const},permitted:["prepare"] as ["prepare"],prohibited:["external_messaging","crm_mutation","payment_action","stripe_action","scheduling","provider_external_effect","closer_execution","sales_execution","growth_execution","autonomous_downstream_invocation","production_mutation"] as ApprovedActionPackageV1["authority"]["prohibited"],executionAuthorized:false as const,downstreamInvocationAuthorized:false as const},persistence:{persisted:false as const,sessionOnly:true as const}};
  return{...body,packageId:revenueStableId("revact",body),packageSha256:revenueSha256(body)};
}
