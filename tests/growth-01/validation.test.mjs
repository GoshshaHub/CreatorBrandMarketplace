import assert from "node:assert/strict";
import test from "node:test";

import { buffBenchmarkCandidate, retailerDependentBenchmarkCandidate } from "../../lib/agents/growth-01/fixtures.ts";
import { scoreGrowthCandidate } from "../../lib/agents/growth-01/scoring.ts";
import { validateGrowthCandidate, validateGrowthRunRequest, validateQualifiedCount } from "../../lib/agents/growth-01/validation.ts";

function validate(candidate) {
  return validateGrowthCandidate(scoreGrowthCandidate(candidate).candidate);
}

test("Free First contributes zero and a paid revenue destination remains required", () => {
  assert.equal(validate(buffBenchmarkCandidate).valid, true);
  const scoredFree = validate({ ...buffBenchmarkCandidate, freeFirst: { ...buffBenchmarkCandidate.freeFirst, scoreContribution: 1 } });
  assert.ok(scoredFree.findings.some((finding) => finding.code === "free_first_score_forbidden"));
  const noPaidPath = validate({ ...buffBenchmarkCandidate, fastestRevenuePath: "Free First IRL Campaign" });
  assert.ok(noPaidPath.findings.some((finding) => finding.code === "invalid_fastest_revenue_path"));
});

test("material claims require source evidence", () => {
  const result = validate({ ...buffBenchmarkCandidate, claims: [{ id: "x", claim: "Unsupported", material: true, evidenceIds: [] }] });
  assert.ok(result.findings.some((finding) => finding.code === "material_claim_missing_evidence"));
});

test("unresolved content rights remain structurally valid without an affirmative rights claim", () => {
  const candidate = {
    ...buffBenchmarkCandidate,
    knownUnknowns: ["The Brand must later supply or confirm Brand-owned or properly licensed content."],
    claims: buffBenchmarkCandidate.claims.filter((claim) => !/rights/i.test(claim.claim)),
  };
  assert.equal(validate(candidate).valid, true);
});

test("unsupported affirmative material rights claims remain rejected", () => {
  const result = validate({
    ...buffBenchmarkCandidate,
    claims: [{ id: "unsupported-rights", claim: "The Brand has cleared reusable activation rights to specific Creator content.", material: true, evidenceIds: [] }],
  });
  assert.ok(result.findings.some((finding) => finding.code === "material_claim_missing_evidence"));
});

test("affirmative rights claims remain valid only with an existing explicit evidence reference", () => {
  const rightsEvidence = {
    id: "explicit-rights",
    publisher: "Brand rights confirmation",
    sourceUrl: "https://brand.example/rights-confirmation",
    sourceType: "official_brand",
    publicationDate: null,
    accessDate: "2026-09-24",
    supportedClaim: "The Brand explicitly confirms the relevant reuse and activation rights for the specific content.",
    classification: "verified_fact",
    reliability: "high",
  };
  const candidate = {
    ...buffBenchmarkCandidate,
    evidence: [...buffBenchmarkCandidate.evidence, rightsEvidence],
    claims: [{ id: "supported-rights", claim: "The Brand has the relevant reuse and activation rights for the specific content.", material: true, evidenceIds: [rightsEvidence.id] }],
  };
  assert.equal(validate(candidate).valid, true);
});

test("retailer independence requires no invented retailer approval evidence", () => {
  assert.equal(validate(buffBenchmarkCandidate).valid, true);
  const dependency = validate({
    ...buffBenchmarkCandidate,
    retailerAssessment: { posture: "evidence_supported_dependency", dependencyDescription: "Retailer API required", evidenceIds: [] },
  });
  assert.ok(dependency.findings.some((finding) => finding.code === "retailer_dependency_evidence_missing"));
});

test("an affirmative evidence-supported retailer dependency is surfaced without inventing one", () => {
  const result = validate(retailerDependentBenchmarkCandidate);
  assert.equal(result.valid, true);
  assert.equal(retailerDependentBenchmarkCandidate.retailerAssessment.posture, "evidence_supported_dependency");
  assert.match(retailerDependentBenchmarkCandidate.retailerAssessment.dependencyDescription, /retailer-controlled API/);
});

test("fewer than five qualified opportunities is valid while more than the approved maximum is rejected", () => {
  const scored = scoreGrowthCandidate(buffBenchmarkCandidate).candidate;
  assert.deepEqual(validateQualifiedCount([scored], 5), []);
  assert.ok(validateQualifiedCount(Array.from({ length: 6 }, () => scored), 5).some((finding) => finding.code === "qualified_limit_exceeded"));
});

test("Phase 1A accepts supplement, oral-care, and lower-priority beauty categories under unchanged scoring", () => {
  const findings = validateGrowthRunRequest({
    asOfDate: "2026-09-14",
    marketFocus: ["supplements", "vitamins", "wellness_supplements", "skincare", "haircare", "oral_care", "beauty", "makeup"],
    maximumQualified: 5,
    candidates: [buffBenchmarkCandidate],
  });
  assert.equal(findings.some((finding) => finding.code === "market_focus_invalid"), false);
  const buff = scoreGrowthCandidate(buffBenchmarkCandidate).candidate;
  assert.equal(buff.computed.finalScore, 81);
  assert.equal(buff.computed.band, "Immediate Priority");
});
