import assert from "node:assert/strict";
import test from "node:test";
import { buildGrowthCommercialOutcomeFeedback, GROWTH_COMMERCIAL_OUTCOME_FEEDBACK_VERSION } from "../../lib/agents/growth-01/commercial-outcome-feedback.ts";

test("attributed CRM outcomes return to GROWTH as current context without run or external authority", () => {
  const input={accountId:"acct",pursuitId:"pursuit",growthCandidateSha256:"a".repeat(64),crmRevisionSetSha256:"b".repeat(64),salesPlaybookArtifactId:"playbook",salesPlaybookArtifactSha256:"c".repeat(64),revenueRecommendationId:"recommendation",revenueRecommendationFamily:"establish_qualified_engagement",generatedAt:"2026-10-16T12:00:00.000Z",interactions:[{interactionId:"reply",type:"inbound_received",exactAttributedStatement:"The prospect asked whether the proof can start with one retail product.",occurredAt:"2026-10-16T11:00:00.000Z",classification:"attributed_statement"}]};
  const first=buildGrowthCommercialOutcomeFeedback(input),second=buildGrowthCommercialOutcomeFeedback(input);
  assert.equal(first.schemaVersion,GROWTH_COMMERCIAL_OUTCOME_FEEDBACK_VERSION);
  assert.deepEqual(first,second);
  assert.equal(first.attributedOutcomes[0].exactAttributedStatement,input.interactions[0].exactAttributedStatement);
  assert.deepEqual(first.authority,{growthRunAuthorized:false,providerRequestAuthorized:false,crmMutationAuthorized:false,externalActionAuthorized:false});
  const changed=buildGrowthCommercialOutcomeFeedback({...input,crmRevisionSetSha256:"d".repeat(64)});
  assert.notEqual(changed.feedbackSha256,first.feedbackSha256);
});
