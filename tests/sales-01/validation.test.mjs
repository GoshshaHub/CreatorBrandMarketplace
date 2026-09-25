import assert from "node:assert/strict";
import test from "node:test";

import { createGrowthSalesExport } from "../../lib/agents/sales-01/export.ts";
import { createSyntheticGrowthSalesExport, createSyntheticValidatedGrowthRun, syntheticSalesContractMetadata } from "../../lib/agents/sales-01/fixtures.ts";
import { validateSalesIntake } from "../../lib/agents/sales-01/validation.ts";

function validate(exported) {
  return validateSalesIntake({
    input: { export: exported, candidateId: "buff-the-buff-ritual", founderApproval: { approved: true, scope: "sales_preparation_only" } },
    approvedByUid: "verified-founder",
    approvedAt: "2026-09-24T12:02:00.000Z",
    salesContract: syntheticSalesContractMetadata,
  });
}

test("score, band, breakdown, deduction, cap, and Growth validation tampering fail closed", () => {
  for (const mutate of [
    (candidate) => { candidate.computed.finalScore = 99; },
    (candidate) => { candidate.computed.band = "Low Priority"; },
    (candidate) => { candidate.scores.physicalRetailRelevance = 1; },
    (candidate) => { candidate.deductions = { staleTrigger: 5 }; },
    (candidate) => { candidate.caps = ["unsupportedCentralClaim"]; },
  ]) {
    const exported = createSyntheticGrowthSalesExport();
    mutate(exported.validatedRun.candidates[0]);
    assert.equal(validate(exported).status, "validation_failed");
  }
  const invalid = createSyntheticGrowthSalesExport();
  invalid.validatedRun.run.status = "validation_failed";
  assert.equal(validate(invalid).status, "validation_failed");
  const wrongCount = createSyntheticGrowthSalesExport();
  wrongCount.validatedRun.run.candidateCount = 2;
  assert.equal(validate(wrongCount).status, "validation_failed");
  const wrongContract = createSyntheticGrowthSalesExport();
  wrongContract.validatedRun.contract.path = "agents/not-growth/AGENT.md";
  assert.equal(validate(wrongContract).status, "validation_failed");
});

test("evidence references and exact known unknowns are preserved", () => {
  const valid = validate(createSyntheticGrowthSalesExport());
  assert.deepEqual(valid.envelope.evidence.knownUnknowns, ["Brand interest and content rights remain unknown until verified."]);
  const invalid = createSyntheticGrowthSalesExport();
  invalid.validatedRun.candidates[0].claims[0].evidenceIds = ["missing-evidence"];
  assert.equal(validate(invalid).status, "validation_failed");
});

test("Creator activity does not establish rights and affirmative rights require explicit evidence state", () => {
  const creatorOnly = createSyntheticGrowthSalesExport();
  assert.equal(validate(creatorOnly).status, "valid");
  const rights = createSyntheticGrowthSalesExport();
  rights.validatedRun.candidates[0].claims.push({ id: "rights", claim: "The Brand has cleared rights to reuse Creator video content.", material: true, evidenceIds: ["buff-content"] });
  assert.equal(validate(rights).status, "validation_failed");
});

test("retailer presence cannot become authorization and unsupported capability flags fail", () => {
  const retailer = createSyntheticGrowthSalesExport();
  retailer.candidateContexts[0].boundarySnapshot.retailerAuthorizationClaimed = true;
  assert.equal(validate(retailer).status, "validation_failed");
  const capability = createSyntheticGrowthSalesExport();
  capability.candidateContexts[0].boundarySnapshot.unsupportedCapabilityIntroduced = true;
  assert.equal(validate(capability).status, "validation_failed");
});

test("supplement claims remain attributed or unknown; testimonials and popularity do not become efficacy or safety facts", () => {
  const run = createSyntheticValidatedGrowthRun();
  const candidate = run.candidates[0];
  candidate.claims.push(
    { id: "brand-health", claim: "The Brand states the supplement supports digestive health.", material: true, evidenceIds: ["buff-content"] },
    { id: "testimonial", claim: "A Creator testimonial says the product is effective and safe.", material: true, evidenceIds: ["buff-content"] }
  );
  const exported = createGrowthSalesExport({ validatedRun: run, providerProjection: null, exportedAt: "2026-09-24T12:01:00.000Z" });
  assert.equal(validate(exported).status, "valid");
  assert.deepEqual(exported.candidateContexts[0].boundarySnapshot.regulatedClaims.map((item) => item.classification), ["unknown", "unknown"]);

  const unsupported = structuredClone(exported);
  unsupported.candidateContexts[0].boundarySnapshot.regulatedClaims[1] = {
    claimId: "testimonial",
    classification: "authoritative_fact",
    evidenceIds: [],
    attribution: null,
  };
  assert.equal(validate(unsupported).status, "validation_failed");

  const attributed = structuredClone(exported);
  attributed.candidateContexts[0].boundarySnapshot.regulatedClaims[0] = {
    claimId: "brand-health",
    classification: "attributed_brand_claim",
    evidenceIds: ["buff-content"],
    attribution: "Brand statement",
  };
  assert.equal(validate(attributed).status, "valid");
});

test("Free First remains zero-score/nonrevenue and no downstream output is authorized", () => {
  const invalid = createSyntheticGrowthSalesExport();
  invalid.validatedRun.candidates[0].freeFirst.scoreContribution = 1;
  assert.equal(validate(invalid).status, "validation_failed");
  const result = validate(createSyntheticGrowthSalesExport());
  assert.equal(result.envelope.opportunity.freeFirst.scoreContribution, 0);
  assert.equal(result.envelope.authority.crmWriteAuthorized, false);
  assert.equal(result.envelope.authority.revenueInvocationAuthorized, false);
  assert.equal(result.envelope.authority.closerInvocationAuthorized, false);
  assert.equal(result.envelope.authority.externalActionAuthorized, false);
});
