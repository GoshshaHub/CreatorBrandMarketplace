import assert from "node:assert/strict";
import test from "node:test";

import { createSyntheticGrowthSalesExport, syntheticSalesContractMetadata } from "../../lib/agents/sales-01/fixtures.ts";
import { normalizeCompletedOpenAISalesResponse, SalesResearchError, validateSalesResearchRequest } from "../../lib/agents/sales-01/research-schema.ts";
import { validateSalesIntake } from "../../lib/agents/sales-01/validation.ts";

function envelope() { return validateSalesIntake({ input: { export: createSyntheticGrowthSalesExport(), candidateId: "buff-the-buff-ritual", founderApproval: { approved: true, scope: "sales_preparation_only" } }, approvedByUid: "founder", approvedAt: "2026-09-24T12:00:00.000Z", salesContract: syntheticSalesContractMetadata }).envelope; }
function request() { return { envelope: envelope(), founderAuthorization: { authorized: true, scope: "one_sales_research_run" }, budgetAuthority: { confirmedByFounder: true, salesMonthSpendUsd: 0, commercialDepartmentMonthSpendUsd: 0 } }; }
function proposal() { return {
  partial: false, limitations: [], salesPursuitDecision: "Pursue Now", salesPursuitRationale: "A small proof conversation is practical.",
  strategy: { observedTrigger: "The validated Growth trigger remains current.", specificProblem: "The shelf moment lacks the online product context.", goshshaWedge: "Bring the validated product story to the physical scan.", retailerIndependenceAssessment: "No retailer-controlled dependency is evidenced.", selectedEntryOffer: "Free First", offerRationale: "Use proof before the paid path.", physicalScanProofPoint: "Brand scans its own product and sees the experience.", paidConversionHypothesis: "$99 IRL Retail Media after proof.", desiredNextAction: "Seek a short exploratory conversation." },
  contacts: [{ id: "contact-1", name: "Aisha Joshi", currentTitle: "Founder", company: "Buff Beauty", strategicRoles: ["Best First Contact"], strategicRoleRationale: "Small-company accessibility and direct Brand context.", buyingAuthority: "unknown", buyingAuthorityEvidenceIds: [], contactRoute: { type: "public_professional_profile", value: "https://example.com/aisha", evidenceIds: ["sales-1"] }, evidenceIds: ["sales-1"] }],
  proofStrategy: "Confirm product/content readiness, then demonstrate the physical scan.",
  claims: [{ id: "claim-1", statement: "Aisha Joshi is publicly associated with Buff Beauty.", classification: "verified_fact", evidenceRefs: [{ kind: "sales_evidence", id: "sales-1" }] }, { id: "claim-2", statement: "Free First is a $0 proof mechanism.", classification: "goshsha_capability", evidenceRefs: [{ kind: "goshsha_capability", id: "cap-free-first" }] }],
  inheritedUnknowns: [{ originalText: "Brand interest and content rights remain unknown until verified.", status: "unresolved", resolution: null, salesEvidenceIds: [] }],
  rights: { status: "unknown", evidenceIds: [], conditionalRequirement: "The Brand must supply or confirm properly licensed content." },
  retailerIndependence: { posture: "retailer_independent", description: "No evidence-supported retailer dependency exists.", evidenceIds: [] },
  objections: [{ objection: "What is required?", response: "One product and properly licensed video are required for the proof.", claimIds: ["claim-2"], escalate: false }],
  outreach: { recommendedChannel: "Public professional profile", objective: "Start a qualified conversation.", initialMessage: "Would you be open to seeing a product-level scan proof?", firstFollowUp: "I can show the physical scan proof point.", secondFollowUp: "The proof uses one product and properly licensed content.", closeTheLoop: null, claimIds: ["claim-2"] },
  evidence: [{ id: "sales-1", publisher: "Public professional page", sourceUrl: "https://example.com/aisha?utm_source=test", supportedClaim: "Aisha Joshi is publicly associated with Buff Beauty.", classification: "verified_fact" }],
}; }
function response(value = proposal()) { return { id: "resp_sales", model: "gpt-5.6-terra", status: "completed", output: [{ type: "web_search_call", action: { sources: [{ url: "https://example.com/aisha?utm_source=test", title: "Aisha" }] } }, { type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }], usage: { input_tokens: 100, input_tokens_details: { cached_tokens: 10 }, output_tokens: 50, output_tokens_details: { reasoning_tokens: 5 }, total_tokens: 150 } }; }
function normalize(value = proposal()) { return normalizeCompletedOpenAISalesResponse({ response: response(value), request: request(), requestedModel: "gpt-5.6-terra", serverReceivedAt: "2026-09-24T12:30:00.000Z" }); }

test("valid provider output becomes a nonpersistent, non-sending playbook and CRM preview", () => {
  const result = normalize();
  assert.equal(result.playbook.schemaVersion, "sales-playbook-v1"); assert.equal(result.playbook.growthQualification.score, 81); assert.equal(result.playbook.growthQualification.band, "Immediate Priority");
  assert.equal(result.playbook.outreach.sendingAuthorized, false); assert.equal(result.playbook.crmReadyPacket.schemaVersion, "sales-crm-ready-v1"); assert.equal(result.playbook.crmReadyPacket.crmWriteAuthorized, false); assert.equal(result.playbook.authority.persistence, false);
  assert.equal(result.playbook.opportunityStrategy.offerFacts.irlRetailMedia, "$99 / one product / one video / 90 days / first 1,000 qualified views");
  assert.equal(result.playbook.evidence[0].canonicalUrl, "https://example.com/aisha"); assert.equal(result.playbook.evidence[0].rawUrl, "https://example.com/aisha?utm_source=test");
});

test("Phase 1B requires separate authorization and a current intact Phase 1A envelope", () => {
  assert.deepEqual(validateSalesResearchRequest(request()), []);
  const missing = request(); missing.founderAuthorization.authorized = false; assert.ok(validateSalesResearchRequest(missing).length);
  const tampered = structuredClone(request()); tampered.envelope.qualification.score = 99; assert.ok(validateSalesResearchRequest(tampered).length);
});

test("inherited unknowns cannot disappear and resolution requires current evidence", () => {
  const missing = proposal(); missing.inheritedUnknowns = []; assert.throws(() => normalize(missing), (error) => error instanceof SalesResearchError && error.code === "inherited_unknown_missing");
  const unsupported = proposal(); unsupported.inheritedUnknowns[0] = { ...unsupported.inheritedUnknowns[0], status: "resolved_by_sales_evidence", resolution: "Resolved", salesEvidenceIds: ["missing"] }; assert.throws(() => normalize(unsupported), (error) => error.code === "unknown_resolution_unsupported");
});

test("strategic roles do not establish buying authority; supported authority needs explicit evidence", () => {
  assert.equal(normalize().playbook.contacts[0].buyingAuthority, "unknown");
  const unsupported = proposal(); unsupported.contacts[0].buyingAuthority = "supported"; assert.throws(() => normalize(unsupported), (error) => error.code === "buying_authority_unsupported");
});

test("guessed email, phone, profile, inferred route, and model-only citations fail", () => {
  for (const value of ["ceo@example.com", "+1 555 000 0000"]) { const invalid = proposal(); invalid.contacts[0].contactRoute.value = value; assert.throws(() => normalize(invalid), (error) => error.code === "contact_route_invalid"); }
  const guessedProfile = proposal(); guessedProfile.contacts[0].contactRoute.value = "https://linkedin.com/in/unlisted-person"; assert.throws(() => normalize(guessedProfile), (error) => error.code === "contact_route_unverified");
  const inferred = proposal(); inferred.contacts[0].contactRoute.type = "inferred"; assert.throws(() => normalize(inferred), (error) => error.code === "contact_route_invalid");
  const modelOnly = proposal(); modelOnly.evidence[0].sourceUrl = "https://not-native.example/contact"; assert.throws(() => normalize(modelOnly), (error) => error.code === "model_only_source_rejected");
});

test("contact and stakeholder-role ceilings fail visibly without truncation", () => {
  const tooMany = proposal(); tooMany.contacts = Array.from({ length: 7 }, (_, index) => ({ ...structuredClone(tooMany.contacts[0]), id: `contact-${index}` })); assert.throws(() => normalize(tooMany), (error) => error.code === "contact_limit_exceeded");
  const tooManyForRole = proposal(); tooManyForRole.contacts = Array.from({ length: 3 }, (_, index) => ({ ...structuredClone(tooManyForRole.contacts[0]), id: `contact-${index}` })); assert.throws(() => normalize(tooManyForRole), (error) => error.code === "stakeholder_role_limit_exceeded");
});

test("rights and retailer dependency cannot be upgraded without current evidence", () => {
  const rights = proposal(); rights.rights.status = "explicitly_supported"; assert.throws(() => normalize(rights), (error) => error.code === "rights_evidence_missing");
  const retailer = proposal(); retailer.retailerIndependence.posture = "evidence_supported_dependency"; assert.throws(() => normalize(retailer), (error) => error.code === "retailer_dependency_unsupported");
});

test("health/efficacy claims, rights assertions, and unauthorized commercial promises fail safely", () => {
  const health = proposal(); health.claims[0].statement = "The supplement is safe and effective."; assert.throws(() => normalize(health), (error) => error.code === "regulated_claim_invalid");
  const rightsClaim = proposal(); rightsClaim.claims[0].statement = "The Brand owns the Creator video content."; assert.throws(() => normalize(rightsClaim), (error) => error.code === "rights_claim_unsupported");
  const promise = proposal(); promise.claims[0].statement = "Goshsha guarantees ROI with a custom implementation."; assert.throws(() => normalize(promise), (error) => error.code === "unsupported_commercial_promise");
});

test("outreach only uses approved claim IDs and retains safe completed-provider metadata on rejection", () => {
  const invalid = proposal(); invalid.outreach.claimIds = ["missing"];
  assert.throws(() => normalize(invalid), (error) => { assert.equal(error.code, "outreach_claim_invalid"); assert.equal(error.providerExecution.outcome, "provider_completed_local_rejection"); assert.equal(error.providerExecution.usage.totalTokens, 150); assert.doesNotMatch(JSON.stringify(error.providerExecution), /Aisha|example\.com|initialMessage/); return true; });
});
