import assert from "node:assert/strict";
import test from "node:test";
import { buildGrowthCommercialOutcomeFeedback, GROWTH_COMMERCIAL_OUTCOME_FEEDBACK_VERSION } from "../../lib/agents/growth-01/commercial-outcome-feedback.ts";

test("only explicitly authentic CRM outcomes return to GROWTH commercial learning", () => {
  const input={accountId:"acct",pursuitId:"pursuit",growthCandidateSha256:"a".repeat(64),crmRevisionSetSha256:"b".repeat(64),salesPlaybookArtifactId:"playbook",salesPlaybookArtifactSha256:"c".repeat(64),revenueRecommendationId:"recommendation",revenueRecommendationFamily:"establish_qualified_engagement",generatedAt:"2026-10-16T12:00:00.000Z",interactions:[{interactionId:"reply",type:"inbound_received",exactAttributedStatement:"The prospect asked whether the proof can start with one retail product.",occurredAt:"2026-10-16T11:00:00.000Z",classification:"attributed_statement",evidenceAuthenticity:"authentic",authenticCommercialLearningEligible:true}]};
  const first=buildGrowthCommercialOutcomeFeedback(input),second=buildGrowthCommercialOutcomeFeedback(input);
  assert.equal(first.schemaVersion,GROWTH_COMMERCIAL_OUTCOME_FEEDBACK_VERSION);
  assert.deepEqual(first,second);
  assert.equal(first.attributedOutcomes[0].exactAttributedStatement,input.interactions[0].exactAttributedStatement);
  assert.deepEqual(first.authority,{growthRunAuthorized:false,providerRequestAuthorized:false,crmMutationAuthorized:false,externalActionAuthorized:false});
  const changed=buildGrowthCommercialOutcomeFeedback({...input,crmRevisionSetSha256:"d".repeat(64)});
  assert.notEqual(changed.feedbackSha256,first.feedbackSha256);
});

test("synthetic, unknown, and legacy unmarked outcomes stay identified and excluded", () => {
  const base={accountId:"synthetic-account",pursuitId:"synthetic-pursuit",growthCandidateSha256:"a".repeat(64),crmRevisionSetSha256:"b".repeat(64),salesPlaybookArtifactId:"playbook",salesPlaybookArtifactSha256:"c".repeat(64),revenueRecommendationId:"recommendation",revenueRecommendationFamily:"establish_qualified_engagement",generatedAt:"2026-10-16T12:00:00.000Z"};
  const feedback=buildGrowthCommercialOutcomeFeedback({...base,interactions:[
    {interactionId:"synthetic",type:"inbound_received",exactAttributedStatement:"Synthetic test reply.",occurredAt:"2026-10-16T11:00:00.000Z",evidenceAuthenticity:"synthetic",authenticCommercialLearningEligible:false},
    {interactionId:"unknown",type:"inbound_received",exactAttributedStatement:"Unknown-origin reply.",occurredAt:"2026-10-16T11:01:00.000Z",evidenceAuthenticity:"unknown",authenticCommercialLearningEligible:false},
    {interactionId:"legacy",type:"inbound_received",exactAttributedStatement:"Unmarked legacy reply.",occurredAt:"2026-10-16T11:02:00.000Z"},
  ]});
  assert.deepEqual(feedback.attributedOutcomes,[]);
  assert.deepEqual(feedback.excludedOutcomes.map(x=>[x.interactionId,x.evidenceAuthenticity,x.exclusionReason]),[["synthetic","synthetic","synthetic_evidence"],["unknown","unknown","authenticity_unknown_or_ineligible"],["legacy","unknown","authenticity_unknown_or_ineligible"]]);
});
