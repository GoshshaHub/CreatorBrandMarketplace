import { revenueSha256, revenueStableId } from "../revenue-01/canonical";

export const CLOSER_OBJECTION_TAXONOMY_SCHEMA="closer-01-objection-taxonomy-v1" as const;
export const CLOSER_OBJECTION_SUMMARY_SCHEMA="closer-01-recurring-objection-summary-v1" as const;
export const CLOSER_PATTERN_REVIEW_PROPOSAL_SCHEMA="closer-01-pattern-review-proposal-v1" as const;
export const CLOSER_PATTERN_REVIEW_ITEM_SCHEMA="closer-01-pattern-review-item-v1" as const;

export function classifyObjection(statement:string){
  const normalized=statement.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  if(/\b(how many users|how many people|audience size|size of (?:the |your )?audience|how (?:large|big) (?:is )?(?:the |your )?audience|audience reach)\b/.test(normalized))return{categoryId:"audience_size_reach",label:"Audience size or reach",rule:"Explicit audience/user-count or reach wording"};
  if(/\b(custom implementation|custom build|guaranteed roi|guarantee roi|discount)\b/.test(normalized))return{categoryId:"custom_scope_guarantee_discount",label:"Custom scope, guarantee, or discount",rule:"Explicit custom implementation, ROI guarantee, or discount wording"};
  return{categoryId:`other_${revenueSha256(normalized).slice(0,12)}`,label:"Other distinct objection",rule:"No approved equivalence rule matched"};
}

export function buildObjectionPatternSummary(params:{assessments:any[];specialistArtifacts?:any[];dispositions?:any[];appliedRevisions?:any[];contextRevision:number}){
  const groups=new Map<string,any>();
  const seenAssessment=new Set<string>();
  for(const value of params.assessments){
    if(!value?.assessmentId||seenAssessment.has(value.assessmentId))continue;
    seenAssessment.add(value.assessmentId);
    const statement=String(value.sourceEvidence?.exactAttributedStatement??"").trim();
    if(!statement)continue;
    const taxonomy=classifyObjection(statement), key=taxonomy.categoryId;
    const group=groups.get(key)??{...taxonomy,coverage:new Set<string>(),materiality:new Set<string>(),sources:new Map<string,any>(),assessmentIds:new Set<string>(),prospects:new Set<string>(),accounts:new Set<string>(),specialistArtifactIds:new Set<string>(),unresolvedDependencies:new Set<string>(),approvedChangeIds:new Set<string>()};
    group.assessmentIds.add(value.assessmentId);group.coverage.add(String(value.assessment?.playbookCoverage??"unknown"));group.materiality.add(value.assessment?.commerciallyMaterial===true?"material":"not_material");
    const binding=value.binding??{}, prospectId=String(binding.contactId??`${binding.accountId??"unknown"}:${binding.conversationId??"unknown"}`), sourceKey=[binding.accountId,binding.pursuitId,binding.conversationId,binding.interactionId].join("|");
    group.prospects.add(prospectId);group.accounts.add(String(binding.accountId??"unknown"));
    const prior=group.sources.get(sourceKey);if(prior)prior.assessmentIds=[...new Set([...prior.assessmentIds,value.assessmentId])].sort();else group.sources.set(sourceKey,{accountId:binding.accountId,pursuitId:binding.pursuitId,conversationId:binding.conversationId,interactionId:binding.interactionId,prospectId,exactAttributedStatement:statement,provenance:value.sourceEvidence?.provenance??"unknown",syntheticDemo:value.syntheticDemo===true,authenticProductionEvidence:value.sourceEvidence?.authenticProductionEvidence===true,assessmentIds:[value.assessmentId]});
    groups.set(key,group);
  }
  for(const artifact of params.specialistArtifacts??[]){const assessment=params.assessments.find(x=>x.assessmentId===artifact.assessmentId);if(!assessment)continue;const group=groups.get(classifyObjection(String(assessment.sourceEvidence?.exactAttributedStatement??"")).categoryId);if(!group)continue;group.specialistArtifactIds.add(artifact.artifactId);for(const dependency of artifact.analysis?.unresolvedDependencies??[])group.unresolvedDependencies.add(dependency)}
  for(const revision of params.appliedRevisions??[]){const assessment=params.assessments.find(x=>x.assessmentId===revision.lineage?.assessmentId);if(assessment)groups.get(classifyObjection(String(assessment.sourceEvidence?.exactAttributedStatement??"")).categoryId)?.approvedChangeIds.add(revision.artifactId)}
  const result=[...groups.values()].map(g=>{const sources=[...g.sources.values()].sort((a:any,b:any)=>`${a.accountId}|${a.interactionId}`.localeCompare(`${b.accountId}|${b.interactionId}`)),perProspect=new Map<string,number>();for(const source of sources)perProspect.set(source.prospectId,(perProspect.get(source.prospectId)??0)+1);return{categoryId:g.categoryId,label:g.label,taxonomyRule:g.rule,coverage:[...g.coverage].sort(),materialityFindings:[...g.materiality].sort(),counts:{distinctProspects:g.prospects.size,distinctAccounts:g.accounts.size,distinctSourceInteractions:sources.length,objectionOccurrences:sources.length,assessments:g.assessmentIds.size,repeatMentions:[...perProspect.values()].reduce((n:number,v:number)=>n+Math.max(0,v-1),0)},sourceEvidence:sources,specialistArtifactIds:[...g.specialistArtifactIds].sort(),unresolvedDependencies:[...g.unresolvedDependencies].sort(),approvedChangeIds:[...g.approvedChangeIds].sort()}}).sort((a,b)=>a.categoryId.localeCompare(b.categoryId));
  const body={schemaVersion:CLOSER_OBJECTION_SUMMARY_SCHEMA,taxonomyVersion:CLOSER_OBJECTION_TAXONOMY_SCHEMA,contextRevision:params.contextRevision,countingSemantics:{objectionOccurrence:"One unique Account/Pursuit/conversation/Interaction source statement",assessment:"One unique immutable assessment ID",repeatMention:"Each additional unique source Interaction from the same prospect after its first",duplicatesExcluded:true,thresholdApplied:false,statisticalSignificanceClaimed:false},groups:result,onDemandOnly:true as const,automaticNotification:false as const,syntheticDemoOnly:true as const};
  return{...body,summaryId:revenueStableId("closerobjectionsummary",body),summarySha256:revenueSha256(body)};
}

export function buildPatternReviewProposal(params:{summary:any;categoryId:string;requestedByUid:string}){const group=params.summary.groups.find((x:any)=>x.categoryId===params.categoryId);if(!group)throw new Error("pattern_category_missing");const body={schemaVersion:CLOSER_PATTERN_REVIEW_PROPOSAL_SCHEMA,summaryId:params.summary.summaryId,summarySha256:params.summary.summarySha256,contextRevision:params.summary.contextRevision,categoryId:group.categoryId,exactGroup:group,reason:"Founder-requested evidence-linked review of a recurring objection pattern; no threshold or significance claim.",requestedByUid:params.requestedByUid,authority:{changePositioning:false as const,changeOffers:false as const,changeStrategy:false as const,changeRevenueObjective:false as const,closerContinuation:false as const,invokeAgent:false as const,externalAction:false as const},explicitFounderApprovalRequired:true as const};return{...body,proposalId:revenueStableId("closerpatternreviewproposal",body),proposalSha256:revenueSha256(body)}}
export function verifyPatternReviewProposal(value:any){const{proposalId,proposalSha256,...body}=value;if(revenueStableId("closerpatternreviewproposal",body)!==proposalId||revenueSha256(body)!==proposalSha256)throw new Error("pattern_review_proposal_integrity_failed")}
export function buildPatternReviewItem(params:{proposal:any;recordedByUid:string;recordedAt:string}){verifyPatternReviewProposal(params.proposal);return{schemaVersion:CLOSER_PATTERN_REVIEW_ITEM_SCHEMA,reviewItemId:params.proposal.proposalId,proposalSha256:params.proposal.proposalSha256,status:"open",categoryId:params.proposal.categoryId,summaryId:params.proposal.summaryId,summarySha256:params.proposal.summarySha256,contextRevision:params.proposal.contextRevision,sourceEvidence:params.proposal.exactGroup.sourceEvidence,counts:params.proposal.exactGroup.counts,reason:params.proposal.reason,recordedByUid:params.recordedByUid,recordedAt:params.recordedAt,syntheticDemo:true,authority:params.proposal.authority}}
