import assert from "node:assert/strict";
import test from "node:test";

import { loadGrowthContractMetadata } from "../../lib/agents/growth-01/contract.ts";
import { readFile } from "node:fs/promises";
import { SCORE_CATEGORY_LIMITS } from "../../lib/agents/growth-01/scoring.ts";

test("the frozen GROWTH-01 contract is loaded and hashed at execution time", async () => {
  const metadata = await loadGrowthContractMetadata(new Date("2026-09-14T00:00:00.000Z"));
  assert.equal(metadata.path, "agents/growth-01/AGENT.md");
  assert.equal(metadata.version, "V1");
  assert.match(metadata.sha256, /^[a-f0-9]{64}$/);
  assert.ok(metadata.byteLength > 0);
});

test("machine-readable weights remain a projection of the frozen Markdown contract", async () => {
  const contract = await readFile("agents/growth-01/AGENT.md", "utf8");
  const expectedContractLines = [
    ["Physical-retail relevance", SCORE_CATEGORY_LIMITS.physicalRetailRelevance],
    ["Current/timely trigger", SCORE_CATEGORY_LIMITS.currentTimelyTrigger],
    ["Creator-content activity", SCORE_CATEGORY_LIMITS.creatorContentActivity],
    ["Shelf education/demo/review need", SCORE_CATEGORY_LIMITS.shelfEducationNeed],
    ["Current Goshsha fit", SCORE_CATEGORY_LIMITS.currentGoshshaFit],
    ["Commercial/repeatable potential", SCORE_CATEGORY_LIMITS.commercialRepeatablePotential],
    ["Practical actionability", SCORE_CATEGORY_LIMITS.practicalActionability],
    ["Evidence quality/completeness", SCORE_CATEGORY_LIMITS.evidenceQualityCompleteness],
  ];
  for (const [label, points] of expectedContractLines) {
    assert.ok(contract.includes(`**${label} — ${points}:**`), `${label} must remain ${points} points in the frozen contract`);
  }
});

test("contract defines three-tier market priority and supplement/oral-care claim discipline", async () => {
  const contract = await readFile("agents/growth-01/AGENT.md", "utf8");
  assert.match(contract, /Priority 1 — Supplements \/ Vitamins \/ Wellness Supplements/);
  assert.match(contract, /Priority 2 — Skincare \/ Haircare \/ Oral Care/);
  assert.match(contract, /Priority 3 — Beauty \/ Makeup/);
  assert.match(contract, /controls research allocation, not Opportunity Score points/);
  assert.match(contract, /Do not independently originate, verify, or endorse medical, therapeutic, safety, disease-treatment\/prevention, efficacy, dosage, ingredient-interaction, or regulatory conclusions/);
});

test("Phase 1A route contains no persistence or external communication operation", async () => {
  const route = await readFile("app/api/admin/agents/growth-01/run/route.ts", "utf8");
  assert.doesNotMatch(route, /\.(set|add|update|delete)\s*\(/);
  assert.doesNotMatch(route, /\bfetch\s*\(/);
  assert.match(route, /persistence:\s*false/);
  assert.match(route, /externalCommunication:\s*false/);
});
