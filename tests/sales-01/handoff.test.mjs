import assert from "node:assert/strict";
import test from "node:test";

import { canonicalJson } from "../../lib/agents/sales-01/canonical.ts";
import { createSyntheticGrowthSalesExport, syntheticSalesContractMetadata } from "../../lib/agents/sales-01/fixtures.ts";
import { validateSalesIntake, verifySalesEnvelopeIntegrity } from "../../lib/agents/sales-01/validation.ts";

function intake(exported = createSyntheticGrowthSalesExport(), approved = true) {
  return validateSalesIntake({
    input: { export: exported, candidateId: "buff-the-buff-ritual", founderApproval: { approved, scope: "sales_preparation_only" } },
    approvedByUid: "verified-founder",
    approvedAt: "2026-09-24T12:02:00.000Z",
    salesContract: syntheticSalesContractMetadata,
  });
}

test("canonical serialization is stable across object key order", () => {
  assert.equal(canonicalJson({ b: 2, a: { d: 4, c: 3 } }), canonicalJson({ a: { c: 3, d: 4 }, b: 2 }));
});

test("synthetic GROWTH export round-trips into an immutable valid SALES envelope", () => {
  const result = intake();
  assert.equal(result.status, "valid");
  assert.ok(result.envelope);
  assert.equal(verifySalesEnvelopeIntegrity(result.envelope), true);
  assert.equal(Object.isFrozen(result.envelope), true);
  assert.equal(result.envelope.qualification.score, 81);
  assert.equal(result.envelope.qualification.band, "Immediate Priority");
  assert.deepEqual(result.envelope.evidence.knownUnknowns, ["Brand interest and content rights remain unknown until verified."]);
  assert.equal(result.envelope.opportunity.triggerDate.value, null);
  assert.equal(result.envelope.opportunity.physicalScanExperience.value, null);
  assert.deepEqual(result.envelope.authority, {
    salesPreparationAuthorized: true,
    externalActionAuthorized: false,
    contactResearchPerformed: false,
    messageGenerated: false,
    crmWriteAuthorized: false,
    revenueInvocationAuthorized: false,
    closerInvocationAuthorized: false,
    persistence: false,
  });
});

test("candidate or envelope mutation is detected", () => {
  const envelope = structuredClone(intake().envelope);
  envelope.candidate.completeCandidate.brand = "Mutated Brand";
  assert.equal(verifySalesEnvelopeIntegrity(envelope), false);
  const second = structuredClone(intake().envelope);
  second.evidence.knownUnknowns.push("Injected unknown");
  assert.equal(verifySalesEnvelopeIntegrity(second), false);
});

test("Founder approval and exact preparation-only scope are required", () => {
  assert.equal(intake(createSyntheticGrowthSalesExport(), false).status, "validation_failed");
  const exported = createSyntheticGrowthSalesExport();
  const result = validateSalesIntake({
    input: { export: exported, candidateId: "buff-the-buff-ritual", founderApproval: { approved: true, scope: "broader" } },
    approvedByUid: "verified-founder",
    approvedAt: "2026-09-24T12:02:00.000Z",
    salesContract: syntheticSalesContractMetadata,
  });
  assert.equal(result.status, "validation_failed");
});
