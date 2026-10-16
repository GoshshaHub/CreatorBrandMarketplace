import { revenueSha256, revenueStableId } from "./canonical";
import type { RevenueObjectiveFamily, RevenueRecommendationV1 } from "./types";

export const APPROVED_ACTION_PACKAGE_SCHEMA = "revenue-01-approved-action-package-v2" as const;
export const APPROVED_ACTION_PACKAGE_VERSION = "v2" as const;
export const APPROVED_ACTION_PACKAGE_CANONICALIZATION = "revenue-01-approved-action-canonical-json-v2" as const;
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
  selectedRecommendation:{selection:"primary"|"alternative";family:RevenueObjectiveFamily;objective:string;assignmentType:string;rationale:string;semanticOwner:RevenueRecommendationV1["recommendation"]["semanticOwner"]|null;intendedDownstreamOperative:RevenueRecommendationV1["recommendation"]["preparationReceiver"]};
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
  const semanticOwner=isPrimary?r.recommendation.semanticOwner:null;
  const operative=isPrimary?r.recommendation.preparationReceiver:null;
  const body={schemaVersion:APPROVED_ACTION_PACKAGE_SCHEMA,version:APPROVED_ACTION_PACKAGE_VERSION,canonicalizationVersion:APPROVED_ACTION_PACKAGE_CANONICALIZATION,schemaContractSha256:APPROVED_ACTION_PACKAGE_CONTRACT_SHA256,createdAt:params.approvedAt,approvedAt:params.approvedAt,approvedByUid:params.approvedByUid,status:"APPROVED" as const,handoffPackageState:"CREATED" as const,sourceIntent:{displayedRecommendationId:params.displayedRecommendationId,selectedFamily:params.selectedFamily},binding:r.binding,identities:{recommendationSchemaVersion:r.schemaVersion,freshRecommendationId:r.identity.recommendationId,freshRecommendationSha256:r.identity.recommendationSha256},selectedRecommendation:{selection:isPrimary?"primary" as const:"alternative" as const,family:params.selectedFamily,objective,assignmentType:isPrimary?r.recommendation.assignmentType:eligibility.assignmentType,rationale:isPrimary?r.recommendation.rationale:eligibility.reasons.join(" "),semanticOwner,intendedDownstreamOperative:operative},prerequisites:r.deterministicAssessment.prerequisites,blockers:r.deterministicAssessment.blockers,evidenceIds:r.observedState.evidenceIds,assumptions:r.recommendation.assumptions,unknowns:r.recommendation.unknowns,successCondition:success,requiredEvidence:isPrimary?r.recommendation.requiredSuccessEvidence:eligibility.requiredEvidence,authority:{maximum:"prepare" as const,capabilities:{recommend:true as const,prepare:true as const,requestApproval:false as const,execute:false as const},permitted:["prepare"] as ["prepare"],prohibited:["external_messaging","crm_mutation","payment_action","stripe_action","scheduling","provider_external_effect","closer_execution","sales_execution","growth_execution","autonomous_downstream_invocation","production_mutation"] as ApprovedActionPackageV1["authority"]["prohibited"],executionAuthorized:false as const,downstreamInvocationAuthorized:false as const},persistence:{persisted:false as const,sessionOnly:true as const}};
  return{...body,packageId:revenueStableId("revact",body),packageSha256:revenueSha256(body)};
}

export function verifyApprovedActionPackageCurrent(params:{package:ApprovedActionPackageV1;recommendation:RevenueRecommendationV1;selectedFamily:RevenueObjectiveFamily;displayedRecommendationId:string;approvedByUid:string}):ApprovedActionPackageV1{
  const p=params.package,{packageId,packageSha256,...body}=p;
  if(packageId!==revenueStableId("revact",body)||packageSha256!==revenueSha256(body))throw new RevenueApprovalError("approved_package_mismatch","The session-only REVENUE Approved Action Package is malformed or altered.");
  if(p.schemaVersion!==APPROVED_ACTION_PACKAGE_SCHEMA||p.version!==APPROVED_ACTION_PACKAGE_VERSION||p.canonicalizationVersion!==APPROVED_ACTION_PACKAGE_CANONICALIZATION||p.schemaContractSha256!==APPROVED_ACTION_PACKAGE_CONTRACT_SHA256||p.status!=="APPROVED"||p.handoffPackageState!=="CREATED"||p.approvedByUid!==params.approvedByUid||p.sourceIntent.displayedRecommendationId!==params.displayedRecommendationId||p.sourceIntent.selectedFamily!==params.selectedFamily||p.selectedRecommendation.family!==params.selectedFamily)throw new RevenueApprovalError("approved_package_mismatch","The session-only REVENUE Approved Action Package is missing, altered, or outside the approved scope.");
  const r=params.recommendation;
  if(p.binding.accountId!==r.binding.accountId||p.binding.pursuitId!==r.binding.pursuitId||p.binding.crmRevisionSetSha256!==r.binding.crmRevisionSetSha256||p.binding.crmContractSha256!==r.binding.crmContractSha256||p.binding.offerCatalogSha256!==r.binding.offerCatalogSha256||p.binding.revenueContractSha256!==r.binding.revenueContractSha256)throw new RevenueApprovalError("approved_package_mismatch","The session-only REVENUE Approved Action Package is stale for the current authoritative context.");
  const primary=params.selectedFamily===r.recommendation.family,eligibility=r.deterministicAssessment.eligibility.find(x=>x.family===params.selectedFamily);
  if((!primary&&!r.alternatives.some(x=>x.family===params.selectedFamily))||!eligibility?.eligible)throw new RevenueApprovalError("recommendation_no_longer_eligible","The approved REVENUE objective is no longer eligible under the current deterministic assessment.");
  const objective=primary?r.recommendation.desiredOutcome:eligibility.desiredOutcome,success=primary?r.recommendation.successCondition:eligibility.successCondition;
  if(!objective||!success||p.selectedRecommendation.objective!==objective||p.successCondition!==success)throw new RevenueApprovalError("approved_package_mismatch","The approved REVENUE objective no longer matches the current deterministic assessment.");
  return p;
}
