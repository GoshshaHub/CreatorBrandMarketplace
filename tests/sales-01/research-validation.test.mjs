import assert from "node:assert/strict";
import test from "node:test";

import { createSyntheticGrowthSalesExport, createSyntheticValidatedGrowthRun, syntheticSalesContractMetadata } from "../../lib/agents/sales-01/fixtures.ts";
import { createGrowthSalesExport } from "../../lib/agents/sales-01/export.ts";
import { APPROVED_GROWTH_PROVIDER_PROJECTION_SHA256, GROWTH_PROVIDER_RESEARCH_PROJECTION_VERSION, PAIRED_FROZEN_GROWTH_CONTRACT_SHA256, PAIRED_FROZEN_GROWTH_CONTRACT_VERSION } from "../../lib/agents/growth-01/provider-research-contract.ts";
import { normalizeCompletedOpenAISalesResponse, SalesResearchError, validateSalesResearchRequest } from "../../lib/agents/sales-01/research-schema.ts";
import { GOSHSHHA_CAPABILITY_FACTS } from "../../lib/agents/sales-01/research-prompt.ts";
import { validateSalesIntake } from "../../lib/agents/sales-01/validation.ts";

function envelope() { return validateSalesIntake({ input: { export: createSyntheticGrowthSalesExport(), candidateId: "buff-the-buff-ritual", founderApproval: { approved: true, scope: "sales_preparation_only" } }, approvedByUid: "founder", approvedAt: "2026-09-24T12:00:00.000Z", salesContract: syntheticSalesContractMetadata }).envelope; }
function request() { return { envelope: envelope(), founderAuthorization: { authorized: true, scope: "one_sales_research_run" }, budgetAuthority: { confirmedByFounder: true, salesMonthSpendUsd: 0, commercialDepartmentMonthSpendUsd: 0 } }; }
function proposal() { return {
  partial: false, limitations: [], salesPursuitDecision: "Pursue Now", salesPursuitRationale: "A small proof conversation is practical.",
  strategy: { observedTrigger: "The validated Growth trigger remains current.", specificProblem: "The shelf moment lacks the online product context.", goshshaWedge: "Bring the validated product story to the physical scan.", retailerIndependenceAssessment: "No retailer-controlled dependency is evidenced.", selectedEntryOffer: "Free First", offerRationale: "Use proof before the paid path.", physicalScanProofPoint: "Brand scans its own product and sees the experience.", paidConversionHypothesis: "$99 IRL Retail Media after proof.", desiredNextAction: "Seek a short exploratory conversation." },
  contacts: [{ id: "contact-1", name: "Aisha Joshi", currentTitle: "Founder", company: "Buff Beauty", identityEvidenceIds: ["sales-1"], currentRoleEvidenceIds: ["sales-1"], stakeholderFunction: "Brand leadership", problemOwnership: "direct", functionalRelevance: "The evidenced Brand leadership remit directly owns the identified product-story problem.", functionalRelevanceClassification: "sales_inference", confidence: "Confirmed", freshness: "current", conflictingEvidenceIds: [], strategicRoles: ["Best First Contact"], strategicRoleRationale: "Small-company accessibility and direct Brand context.", buyingAuthority: "unknown", buyingAuthorityEvidenceIds: [], contactRoute: { type: "public_professional_profile", value: "https://example.com/aisha", evidenceIds: ["sales-1"] }, evidenceIds: ["sales-1"] }],
  contactSelection: { status: "recommended", bestFirstContactId: "contact-1", unavailableReason: null, smallestSufficientSetRationale: "One evidenced contact is sufficient for this Founder-stage conversation." },
  proofStrategy: "Confirm product/content readiness, then demonstrate the physical scan.",
  claims: [{ id: "claim-1", statement: "Aisha Joshi is publicly associated with Buff Beauty.", classification: "verified_fact", evidenceRefs: [{ kind: "sales_evidence", id: "sales-1" }] }, { id: "claim-2", statement: "Free First is a $0 proof mechanism.", classification: "goshsha_capability", evidenceRefs: [{ kind: "goshsha_capability", id: "cap-free-first" }] }],
  inheritedUnknowns: [{ originalText: "Brand interest and content rights remain unknown until verified.", status: "unresolved", resolution: null, salesEvidenceIds: [] }],
  rights: { status: "unknown", evidenceIds: [], conditionalRequirement: "The Brand must later supply or confirm Brand-owned or properly licensed content." },
  retailerIndependence: { posture: "retailer_independent", description: "No evidence-supported retailer dependency exists.", evidenceIds: [] },
  objections: [{ objection: "What is required?", response: "One product and properly licensed video are required for the proof.", claimIds: ["claim-2"], escalate: false }],
  outreach: { recommendedChannel: "Public professional profile", objective: "Start a qualified conversation.", initialMessage: "Would you be open to seeing a product-level scan proof?", firstFollowUp: "I can show the physical scan proof point.", secondFollowUp: "The proof uses one product and properly licensed content.", closeTheLoop: null, claimIds: ["claim-2"] },
  evidence: [{ id: "sales-1", publisher: "Public professional page", sourceUrl: "https://example.com/aisha?utm_source=test", supportedClaim: "Aisha Joshi is publicly associated with Buff Beauty.", classification: "verified_fact" }],
}; }
function response(value = proposal()) { return { id: "resp_sales", model: "gpt-5.6-terra", status: "completed", output: [{ type: "web_search_call", action: { sources: [{ url: "https://example.com/aisha?utm_source=test", title: "Aisha" }] } }, { type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }], usage: { input_tokens: 100, input_tokens_details: { cached_tokens: 10 }, output_tokens: 50, output_tokens_details: { reasoning_tokens: 5 }, total_tokens: 150 } }; }
function normalize(value = proposal()) { return normalizeCompletedOpenAISalesResponse({ response: response(value), request: request(), requestedModel: "gpt-5.6-terra", serverReceivedAt: "2026-09-24T12:30:00.000Z" }); }

function syntheticCymbiotikaRequest() {
  const run = createSyntheticValidatedGrowthRun();
  const candidate = run.candidates[0];
  candidate.id = "synthetic-cymbiotika-whole-foods";
  candidate.brand = "Cymbiotika";
  candidate.productOrEvent = "Synthetic Whole Foods product-education opportunity";
  candidate.trigger = "Synthetic fixture: a current physical-retail expansion.";
  candidate.knownUnknowns = [
    "Whether Cymbiotika owns or has obtained reuse rights for a specific video suitable for Goshsha activation.",
    "Which retail-present SKU the Brand would prioritize for a first scan experience.",
  ];
  const replacements = new Map([["buff-retail", "CYM-E1"], ["buff-content", "CYM-E2"], ["buff-trigger", "CYM-E3"]]);
  for (const evidence of candidate.evidence) { evidence.id = replacements.get(evidence.id); evidence.publisher = "Synthetic Cymbiotika fixture"; evidence.syntheticBenchmark = true; }
  for (const claim of candidate.claims) claim.evidenceIds = claim.evidenceIds.map((id) => replacements.get(id));
  const growthExport = createGrowthSalesExport({ validatedRun: run, providerProjection: { version: GROWTH_PROVIDER_RESEARCH_PROJECTION_VERSION, sha256: APPROVED_GROWTH_PROVIDER_PROJECTION_SHA256, pairedFrozenContractVersion: PAIRED_FROZEN_GROWTH_CONTRACT_VERSION, pairedFrozenContractSha256: PAIRED_FROZEN_GROWTH_CONTRACT_SHA256 }, exportedAt: "2026-10-13T10:00:00.000Z" });
  const intake = validateSalesIntake({ input: { export: growthExport, candidateId: candidate.id, founderApproval: { approved: true, scope: "sales_preparation_only" } }, approvedByUid: "synthetic-founder", approvedAt: "2026-10-13T10:01:00.000Z", salesContract: syntheticSalesContractMetadata });
  assert.equal(intake.status, "valid");
  return { envelope: intake.envelope, founderAuthorization: { authorized: true, scope: "one_sales_research_run" }, budgetAuthority: { confirmedByFounder: true, salesMonthSpendUsd: 0, commercialDepartmentMonthSpendUsd: 0 } };
}

test("valid provider output becomes a nonpersistent, non-sending playbook and CRM preview", () => {
  const result = normalize();
  assert.equal(result.playbook.schemaVersion, "sales-playbook-v1.1"); assert.equal(result.playbook.growthQualification.score, 81); assert.equal(result.playbook.growthQualification.band, "Immediate Priority");
  assert.equal(result.playbook.outreach.sendingAuthorized, false); assert.equal(result.playbook.crmReadyPacket.schemaVersion, "sales-crm-ready-v1"); assert.equal(result.playbook.crmReadyPacket.crmWriteAuthorized, false); assert.equal(result.playbook.authority.persistence, false);
  assert.equal(result.playbook.opportunityStrategy.offerFacts.irlRetailMedia, "$99 / one product / one video / 90 days / first 1,000 qualified views");
  assert.equal(result.playbook.evidence[0].canonicalUrl, "https://example.com/aisha"); assert.equal(result.playbook.evidence[0].rawUrl, "https://example.com/aisha?utm_source=test");
  assert.equal(result.playbook.positioningFoundation.schemaVersion, "goshsha-commercial-positioning-v1");
  assert.equal(result.playbook.positioningFoundation.audienceObjection.objection, "How many users does Goshsha have?");
  assert.equal(result.playbook.objections[0].objection, "How many users does Goshsha have?");
});

test("complete explicitly synthetic Cymbiotika-shaped proposal passes with unknown rights and buying authority", () => {
  const cymRequest = syntheticCymbiotikaRequest();
  const value = proposal();
  value.contacts[0].name = "Synthetic Cymbiotika Contact";
  value.contacts[0].company = "Cymbiotika";
  value.claims[0] = { id: "claim-growth", statement: "Synthetic fixture: Cymbiotika has a physical-retail trigger.", classification: "verified_fact", evidenceRefs: [{ kind: "growth_evidence", id: "CYM-E1" }] };
  value.inheritedUnknowns = cymRequest.envelope.evidence.knownUnknowns.map((originalText) => ({ originalText, status: "unresolved", resolution: null, salesEvidenceIds: [] }));
  value.claims.push({ id: "rights-exact-unknown", statement: value.inheritedUnknowns[0].originalText, classification: "unknown", evidenceRefs: [] });
  const result = normalizeCompletedOpenAISalesResponse({ response: response(value), request: cymRequest, requestedModel: "gpt-5.6-terra", serverReceivedAt: "2026-10-13T10:02:00.000Z" });
  assert.equal(result.playbook.growthQualification.brand, "Cymbiotika");
  assert.equal(result.playbook.rights.status, "unknown");
  assert.deepEqual(result.playbook.rights.evidenceIds, []);
  assert.equal(result.playbook.contacts[0].buyingAuthority, "unknown");
  assert.equal(result.playbook.inheritedUnknowns.every((item) => item.status === "unresolved"), true);
});

test("unsupported audience, guaranteed reach, and performance claims fail closed",()=>{for(const statement of ["Goshsha has a massive audience.","Goshsha guarantees 1,000 views.","Goshsha guarantees sales lift."]){const invalid=proposal();invalid.claims[0].statement=statement;assert.throws(()=>normalize(invalid),(error)=>["unsupported_audience_claim","unsupported_commercial_promise"].includes(error.code));}});

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

test("contact intelligence requires separate identity, role, function, relevance, confidence, freshness, and evidence", () => {
  for (const field of ["identityEvidenceIds", "currentRoleEvidenceIds"]) { const invalid = proposal(); invalid.contacts[0][field] = []; assert.throws(() => normalize(invalid), (error) => error.code === "contact_evidence_invalid"); }
  const invalidRef = proposal(); invalidRef.contacts[0].currentRoleEvidenceIds = ["missing"]; assert.throws(() => normalize(invalidRef), (error) => error.code === "contact_evidence_invalid");
  const wrongClass = proposal(); wrongClass.contacts[0].functionalRelevanceClassification = "verified_fact"; assert.throws(() => normalize(wrongClass), (error) => error.code === "functional_relevance_classification_invalid");
  const conflicting = proposal(); conflicting.contacts[0].freshness = "conflicting"; assert.throws(() => normalize(conflicting), (error) => error.code === "contact_evidence_invalid");
});

test("Best First Contact is zero-or-one, evidence-supported, and may be explicitly unavailable", () => {
  const second = structuredClone(proposal().contacts[0]); second.id = "contact-2"; const duplicate = proposal(); duplicate.contacts.push(second); assert.throws(() => normalize(duplicate), (error) => error.code === "best_first_contact_limit_exceeded");
  for (const field of [["problemOwnership", "unknown"], ["confidence", "Uncertain"], ["freshness", "stale"]]) { const invalid = proposal(); invalid.contacts[0][field[0]] = field[1]; assert.throws(() => normalize(invalid), (error) => error.code === "best_first_contact_support_insufficient"); }
  const unavailable = proposal(); unavailable.contacts[0].strategicRoles = ["Operational Owner"]; unavailable.contactSelection = { status: "unavailable", bestFirstContactId: null, unavailableReason: "No evidenced person currently meets the Best First Contact standard.", smallestSufficientSetRationale: "Retain the one evidenced operational contact without inventing a recommendation." }; const result = normalize(unavailable); assert.equal(result.playbook.crmReadyPacket.bestFirstContactId, null); assert.equal(result.playbook.crmReadyPacket.bestFirstContactStatus, "unavailable");
  const missingGap = structuredClone(unavailable); missingGap.contactSelection.unavailableReason = null; assert.throws(() => normalize(missingGap), (error) => error.code === "best_first_contact_gap_missing");
});

test("generic or unrelated Partnerships titles do not qualify as Best First Contact", () => {
  for (const [title, fn] of [["VP, Partnerships", "Partnerships"], ["Head of Technology Alliances", "Technology Alliances"], ["Director, Wholesale", "Wholesale"]]) { const invalid = proposal(); invalid.contacts[0].currentTitle = title; invalid.contacts[0].stakeholderFunction = fn; assert.throws(() => normalize(invalid), (error) => error.code === "best_first_contact_function_unsupported"); }
});

test("guessed email, phone, profile, inferred route, and model-only citations fail", () => {
  for (const value of ["ceo@example.com", "+1 555 000 0000"]) { const invalid = proposal(); invalid.contacts[0].contactRoute.value = value; assert.throws(() => normalize(invalid), (error) => error.code === "contact_route_invalid"); }
  const guessedProfile = proposal(); guessedProfile.contacts[0].contactRoute.value = "https://linkedin.com/in/unlisted-person"; assert.throws(() => normalize(guessedProfile), (error) => error.code === "contact_route_unverified");
  const inferred = proposal(); inferred.contacts[0].contactRoute.type = "inferred"; assert.throws(() => normalize(inferred), (error) => error.code === "contact_route_invalid");
  const modelOnly = proposal(); modelOnly.evidence[0].sourceUrl = "https://not-native.example/contact";
  assert.throws(() => normalize(modelOnly), (error) => {
    assert.equal(error.code, "model_only_source_rejected");
    assert.equal(error.providerExecution.rejectionDiagnostics.failureStage, "sales_evidence_native_reconciliation");
    assert.equal(error.providerExecution.rejectionDiagnostics.proposedHostname, "not-native.example");
    assert.equal(error.providerExecution.rejectionDiagnostics.redirectResolutionAttempted, false);
    assert.equal(error.providerExecution.rejectionDiagnostics.nativeActionSourceCount, 1);
    assert.equal(error.providerExecution.rejectionDiagnostics.nativeAnnotationSourceCount, 0);
    assert.doesNotMatch(JSON.stringify(error.providerExecution), /contact-1|sales-1|not-native\.example\/contact/);
    return true;
  });
});

test("provider-native Responses URL citation annotations are accepted without scanning generated JSON", () => {
  const annotated = response();
  annotated.output[0].action.sources = [];
  annotated.output[1].content[0].annotations = [{ type: "url_citation", start_index: 0, end_index: 5, url: "https://example.com/aisha?utm_source=annotation", title: "Aisha citation" }];
  const result = normalizeCompletedOpenAISalesResponse({ response: annotated, request: request(), requestedModel: "gpt-5.6-terra", serverReceivedAt: "2026-09-24T12:30:00.000Z" });
  assert.equal(result.playbook.evidence[0].canonicalUrl, "https://example.com/aisha");
  assert.equal(result.playbook.evidence[0].rawUrl, "https://example.com/aisha?utm_source=annotation");

  const generatedOnly = response();
  generatedOnly.output[0].action.sources = [];
  assert.throws(() => normalizeCompletedOpenAISalesResponse({ response: generatedOnly, request: request(), requestedModel: "gpt-5.6-terra", serverReceivedAt: "2026-09-24T12:30:00.000Z" }), (error) => error.code === "native_source_provenance_missing");
});

test("malformed or unsupported annotations are ignored while valid action sources remain authoritative", () => {
  const malformed = response();
  malformed.output[1].content[0].annotations = [null, { type: "url_citation" }, { type: "url_citation", url: 42 }, { type: "other", url: "https://not-native.example" }, { type: "url_citation", url_citation: { url: "https://not-native.example" } }];
  assert.equal(normalizeCompletedOpenAISalesResponse({ response: malformed, request: request(), requestedModel: "gpt-5.6-terra", serverReceivedAt: "2026-09-24T12:30:00.000Z" }).normalizedSourceCount, 1);
});

test("inherited GROWTH sources remain separate from current-run SALES evidence", () => {
  const inherited = proposal();
  inherited.evidence[0].sourceUrl = request().envelope.evidence.items[0].sourceUrl;
  assert.throws(() => normalize(inherited), (error) => {
    assert.equal(error.code, "model_only_source_rejected");
    assert.equal(error.providerExecution.rejectionDiagnostics.matchesInheritedGrowthSource, true);
    return true;
  });
});

test("redirect and destination URLs are not treated as equivalent", () => {
  const redirectOnly = response();
  redirectOnly.output[0].action.sources = [{ url: "https://redirect.example/to-aisha", title: "Redirect" }];
  assert.throws(() => normalizeCompletedOpenAISalesResponse({ response: redirectOnly, request: request(), requestedModel: "gpt-5.6-terra", serverReceivedAt: "2026-09-24T12:30:00.000Z" }), (error) => error.code === "model_only_source_rejected" && error.providerExecution.rejectionDiagnostics.redirectResolutionAttempted === false);
});

test("rejection diagnostics are bounded, hashed, and redact untrusted evidence identifiers and URL paths", () => {
  const invalid = proposal();
  invalid.evidence[0].id = "hostile-identifier-with-private-contact-name";
  invalid.evidence[0].sourceUrl = "https://evidence.example/private/contact/path?token=not-returned";
  const manySources = response(invalid);
  manySources.output[0].action.sources = Array.from({ length: 30 }, (_, index) => ({ url: `https://native-${index}.example/path`, title: `Source ${index}` }));
  assert.throws(() => normalizeCompletedOpenAISalesResponse({ response: manySources, request: request(), requestedModel: "gpt-5.6-terra", serverReceivedAt: "2026-09-24T12:30:00.000Z" }), (error) => {
    const serialized = JSON.stringify(error.providerExecution.rejectionDiagnostics);
    assert.equal(error.providerExecution.rejectionDiagnostics.nativeCanonicalUrlHashes.length, 20);
    assert.equal(error.providerExecution.rejectionDiagnostics.nativeHashListTruncated, true);
    assert.equal(error.providerExecution.rejectionDiagnostics.nativeActionSourceCount, 30);
    assert.equal(error.providerExecution.rejectionDiagnostics.proposedHostname, "evidence.example");
    assert.doesNotMatch(serialized, /private|contact|token|hostile-identifier|native-0\.example/);
    return true;
  });
});

test("contact and stakeholder-role ceilings fail visibly without truncation", () => {
  const tooMany = proposal(); tooMany.contacts = Array.from({ length: 7 }, (_, index) => ({ ...structuredClone(tooMany.contacts[0]), id: `contact-${index}` })); assert.throws(() => normalize(tooMany), (error) => error.code === "contact_limit_exceeded");
  const tooManyForRole = proposal(); tooManyForRole.contacts = Array.from({ length: 3 }, (_, index) => ({ ...structuredClone(tooManyForRole.contacts[0]), id: `contact-${index}` })); assert.throws(() => normalize(tooManyForRole), (error) => error.code === "stakeholder_role_limit_exceeded");
});

test("rights and retailer dependency cannot be upgraded without current evidence", () => {
  const rights = proposal(); rights.rights.status = "explicitly_supported"; assert.throws(() => normalize(rights), (error) => error.code === "rights_evidence_purpose_unsupported");
  const retailer = proposal(); retailer.retailerIndependence.posture = "evidence_supported_dependency"; assert.throws(() => normalize(retailer), (error) => error.code === "retailer_dependency_unsupported");
});

test("health/efficacy claims, rights assertions, and unauthorized commercial promises fail safely", () => {
  const health = proposal(); health.claims[0].statement = "The supplement is safe and effective."; assert.throws(() => normalize(health), (error) => error.code === "regulated_claim_invalid");
  const rightsClaim = proposal(); rightsClaim.claims[0].statement = "The Brand owns the Creator video content."; assert.throws(() => normalize(rightsClaim), (error) => error.code === "rights_claim_unsupported");
  const promise = proposal(); promise.claims[0].statement = "Goshsha guarantees ROI with a custom implementation."; assert.throws(() => normalize(promise), (error) => error.code === "unsupported_commercial_promise");
});

test("narrow rights unknowns and the exact conditional requirement remain uncertainty, not activation authority", () => {
  const unknown = proposal();
  unknown.claims.push({ id: "rights-unknown", statement: "Content rights remain unknown until verified.", classification: "unknown", evidenceRefs: [] });
  const normalizedUnknown = normalize(unknown);
  assert.equal(normalizedUnknown.playbook.claims.at(-1).statement, "Content rights remain unknown until verified.");
  assert.equal(normalizedUnknown.playbook.rights.status, "unknown");
  assert.deepEqual(normalizedUnknown.playbook.rights.evidenceIds, []);
  assert.equal(normalizedUnknown.playbook.inheritedUnknowns[0].status, "unresolved");

  const conditional = proposal();
  conditional.claims.push({ id: "rights-condition", statement: "The Brand must later supply or confirm Brand-owned or properly licensed content.", classification: "goshsha_capability", evidenceRefs: [{ kind: "goshsha_capability", id: "cap-free-first" }] });
  const normalizedConditional = normalize(conditional);
  assert.equal(normalizedConditional.playbook.claims.at(-1).classification, "goshsha_capability");
  assert.equal(normalizedConditional.playbook.rights.status, "unknown");
});

test("rights unknown and conditional language require compatible fields and preserved inherited uncertainty", () => {
  const cases = [
    { statement: "Content rights remain unknown until verified.", classification: "verified_fact", evidenceRefs: [{ kind: "sales_evidence", id: "sales-1" }] },
    { statement: "The Brand must later supply or confirm Brand-owned or properly licensed content.", classification: "unknown", evidenceRefs: [] },
    { statement: "The Brand must later supply or confirm Brand-owned or properly licensed content.", classification: "goshsha_capability", evidenceRefs: [] },
  ];
  for (const claim of cases) {
    const invalid = proposal(); invalid.claims.push({ id: "rights-incompatible", ...claim });
    assert.throws(() => normalize(invalid), (error) => error.code === "rights_claim_unsupported");
  }
  const missingPreservation = proposal();
  missingPreservation.inheritedUnknowns[0] = { ...missingPreservation.inheritedUnknowns[0], status: "resolved_by_sales_evidence", resolution: "Purportedly resolved", salesEvidenceIds: ["sales-1"] };
  missingPreservation.claims.push({ id: "rights-condition", statement: "The Brand must later supply or confirm Brand-owned or properly licensed content.", classification: "goshsha_capability", evidenceRefs: [{ kind: "goshsha_capability", id: "cap-free-first" }] });
  assert.throws(() => normalize(missingPreservation), (error) => error.code === "rights_claim_unsupported");
});

test("affirmative, ambiguous, attributed, and adversarial mixed rights language still fails closed", () => {
  const statements = [
    ["The Brand owns the Creator video content.", "affirmative_assertion"],
    ["The Brand may have usable Creator content.", "ambiguous_rights_language"],
    ["The Brand states that it owns the Creator video content.", "attributed_rights_statement"],
    ["The Brand must later supply properly licensed content, and it owns the Creator video.", "affirmative_assertion"],
    ["Rights are not confirmed, but the Brand can reuse Creator content.", "affirmative_assertion"],
    ["The Brand must later supply or confirm Brand-owned or properly licensed content, and may reuse its Creator video.", "affirmative_assertion"],
  ];
  for (const [statement, category] of statements) {
    const invalid = proposal();
    invalid.claims.push({ id: "private-rights-claim", statement, classification: "unknown", evidenceRefs: [] });
    assert.throws(() => normalize(invalid), (error) => {
      assert.equal(error.code, "rights_claim_unsupported");
      const diagnostics = error.providerExecution.rejectionDiagnostics;
      assert.equal(diagnostics.failureStage, "sales_claim_rights_validation");
      assert.equal(diagnostics.semanticCategory, category);
      assert.equal(diagnostics.rawClaimRetained, false);
      assert.equal(diagnostics.rightsStatus, "unknown");
      assert.equal(diagnostics.inheritedRightsUnknownPresent, true);
      assert.equal(diagnostics.inheritedRightsUnknownPreserved, true);
      const serialized = JSON.stringify(diagnostics);
      assert.doesNotMatch(serialized, /private-rights-claim|Creator video|properly licensed|Brand can reuse/);
      return true;
    });
  }
});

test("marketing-program ownership and job responsibilities do not become content-rights assertions", () => {
  for (const statement of [
    "Cymbiotika is recruiting a Director of Retail Marketing to own retailer-specific marketing programs across its omnichannel retail business, including shopper marketing, retail activation, educational initiatives, and retail-media integration.",
    "The role owns content marketing programs and retail activation initiatives.",
    "The Director controls marketing programs that include content strategy and retail activation.",
  ]) {
    const valid = proposal();
    valid.claims.push({ id: "job-responsibility", statement, classification: "verified_fact", evidenceRefs: [{ kind: "sales_evidence", id: "sales-1" }] });
    assert.equal(normalize(valid).playbook.claims.at(-1).statement, statement);
  }
});

test("job-responsibility context cannot hide actual content ownership, clearance, or reuse assertions", () => {
  for (const statement of [
    "The Director owns retail activation programs, and the Brand owns Creator video content.",
    "The role owns content marketing programs, and the Brand can reuse Creator videos.",
    "The Director controls retail activation initiatives; the Brand has cleared Creator content.",
    "The role owns marketing programs and controls the specific video content used for activation.",
  ]) {
    const invalid = proposal();
    invalid.claims.push({ id: "mixed-job-rights", statement, classification: "verified_fact", evidenceRefs: [{ kind: "sales_evidence", id: "sales-1" }] });
    assert.throws(() => normalize(invalid), (error) => error.code === "rights_claim_unsupported");
  }
});

test("exact Free First capability states a licensing prerequisite without establishing present Brand rights", () => {
  const exact = proposal();
  exact.claims[1].statement = GOSHSHHA_CAPABILITY_FACTS["cap-free-first"];
  assert.equal(normalize(exact).playbook.claims[1].classification, "goshsha_capability");

  for (const statement of [
    `${exact.claims[1].statement} The Brand owns the video.`,
    "Free First is $0 and the Brand can reuse its Creator video.",
  ]) {
    const invalid = proposal();
    invalid.claims[1].statement = statement;
    assert.throws(() => normalize(invalid), (error) => error.code === "rights_claim_unsupported");
  }
});

test("Creator activity evidence never becomes content-rights authority", () => {
  const activity = proposal();
  activity.claims.push({ id: "creator-activity", statement: "The Brand reposted a Creator collaboration.", classification: "verified_fact", evidenceRefs: [{ kind: "sales_evidence", id: "sales-1" }] });
  const accepted = normalize(activity);
  assert.equal(accepted.playbook.rights.status, "unknown");
  assert.deepEqual(accepted.playbook.rights.evidenceIds, []);
  assert.equal(accepted.playbook.inheritedUnknowns[0].status, "unresolved");
});

test("affirmative rights remain unknown because matching IDs cannot prove purpose-specific support", () => {
  const supported = proposal();
  supported.rights = { status: "explicitly_supported", evidenceIds: ["sales-1"], conditionalRequirement: "The evidenced specific content and reuse right are required for activation." };
  supported.claims.push({ id: "supported-rights", statement: "The Brand owns the Creator video content.", classification: "verified_fact", evidenceRefs: [{ kind: "sales_evidence", id: "sales-1" }] });
  assert.throws(() => normalize(supported), (error) => error.code === "rights_evidence_purpose_unsupported");

  const misclassified = structuredClone(supported);
  misclassified.claims.at(-1).classification = "unknown";
  misclassified.claims.at(-1).evidenceRefs = [];
  assert.throws(() => normalize(misclassified), (error) => error.code === "rights_evidence_purpose_unsupported");

  const attributed = structuredClone(supported);
  attributed.claims.at(-1).statement = "The Brand states that it owns the Creator video content.";
  attributed.claims.at(-1).classification = "attributed_brand_claim";
  assert.throws(() => normalize(attributed), (error) => error.code === "rights_evidence_purpose_unsupported");
});

test("claim reference namespaces are exact, classification-compatible, and diagnostically redacted", () => {
  const cases = [
    { name: "growth ID under SALES namespace", mutate: (value) => value.claims[0].evidenceRefs = [{ kind: "sales_evidence", id: "buff-content" }], category: "namespace_mismatch", other: true },
    { name: "SALES ID under GROWTH namespace", mutate: (value) => value.claims[0].evidenceRefs = [{ kind: "growth_evidence", id: "sales-1" }], category: "namespace_mismatch", other: true },
    { name: "unknown capability", mutate: (value) => value.claims[1].evidenceRefs = [{ kind: "goshsha_capability", id: "cap-private-invented" }], category: "missing_goshsha_capability", other: false },
    { name: "capability used as Brand fact", mutate: (value) => value.claims[0].evidenceRefs = [{ kind: "goshsha_capability", id: "cap-free-first" }], category: "classification_kind_incompatible", other: false },
  ];
  for (const item of cases) {
    const invalid = proposal(); item.mutate(invalid);
    assert.throws(() => normalize(invalid), (error) => {
      assert.equal(error.code, "claim_reference_invalid", item.name);
      const diagnostics = error.providerExecution.rejectionDiagnostics;
      assert.equal(diagnostics.failureStage, "sales_claim_reference_validation");
      assert.equal(diagnostics.failureCategory, item.category);
      assert.equal(diagnostics.existsInAnotherNamespace, item.other);
      assert.equal(diagnostics.rawClaimRetained, false);
      assert.equal(diagnostics.rawReferenceIdRetained, false);
      assert.doesNotMatch(JSON.stringify(diagnostics), /buff-content|sales-1|cap-private-invented|Aisha|Free First/);
      return true;
    });
  }
});

test("verbatim inherited rights uncertainty is accepted before assertion matching; altered or mixed wording fails", () => {
  const exact = proposal();
  exact.claims.push({ id: "rights-verbatim", statement: exact.inheritedUnknowns[0].originalText, classification: "unknown", evidenceRefs: [] });
  assert.equal(normalize(exact).playbook.claims.at(-1).classification, "unknown");

  for (const statement of [
    `${exact.inheritedUnknowns[0].originalText} The Brand can reuse the Creator video.`,
    "The Brand owns or may have obtained reusable content rights.",
  ]) {
    const invalid = proposal();
    invalid.claims.push({ id: "rights-altered", statement, classification: "unknown", evidenceRefs: [] });
    assert.throws(() => normalize(invalid), (error) => error.code === "rights_claim_unsupported");
  }
});

test("unknown rights require empty evidence and the exact approved conditional requirement", () => {
  const evidence = proposal(); evidence.rights.evidenceIds = ["sales-1"];
  assert.throws(() => normalize(evidence), (error) => error.code === "rights_unknown_evidence_invalid");
  const wording = proposal(); wording.rights.conditionalRequirement = "The Brand must supply licensed content.";
  assert.throws(() => normalize(wording), (error) => error.code === "rights_conditional_requirement_invalid");
});

test("valid contact evidence and strategic recommendation never establish buying authority", () => {
  assert.equal(normalize().playbook.contacts[0].buyingAuthority, "unknown");
  const unrelated = proposal(); unrelated.contacts[0].buyingAuthority = "supported"; unrelated.contacts[0].buyingAuthorityEvidenceIds = ["sales-1"];
  assert.throws(() => normalize(unrelated), (error) => error.code === "buying_authority_unsupported");
});

test("unknown and prohibited claims cannot carry evidence; outreach cannot use prohibited claims", () => {
  const unknown = proposal(); unknown.claims.push({ id: "unknown-linked", statement: "Budget is unknown.", classification: "unknown", evidenceRefs: [{ kind: "sales_evidence", id: "sales-1" }] });
  assert.throws(() => normalize(unknown), (error) => error.code === "claim_reference_invalid" && error.providerExecution.rejectionDiagnostics.failureCategory === "classification_kind_incompatible");
  const prohibited = proposal(); prohibited.claims.push({ id: "prohibited", statement: "Goshsha guarantees ROI.", classification: "prohibited_unsupported", evidenceRefs: [] }); prohibited.outreach.claimIds.push("prohibited");
  assert.throws(() => normalize(prohibited), (error) => error.code === "outreach_prohibited_claim");
});

test("outreach only uses approved claim IDs and retains safe completed-provider metadata on rejection", () => {
  const invalid = proposal(); invalid.outreach.claimIds = ["missing"];
  assert.throws(() => normalize(invalid), (error) => { assert.equal(error.code, "outreach_claim_invalid"); assert.equal(error.providerExecution.outcome, "provider_completed_local_rejection"); assert.equal(error.providerExecution.usage.totalTokens, 150); assert.doesNotMatch(JSON.stringify(error.providerExecution), /Aisha|example\.com|initialMessage/); return true; });
});
