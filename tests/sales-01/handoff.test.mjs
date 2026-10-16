import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { canonicalJson } from "../../lib/agents/sales-01/canonical.ts";
import { createSyntheticGrowthSalesExport, syntheticSalesContractMetadata } from "../../lib/agents/sales-01/fixtures.ts";
import { validateSalesIntake, verifySalesEnvelopeIntegrity } from "../../lib/agents/sales-01/validation.ts";
import {
  APPROVED_SALES_GROWTH_INTAKE_POLICY_SHA256,
  meetsCurrentSalesProspectingScore,
  PRESERVED_CYMBIOTIKA_GROWTH_HANDOFF_SHA256,
  SALES_GROWTH_INTAKE_POLICY_SHA256,
} from "../../lib/agents/sales-01/growth-handoff-compatibility.ts";

const historicalFixtureUrl = new URL("./fixtures/cymbiotika-growth-v1-handoff.json", import.meta.url);

async function historicalExport() {
  return JSON.parse(await readFile(historicalFixtureUrl, "utf8"));
}

async function historicalIntake(exported) {
  exported ??= await historicalExport();
  return validateSalesIntake({
    input: { export: exported, candidateId: "G01-20261013-CYMBIOTIKA-WHOLEFOODS", founderApproval: { approved: true, scope: "sales_preparation_only" } },
    approvedByUid: "verified-founder",
    approvedAt: "2026-10-15T12:02:00.000Z",
    salesContract: syntheticSalesContractMetadata,
  });
}

function intake(exported = createSyntheticGrowthSalesExport(), approved = true) {
  return validateSalesIntake({
    input: { export: exported, candidateId: "buff-the-buff-ritual", founderApproval: { approved, scope: "sales_preparation_only" } },
    approvedByUid: "verified-founder",
    approvedAt: "2026-09-24T12:02:00.000Z",
    salesContract: syntheticSalesContractMetadata,
  });
}

function rehashEnvelope(envelope) {
  envelope.envelope.payloadSha256 = "";
  envelope.envelope.payloadSha256 = createHash("sha256").update(canonicalJson(envelope)).digest("hex");
  return envelope;
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

test("current and exact allowlisted historical pairs bind to the versioned intake policy", async () => {
  assert.equal(SALES_GROWTH_INTAKE_POLICY_SHA256, APPROVED_SALES_GROWTH_INTAKE_POLICY_SHA256);
  const current = intake();
  assert.equal(current.envelope.schemaVersion, "growth-sales-handoff-v1.1");
  assert.equal(current.envelope.source.compatibility.sourceKind, "current");
  assert.equal(current.envelope.source.compatibility.reviewedSourceFileIdentitySha256, null);
  const bytes = await readFile(historicalFixtureUrl);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), PRESERVED_CYMBIOTIKA_GROWTH_HANDOFF_SHA256);
  const historical = await historicalIntake();
  assert.equal(historical.status, "valid");
  assert.equal(historical.envelope.qualification.score, 81);
  assert.equal(historical.envelope.qualification.deductions.unresolvedRightsAssumption, 10);
  assert.equal(historical.envelope.source.compatibility.sourceKind, "historical_allowlisted");
  assert.equal(historical.envelope.schemaVersion, "growth-sales-handoff-v1.1");
  assert.equal(historical.envelope.source.compatibility.reviewedSourceFileIdentitySha256, PRESERVED_CYMBIOTIKA_GROWTH_HANDOFF_SHA256);
  assert.equal(historical.envelope.source.compatibility.historicalSemanticsPreserved, true);
  assert.equal(verifySalesEnvelopeIntegrity(historical.envelope), true);
});

test("historical tampering, mixed identities, and below-threshold qualification fail closed", async () => {
  assert.equal(meetsCurrentSalesProspectingScore(65), true);
  assert.equal(meetsCurrentSalesProspectingScore(64), false);
  const tampered = await historicalExport();
  tampered.validatedRun.candidates[0].brand = "Altered Brand";
  assert.equal((await historicalIntake(tampered)).status, "validation_failed");

  const mixed = await historicalExport();
  mixed.providerProjection.version = "growth-01-provider-research-v2.2";
  assert.equal((await historicalIntake(mixed)).status, "validation_failed");

  const belowThreshold = await historicalExport();
  belowThreshold.validatedRun.candidates.find((candidate) => candidate.id === "G01-20261013-CYMBIOTIKA-WHOLEFOODS").computed.finalScore = 64;
  const result = await historicalIntake(belowThreshold);
  assert.equal(result.status, "validation_failed");
  assert.ok(result.findings.some((finding) => finding.code === "growth_compatibility_historical_artifact_mismatch"));
});

test("legacy v1 remains readable but cannot acquire v1.1 compatibility authority", () => {
  const current = structuredClone(intake().envelope);
  current.schemaVersion = "growth-sales-handoff-v1";
  delete current.source.compatibility;
  rehashEnvelope(current);
  assert.equal(verifySalesEnvelopeIntegrity(current), true);

  current.source.compatibility = structuredClone(intake().envelope.source.compatibility);
  rehashEnvelope(current);
  assert.equal(verifySalesEnvelopeIntegrity(current), false);

  const missing = structuredClone(intake().envelope);
  delete missing.source.compatibility;
  rehashEnvelope(missing);
  assert.equal(verifySalesEnvelopeIntegrity(missing), false);
});

test("v1.1 compatibility metadata is identity-bound and semantic tampering fails after rehashing", () => {
  const changed = structuredClone(intake().envelope);
  changed.source.compatibility.sourceKind = "historical_allowlisted";
  changed.source.compatibility.reviewedSourceFileIdentitySha256 = PRESERVED_CYMBIOTIKA_GROWTH_HANDOFF_SHA256;
  rehashEnvelope(changed);
  assert.equal(verifySalesEnvelopeIntegrity(changed), false);
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
