import assert from "node:assert/strict";
import test from "node:test";
import { toAccountListItem, toCommercialReadModel, toContactReadModel, toPursuitListItem, toRevisionTimelineItems } from "../../lib/agents/crm-01/read-model.ts";

function record(entityType, data = {}, provenance = []) { return { id: `${entityType}-1`, entityType, revision: 1, createdAt: "2026-09-26T00:00:00.000Z", updatedAt: "2026-09-26T01:00:00.000Z", data, provenance, history: [{ revision: 1, event: "sales_ingestion_created", artifactSha256: "artifact", at: "2026-09-26T00:00:00.000Z" }] }; }

test("malformed and incomplete Account fields remain visibly unknown", () => {
  const account = toAccountListItem(record("account", { displayName: "", dnc: "unrecognized" }));
  assert.equal(account.displayName, null);
  assert.equal(account.dnc.state, "unknown");
  assert.equal(account.dnc.evaluation, "review_required");
  assert.ok(account.warnings.some((item) => item.field === "displayName"));
});

test("CRM does not manufacture Best First Contact or buying authority", () => {
  const plain = toContactReadModel(record("contact", { name: "Pat", strategicRoles: ["Operational Owner"], buyingAuthority: "unknown" }, ["sales_public_evidence"]));
  assert.equal(plain.recommendedAsBestFirstContact, false);
  assert.equal(plain.recommendationClassification, "unavailable");
  assert.equal(plain.buyingAuthority, "unknown");
  const recommended = toContactReadModel(record("contact", { name: "Pat", identityEvidenceIds: ["s1"], currentRoleEvidenceIds: ["s1"], stakeholderFunction: "Shopper Marketing", problemOwnership: "direct", functionalRelevance: "Owns the identified shelf-education problem.", functionalRelevanceClassification: "sales_inference", confidence: "Confirmed", freshness: "current", conflictingEvidenceIds: [], evidenceIds: ["s1"], recommendedAsBestFirstContact: true, strategicRoles: ["Best First Contact"], strategicRoleRationale: "Directly owns the problem.", buyingAuthority: "unknown", buyingAuthorityEvidenceIds: [] }, ["sales_strategic_inference"]));
  assert.equal(recommended.recommendedAsBestFirstContact, true);
  assert.equal(recommended.recommendationClassification, "sales_inference");
  assert.equal(recommended.buyingAuthority, "unknown");
  assert.equal(recommended.functionalRelevanceClassification, "sales_inference");
  assert.deepEqual(recommended.identityEvidenceIds, ["s1"]);
});

test("Next Action is memory and never execution authority", () => {
  const pursuit = toPursuitListItem(record("salesPursuit", { nextAction: "Founder review", dncEvaluation: "allowed" }));
  assert.equal(pursuit.nextAction.description, "Founder review");
  assert.equal(pursuit.nextAction.executionAuthorized, false);
});

test("commercial truth keeps Free First at zero and revenue states distinct", () => {
  const commercial = toCommercialReadModel(record("milestone", { freeFirst: { state: "live", revenueUsd: 99, live: true }, commercialTruth: { expectedRevenue: "unknown", committedRevenue: "unknown", collectedRevenue: "unknown" } }));
  assert.equal(commercial.freeFirst.revenueUsd, 0);
  assert.equal(commercial.revenueStates.expected, "unknown");
  assert.equal(commercial.revenueStates.committed, "unknown");
  assert.equal(commercial.revenueStates.collected, "unknown");
  assert.ok(commercial.warnings.some((item) => item.code === "conflicting_state"));
});

test("embedded revision history becomes an auditable provenance timeline", () => {
  const revisions = toRevisionTimelineItems(record("account", { displayName: "Brand" }, ["sales_public_evidence"]));
  assert.equal(revisions.length, 1);
  assert.equal(revisions[0].entityType, "revision");
  assert.equal(revisions[0].classification, "system_generated_state");
  assert.ok(revisions[0].provenance.includes("artifact:artifact"));
});
