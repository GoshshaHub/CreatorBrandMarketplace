import assert from "node:assert/strict";
import test from "node:test";

import { buffBenchmarkCandidate, retailerDependentBenchmarkCandidate } from "../../lib/agents/growth-01/fixtures.ts";
import { canonicalizeResearchUrl, normalizeOpenAIResearchResponse, validateGrowthResearchRequest } from "../../lib/agents/growth-01/research-schema.ts";
import { scoreGrowthCandidate } from "../../lib/agents/growth-01/scoring.ts";
import { validateGrowthCandidate } from "../../lib/agents/growth-01/validation.ts";

const request = {
  asOfDate: "2026-09-14",
  marketFocus: ["beauty"],
  founderResearchFocus: "",
  maximumCandidates: 10,
  maximumQualified: 5,
  budgetAuthority: { confirmedByFounder: true, growthMonthSpendUsd: 0, commercialDepartmentMonthSpendUsd: 0 },
};

function providerCandidate(candidate, sourceUrl, publicationDate = null) {
  return {
    ...candidate,
    evidence: candidate.evidence.map((item) => ({
      id: item.id,
      publisher: item.publisher,
      sourceUrl,
      sourceType: item.sourceType === "founder_supplied_benchmark" ? "credible_secondary" : item.sourceType,
      publicationDate,
      supportedClaim: item.supportedClaim,
      classification: item.classification,
      reliability: item.reliability,
    })),
    deductions: Object.entries(candidate.deductions || {}).map(([type, value]) => ({ type, value })),
  };
}

function mockResponse(candidates, options = {}) {
  const sourceUrl = options.sourceUrl || "https://brand.example/news?utm_source=test";
  return {
    id: "resp_mock",
    model: "gpt-5.6-terra",
    status: "completed",
    output: [
      { type: "web_search_call", action: { sources: [{ url: sourceUrl, title: "Official source", ...(options.nativePublicationDate ? { publication_date: options.nativePublicationDate } : {}) }] } },
      { type: "message", content: [{ type: "output_text", text: JSON.stringify({ partial: options.partial || false, limitations: options.limitations || [], marketPattern: "Mock market pattern", candidates }) }] },
    ],
    usage: { input_tokens: 100, output_tokens: 200, total_tokens: 300, output_tokens_details: { reasoning_tokens: 20 } },
  };
}

function utcDateWithOffset(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function researchRequest(asOfDate) {
  return { ...request, asOfDate };
}

test("research date accepts today and prior dates but rejects future, malformed, and impossible dates", () => {
  assert.deepEqual(validateGrowthResearchRequest(researchRequest(utcDateWithOffset(0))), []);
  assert.deepEqual(validateGrowthResearchRequest(researchRequest(utcDateWithOffset(-1))), []);
  for (const asOfDate of [utcDateWithOffset(1), "2099-01-01", "September 1", "2026-02-31"]) {
    assert.match(validateGrowthResearchRequest(researchRequest(asOfDate)).join(" "), /real YYYY-MM-DD calendar date no later than the server's current UTC date/);
  }
});

test("future provider publication dates cannot survive a client-supplied future research date", () => {
  const futureAsOfDate = "2099-01-01";
  const futurePublicationDate = utcDateWithOffset(1);
  const response = mockResponse(
    [providerCandidate(buffBenchmarkCandidate, "https://brand.example/news", futurePublicationDate)],
    { sourceUrl: "https://brand.example/news", nativePublicationDate: futurePublicationDate }
  );
  assert.throws(
    () => normalizeOpenAIResearchResponse({ response, request: researchRequest(futureAsOfDate), requestedModel: "gpt-5.6-terra", completedAt: new Date().toISOString() }),
    /asOfDate must be a real calendar date no later than the server's current UTC date/
  );
});

test("URL canonicalization strips ordinary anchors but preserves distinct hash routes and their internal queries", () => {
  assert.equal(canonicalizeResearchUrl("https://example.com/article#section"), "https://example.com/article");
  const productA = canonicalizeResearchUrl("https://example.com/#/product-a");
  const productB = canonicalizeResearchUrl("https://example.com/#/product-b");
  assert.equal(productA, "https://example.com/#/product-a");
  assert.equal(productB, "https://example.com/#/product-b");
  assert.notEqual(productA, productB);
  assert.notEqual(
    canonicalizeResearchUrl("https://example.com/app#/product-a?variant=one"),
    canonicalizeResearchUrl("https://example.com/app#/product-a?variant=two")
  );
  assert.equal(
    canonicalizeResearchUrl("https://example.com/article?utm_source=test&sku=one#/product-a?variant=one"),
    "https://example.com/article?sku=one#/product-a?variant=one"
  );
});

test("application validation still rejects required empty text", () => {
  const { candidate } = scoreGrowthCandidate({ ...buffBenchmarkCandidate, brand: "" });
  const validation = validateGrowthCandidate(candidate);
  assert.equal(validation.valid, false);
  assert.ok(validation.findings.some((finding) => finding.field === "brand" && finding.code === "required_field_missing"));
});

test("normalization still rejects invalid and non-HTTP source URLs", () => {
  for (const sourceUrl of ["not-a-url", "ftp://brand.example/news"]) {
    const response = mockResponse([providerCandidate(buffBenchmarkCandidate, sourceUrl)], { sourceUrl });
    assert.throws(
      () => normalizeOpenAIResearchResponse({ response, request, requestedModel: "gpt-5.6-terra", completedAt: "2026-09-14T12:00:00.000Z" }),
      /Invalid URL|invalid evidence URL|not HTTP\(S\)/
    );
  }
});

test("native source provenance is normalized, raw URL retained, and missing publication date remains unknown", () => {
  const url = "https://brand.example/news?utm_source=test";
  const result = normalizeOpenAIResearchResponse({ response: mockResponse([providerCandidate(buffBenchmarkCandidate, url)]), request, requestedModel: "gpt-5.6-terra", completedAt: "2026-09-14T12:00:00.000Z" });
  assert.equal(result.sources[0].rawUrl, url);
  assert.equal(result.sources[0].canonicalUrl, "https://brand.example/news");
  assert.equal(result.sources[0].publicationDate, null);
  assert.equal(result.proposedRun.candidates[0].evidence[0].accessDate, "2026-09-14");
  assert.equal(result.proposedRun.candidates[0].evidence[0].publicationDate, null);
});

test("fabricated model-only URLs are rejected", () => {
  const response = mockResponse([providerCandidate(buffBenchmarkCandidate, "https://fabricated.example/story")]);
  assert.throws(() => normalizeOpenAIResearchResponse({ response, request, requestedModel: "gpt-5.6-terra", completedAt: "2026-09-14T12:00:00.000Z" }), /absent from native provider provenance/);
});

test("malformed, future, and unsupported publication dates are rejected", () => {
  for (const date of ["September 1", "2026-10-01", "2026-09-01"]) {
    const response = mockResponse([providerCandidate(buffBenchmarkCandidate, "https://brand.example/news?utm_source=test", date)]);
    assert.throws(() => normalizeOpenAIResearchResponse({ response, request, requestedModel: "gpt-5.6-terra", completedAt: "2026-09-14T12:00:00.000Z" }));
  }
  const valid = normalizeOpenAIResearchResponse({
    response: mockResponse([providerCandidate(buffBenchmarkCandidate, "https://brand.example/news?utm_source=test", "2026-09-01")], { nativePublicationDate: "2026-09-01" }),
    request,
    requestedModel: "gpt-5.6-terra",
    completedAt: "2026-09-14T12:00:00.000Z",
  });
  assert.equal(valid.proposedRun.candidates[0].evidence[0].publicationDate, "2026-09-01");
});

test("retailer independence is preserved while an evidenced dependency is surfaced", () => {
  const independent = normalizeOpenAIResearchResponse({ response: mockResponse([providerCandidate(buffBenchmarkCandidate, "https://brand.example/news")]), request, requestedModel: "gpt-5.6-terra", completedAt: "2026-09-14T12:00:00.000Z" });
  assert.equal(independent.proposedRun.candidates[0].retailerAssessment.posture, "retailer_independent");
  const dependent = normalizeOpenAIResearchResponse({ response: mockResponse([providerCandidate(retailerDependentBenchmarkCandidate, "https://brand.example/news")]), request, requestedModel: "gpt-5.6-terra", completedAt: "2026-09-14T12:00:00.000Z" });
  assert.equal(dependent.proposedRun.candidates[0].retailerAssessment.posture, "evidence_supported_dependency");
});

test("a valid partial result with fewer than five candidates is accepted without authoritative approvals", () => {
  const result = normalizeOpenAIResearchResponse({ response: mockResponse([providerCandidate(buffBenchmarkCandidate, "https://brand.example/news")], { partial: true, limitations: ["Search limit reached"] }), request, requestedModel: "gpt-5.6-terra", completedAt: "2026-09-14T12:00:00.000Z" });
  assert.equal(result.status, "partial");
  assert.equal(result.proposedRun.candidates.length, 1);
  assert.equal(result.authority.founderApproved, false);
  assert.equal(result.authority.salesApproved, false);
  assert.equal(result.authority.crmStateCreated, false);
  assert.equal(result.authority.authoritativeRevenueOutcomeCreated, false);
});
