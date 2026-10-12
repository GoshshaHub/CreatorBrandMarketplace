import assert from "node:assert/strict";
import test from "node:test";

import { buildDailyBriefMarkdown } from "../../lib/agents/growth-01/brief.ts";
import { buffBenchmarkCandidate } from "../../lib/agents/growth-01/fixtures.ts";
import { scoreGrowthCandidate } from "../../lib/agents/growth-01/scoring.ts";

test("Daily Brief renders publication and access dates as separate facts", () => {
  const unknownPublication = {
    ...buffBenchmarkCandidate.evidence[0],
    publisher: "Unknown-date publisher",
    publicationDate: null,
    accessDate: "2026-09-19",
    supportedClaim: "Unknown-date supported claim",
    sourceUrl: "https://example.com/unknown-date-source",
  };
  const knownPublication = {
    ...buffBenchmarkCandidate.evidence[1],
    publisher: "Known-date publisher",
    publicationDate: "2026-09-10",
    accessDate: "2026-09-19",
    supportedClaim: "Known-date supported claim",
    sourceUrl: "https://example.com/known-date-source",
  };
  const { candidate } = scoreGrowthCandidate({
    ...buffBenchmarkCandidate,
    evidence: [unknownPublication, knownPublication],
  });

  const brief = buildDailyBriefMarkdown({
    asOfDate: "2026-09-19",
    marketPattern: "Focused date-display regression.",
    candidates: [candidate],
    findings: [],
  });

  assert.match(
    brief,
    /Unknown-date publisher — Published: Unknown — Accessed: 2026-09-19 — Unknown-date supported claim — https:\/\/example\.com\/unknown-date-source/
  );
  assert.match(
    brief,
    /Known-date publisher — Published: 2026-09-10 — Accessed: 2026-09-19 — Known-date supported claim — https:\/\/example\.com\/known-date-source/
  );
  assert.doesNotMatch(brief, /Unknown-date publisher — 2026-09-19 —/);
  assert.match(brief, /\*\*Score\/Band\/Confidence:\*\* 81\/100 \/ Immediate Priority \/ High/);
});

test("failed runs suppress handoff eligibility and label provider-proposed results provisional", () => {
  const { candidate } = scoreGrowthCandidate(buffBenchmarkCandidate);
  const brief = buildDailyBriefMarkdown({
    asOfDate: "2026-09-19",
    marketPattern: "Mixed validation result.",
    candidates: [candidate],
    findings: [{ code: "material_claim_missing_evidence", severity: "error", candidateId: candidate.id, message: "Unsupported material claim." }],
    validationStatus: "validation_failed",
  });

  assert.match(brief, /Validation failed — no candidate is eligible for SALES handoff\./);
  assert.match(brief, /Provider-proposed qualified .*\(provisional\)/);
  assert.match(brief, /Provisional provider proposal:/);
  assert.match(brief, /Provider-proposed score\/band\/confidence \(provisional\)/);
  assert.match(brief, /Resolve validation errors; no SALES-01 handoff is available/);
  assert.doesNotMatch(brief, /\*\*Founder decisions:\*\* Review qualified opportunities for SALES-01 handoff/);
});
