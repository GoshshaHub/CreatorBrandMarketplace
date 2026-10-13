import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { register } from "node:module";
import test from "node:test";

import { createSyntheticGrowthSalesExport, syntheticSalesContractMetadata } from "../../lib/agents/sales-01/fixtures.ts";
import { SalesAdminAuthError } from "../../lib/agents/sales-01/admin-auth.ts";
import { SalesResearchError, MAX_REJECTED_OUTPUT_DIAGNOSTIC_BYTES, normalizeCompletedOpenAISalesResponse } from "../../lib/agents/sales-01/research-schema.ts";
import { validateSalesIntake } from "../../lib/agents/sales-01/validation.ts";

function requestFixture() {
  const input = { export: createSyntheticGrowthSalesExport(), candidateId: "buff-the-buff-ritual", founderApproval: { approved: true, scope: "sales_preparation_only" } };
  const envelope = validateSalesIntake({ input, approvedByUid: "synthetic-founder", approvedAt: "2026-10-13T12:00:00.000Z", salesContract: syntheticSalesContractMetadata }).envelope;
  return { envelope, founderAuthorization: { authorized: true, scope: "one_sales_research_run" }, budgetAuthority: { confirmedByFounder: true, salesMonthSpendUsd: 0, commercialDepartmentMonthSpendUsd: 0 } };
}

function completedResponse(outputText) {
  return { id: "resp_fixture", status: "completed", model: "gpt-5.6-terra", output_text: outputText, output: [{ type: "web_search_call", action: { sources: [{ url: "https://example.com/evidence", title: "Evidence" }] } }], usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 } };
}

function validProposal(input) {
  const inheritedUnknowns = input.envelope.evidence.knownUnknowns.map((originalText) => ({ originalText, status: "unresolved", resolution: null, salesEvidenceIds: [] }));
  return {
    partial: false, limitations: [], salesPursuitDecision: "Pursue Now", salesPursuitRationale: "A synthetic proof conversation is practical.",
    strategy: { observedTrigger: "Synthetic trigger.", specificProblem: "Synthetic problem.", goshshaWedge: "Synthetic wedge.", retailerIndependenceAssessment: "No dependency evidenced.", selectedEntryOffer: "Free First", offerRationale: "Proof first.", physicalScanProofPoint: "A physical scan can be reviewed.", paidConversionHypothesis: "A later paid path remains hypothetical.", desiredNextAction: "Founder reviews a possible conversation." },
    contacts: [{ id: "synthetic-contact", name: "Synthetic Contact", currentTitle: "Founder", company: "Synthetic Brand", identityEvidenceIds: ["sales-1"], currentRoleEvidenceIds: ["sales-1"], stakeholderFunction: "Brand leadership", problemOwnership: "direct", functionalRelevance: "Synthetic inference.", functionalRelevanceClassification: "sales_inference", confidence: "Confirmed", freshness: "current", conflictingEvidenceIds: [], strategicRoles: ["Best First Contact"], strategicRoleRationale: "Synthetic rationale.", buyingAuthority: "unknown", buyingAuthorityEvidenceIds: [], contactRoute: { type: "public_professional_profile", value: "https://example.com/evidence", evidenceIds: ["sales-1"] }, evidenceIds: ["sales-1"] }],
    contactSelection: { status: "recommended", bestFirstContactId: "synthetic-contact", unavailableReason: null, smallestSufficientSetRationale: "One synthetic contact." },
    proofStrategy: "Synthetic proof strategy.",
    claims: [{ id: "claim-1", statement: "The synthetic contact is publicly associated with the synthetic Brand.", classification: "verified_fact", evidenceRefs: [{ kind: "sales_evidence", id: "sales-1" }] }, { id: "claim-2", statement: "Free First is a $0 proof mechanism.", classification: "goshsha_capability", evidenceRefs: [{ kind: "goshsha_capability", id: "cap-free-first" }] }],
    inheritedUnknowns,
    rights: { status: "unknown", evidenceIds: [], conditionalRequirement: "The Brand must later supply or confirm Brand-owned or properly licensed content." },
    retailerIndependence: { posture: "retailer_independent", description: "No dependency evidenced.", evidenceIds: [] },
    objections: [],
    outreach: { recommendedChannel: "Public professional profile", objective: "Founder review.", initialMessage: "Would you review a proof concept?", firstFollowUp: "A proof can be shown.", secondFollowUp: "Rights remain required.", closeTheLoop: null, claimIds: ["claim-2"] },
    evidence: [{ id: "sales-1", publisher: "Synthetic source", sourceUrl: "https://example.com/evidence", supportedClaim: "Synthetic contact association.", classification: "verified_fact" }],
  };
}

function rejection(raw) {
  try {
    normalizeCompletedOpenAISalesResponse({ response: completedResponse(raw), request: requestFixture(), requestedModel: "gpt-5.6-terra", serverReceivedAt: "2026-10-13T12:00:00.000Z" });
  } catch (error) {
    assert.ok(error instanceof SalesResearchError);
    return error;
  }
  assert.fail("Expected local rejection");
}

test("completed rejected output is exact, hashed, untrusted, bounded, and never normalized or authorized", () => {
  const raw = JSON.stringify({ synthetic: true, claim: "The Brand owns the Creator video content.", credential: "not-a-real-secret" });
  const diagnostic = rejection(raw).rejectedOutputDiagnostic;
  assert.equal(diagnostic.schemaVersion, "sales-01-rejected-output-diagnostic-v1");
  assert.equal(diagnostic.trustStatus, "UNTRUSTED_REJECTED");
  assert.equal(diagnostic.handoffEligible, false);
  assert.equal(diagnostic.raw.sha256, createHash("sha256").update(raw).digest("hex"));
  assert.equal(diagnostic.raw.content.availability, "included");
  assert.equal(diagnostic.raw.content.exactStructuredOutput, raw);
  assert.deepEqual(diagnostic.normalization, { completed: false, normalizedOutput: null });
  assert.deepEqual(Object.values(diagnostic.authority), [false, false, false, false, false]);
});

test("oversize rejected output is omitted rather than truncated or mislabeled exact", () => {
  const raw = `{"synthetic":"${"x".repeat(MAX_REJECTED_OUTPUT_DIAGNOSTIC_BYTES + 1)}"}`;
  const diagnostic = rejection(raw).rejectedOutputDiagnostic;
  assert.equal(diagnostic.raw.sha256, createHash("sha256").update(raw).digest("hex"));
  assert.equal(diagnostic.raw.content.availability, "omitted_size_limit");
  assert.equal(diagnostic.raw.content.exactStructuredOutput, null);
  assert.ok(diagnostic.raw.byteLength > MAX_REJECTED_OUTPUT_DIAGNOSTIC_BYTES);
});

test("route keeps the test factory internal and rejected UI has no export or downstream controls", async () => {
  const route = await readFile("app/api/admin/agents/sales-01/research/route.ts", "utf8");
  const page = await readFile("app/admin/sales-01/page.tsx", "utf8");
  assert.doesNotMatch(route, /export\s+(?:function|const)\s+(?:create|test|handler)/i);
  assert.match(route, /authorizeSalesAdmin/);
  assert.match(route, /Cache-Control.*no-store/);
  assert.doesNotMatch(route, /console\.(?:log|info|debug).*rejectedOutputDiagnostic/);
  assert.match(page, /UNTRUSTED · REJECTED · NOT HANDOFF ELIGIBLE/);
  assert.match(page, /exactStructuredOutput/);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML/);
});

test("actual POST handler authenticates before mocked provider access and discloses diagnostics only to Admin", async () => {
  process.env.NODE_ENV = "test";
  register(`data:text/javascript,${encodeURIComponent(`export async function resolve(specifier, context, nextResolve) { return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context); }`)}`, import.meta.url);
  const route = await import(`../../app/api/admin/agents/sales-01/research/route.ts?diagnostic=${Date.now()}`);
  let providerAccesses = 0;
  const request = () => new Request("http://localhost/api/admin/agents/sales-01/research", { method: "POST", headers: { authorization: "Bearer synthetic", "content-type": "application/json" }, body: JSON.stringify(requestFixture()) });
  globalThis.__salesResearchRouteTestDependencies = {
    authorize: async () => { throw new SalesAdminAuthError(403, "Admin access required."); },
    createProvider: () => ({ research: async () => { providerAccesses += 1; assert.fail("Provider must not be accessed before Admin authorization"); } }),
  };
  const denied = await route.POST(request());
  assert.equal(denied.status, 403);
  assert.equal(providerAccesses, 0);
  assert.equal((await denied.json()).rejectedOutputDiagnostic, null);

  const raw = '{"synthetic":true,"claim":"Rights are not confirmed, but the Brand can reuse Creator content."';
  globalThis.__salesResearchRouteTestDependencies = {
    authorize: async () => {},
    createProvider: () => ({ research: async (input) => {
      providerAccesses += 1;
      return normalizeCompletedOpenAISalesResponse({ response: completedResponse(raw), request: input, requestedModel: "gpt-5.6-terra", serverReceivedAt: "2026-10-13T12:00:00.000Z" });
    } }),
  };
  const response = await route.POST(request());
  const body = await response.json();
  assert.equal(response.status, 502, JSON.stringify(body));
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(providerAccesses, 1);
  assert.equal(body.rejectedOutputDiagnostic.trustStatus, "UNTRUSTED_REJECTED");
  assert.equal(body.rejectedOutputDiagnostic.raw.content.exactStructuredOutput, raw);
  assert.equal(body.crmExportAuthorized, false);
  assert.equal(body.crmExport, undefined);
  assert.equal(body.proposal, undefined);

  globalThis.__salesResearchRouteTestDependencies = {
    authorize: async () => {},
    createProvider: () => ({ research: async (input) => normalizeCompletedOpenAISalesResponse({ response: completedResponse(JSON.stringify(validProposal(input))), request: input, requestedModel: "gpt-5.6-terra", serverReceivedAt: "2026-10-13T12:00:00.000Z" }) }),
  };
  const accepted = await route.POST(request());
  const acceptedBody = await accepted.json();
  assert.equal(accepted.status, 200);
  assert.equal(acceptedBody.outcome, "accepted");
  assert.equal(acceptedBody.rejectedOutputDiagnostic, undefined);
  assert.equal(acceptedBody.proposal.playbook.authority.persistence, false);
  delete globalThis.__salesResearchRouteTestDependencies;
});

test("component keeps diagnostics only in React memory and declares no browser persistence", async () => {
  const page = await readFile("app/admin/sales-01/page.tsx", "utf8");
  assert.match(page, /rejectedOutputDiagnostic\?: SalesRejectedOutputDiagnostic/);
  assert.doesNotMatch(page, /localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(page, /persist.*rejectedOutputDiagnostic|rejectedOutputDiagnostic.*persist/i);
});
