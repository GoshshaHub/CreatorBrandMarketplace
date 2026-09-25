import assert from "node:assert/strict";
import test from "node:test";

import { buffBenchmarkCandidate, elfBenchmarkCandidate, unqualifiedBenchmarkCandidate } from "../../lib/agents/growth-01/fixtures.ts";
import { MAX_GROWTH_SCORE, SCORE_CATEGORY_LIMITS, scoreGrowthCandidate } from "../../lib/agents/growth-01/scoring.ts";

test("approved category weights total 100 and Buff remains 81 Immediate Priority", () => {
  assert.equal(MAX_GROWTH_SCORE, 100);
  assert.deepEqual(SCORE_CATEGORY_LIMITS, {
    physicalRetailRelevance: 18,
    currentTimelyTrigger: 15,
    creatorContentActivity: 15,
    shelfEducationNeed: 15,
    currentGoshshaFit: 12,
    commercialRepeatablePotential: 10,
    practicalActionability: 5,
    evidenceQualityCompleteness: 10,
  });
  const result = scoreGrowthCandidate(buffBenchmarkCandidate);
  assert.equal(result.candidate.computed.finalScore, 81);
  assert.equal(result.candidate.computed.band, "Immediate Priority");
  assert.equal(result.findings.length, 0);
});

test("tampered claimed arithmetic is rejected", () => {
  const result = scoreGrowthCandidate({ ...buffBenchmarkCandidate, claimedFinalScore: 99 });
  assert.ok(result.findings.some((finding) => finding.code === "claimed_final_mismatch"));
});

test("deductions apply once and the lowest applicable cap wins", () => {
  const result = scoreGrowthCandidate({
    ...buffBenchmarkCandidate,
    deductions: { staleTrigger: 5, speculativeFit: 5 },
    caps: ["noCurrentTrigger", "unsupportedCentralClaim"],
    claimedGrossScore: undefined,
    claimedFinalScore: undefined,
    claimedBand: undefined,
  });
  assert.equal(result.candidate.computed.deductionTotal, 10);
  assert.equal(result.candidate.computed.scoreBeforeCap, 71);
  assert.equal(result.candidate.computed.applicableCap, 49);
  assert.equal(result.candidate.computed.finalScore, 49);
});

test("unresolved rights assumption remains an approved scored deduction", () => {
  const result = scoreGrowthCandidate({
    ...buffBenchmarkCandidate,
    deductions: { unresolvedRightsAssumption: 5 },
    claimedGrossScore: undefined,
    claimedFinalScore: undefined,
    claimedBand: undefined,
  });
  assert.equal(result.candidate.computed.deductionTotal, 5);
  assert.equal(result.candidate.computed.finalScore, 76);
  assert.equal(result.candidate.computed.band, "Strong Opportunity");
  assert.equal(result.findings.length, 0);
});

test("exceptional structural benchmark receives only supported trigger points and the no-trigger cap", () => {
  const result = scoreGrowthCandidate(elfBenchmarkCandidate);
  assert.equal(result.candidate.scores.currentTimelyTrigger, 0);
  assert.equal(result.candidate.computed.finalScore, 64);
  assert.equal(result.candidate.computed.band, "Watch");
  assert.equal(result.findings.length, 0);
});

test("unsupported candidate remains unqualified", () => {
  const result = scoreGrowthCandidate(unqualifiedBenchmarkCandidate);
  assert.equal(result.candidate.computed.finalScore, 28);
  assert.equal(result.candidate.computed.band, "Low Priority");
  assert.equal(result.candidate.selectionStatus, "rejected");
});
