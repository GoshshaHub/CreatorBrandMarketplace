import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createSyntheticGrowthSalesExport, createSyntheticValidatedGrowthRun, syntheticSalesContractMetadata } from "../../lib/agents/sales-01/fixtures.ts";
import { createGrowthSalesExport } from "../../lib/agents/sales-01/export.ts";
import { APPROVED_GROWTH_PROVIDER_PROJECTION_SHA256, GROWTH_PROVIDER_RESEARCH_PROJECTION_VERSION, PAIRED_FROZEN_GROWTH_CONTRACT_SHA256, PAIRED_FROZEN_GROWTH_CONTRACT_VERSION } from "../../lib/agents/growth-01/provider-research-contract.ts";
import { normalizeCompletedOpenAISalesResponse, SalesResearchError, validateSalesResearchRequest } from "../../lib/agents/sales-01/research-schema.ts";
import { buildCrmSalesIngestionExport } from "../../lib/agents/sales-01/crm-export.ts";
import { validateCrmSalesExport } from "../../lib/agents/crm-01/validation.ts";
import { buildCrmIngestionPlan } from "../../lib/agents/crm-01/planner.ts";
import { buildCrmMutationPlan, crmRecordPath } from "../../lib/agents/crm-01/mutation-planner.ts";
import { constructMutationPacket, validateMutationClientRequest } from "../../lib/agents/crm-01/mutation-validation.ts";
import { buildCrmRevenueSnapshot } from "../../lib/agents/crm-01/revenue-snapshot.ts";
import { projectCurrentSalesPlaybook } from "../../lib/agents/crm-01/sales-playbook-artifact.ts";
import { buildRevenueRecommendation } from "../../lib/agents/revenue-01/recommendation.ts";
import { buildApprovedActionPackage } from "../../lib/agents/revenue-01/approved-action.ts";
import { COMMERCIAL_GOAL_BODY, COMMERCIAL_GOAL_SHA256 } from "../../lib/agents/revenue-01/commercial-goals.ts";
import { createWorkforceRoutingPreview } from "../../lib/agents/workforce/handoff.ts";
import { assembleConversationIntelligencePacket, APPROVED_CLOSER_PACKET_CONTRACT_SHA256 } from "../../lib/agents/closer-01/conversation-intelligence.ts";
import { APPROVED_CLOSER_CONTRACT_SHA256 } from "../../lib/agents/closer-01/contract.ts";
import { buildFounderSimulationAuthority } from "../../lib/agents/closer-01/simulation-authority.ts";
import { InMemoryAtomicSimulationConsumptionCoordinator, createSharedInMemorySimulationReceiptStore } from "../../lib/agents/closer-01/simulation-consumption.ts";
import { DeterministicFixtureSimulationGenerator } from "../../lib/agents/closer-01/simulation-generator.ts";
import { executeFounderReviewedSimulation } from "../../lib/agents/closer-01/simulation.ts";
import { APPROVED_REVENUE_CONTRACT_SHA256 } from "../../lib/agents/revenue-01/contract.ts";
import { APPROVED_CRM_CONTRACT_SHA256 } from "../../lib/agents/crm-01/contract.ts";
import { APPROVED_SALES_PROVIDER_INTELLIGENCE_SHA256, SALES_PROVIDER_INTELLIGENCE_VERSION } from "../../lib/agents/sales-01/provider-intelligence-contract.ts";
import { GOSHSHHA_CAPABILITY_FACTS } from "../../lib/agents/sales-01/research-prompt.ts";
import { validateSalesIntake } from "../../lib/agents/sales-01/validation.ts";
import { canonicalJson } from "../../lib/agents/sales-01/canonical.ts";
import { buildGrowthCommercialOutcomeFeedback } from "../../lib/agents/growth-01/commercial-outcome-feedback.ts";

function envelope() { return validateSalesIntake({ input: { export: createSyntheticGrowthSalesExport(), candidateId: "buff-the-buff-ritual", founderApproval: { approved: true, scope: "sales_preparation_only" } }, approvedByUid: "founder", approvedAt: "2026-09-24T12:00:00.000Z", salesContract: syntheticSalesContractMetadata }).envelope; }
function request() { return { envelope: envelope(), founderAuthorization: { authorized: true, scope: "one_sales_research_run" }, budgetAuthority: { confirmedByFounder: true, salesMonthSpendUsd: 0, commercialDepartmentMonthSpendUsd: 0 } }; }
function proposal() { return {
  partial: false, limitations: [], salesPursuitDecision: "Pursue Now", salesPursuitRationale: "A small proof conversation is practical.",
  strategy: { observedTrigger: "The validated Growth trigger remains current.", specificProblem: "The shelf moment lacks the online product context.", goshshaWedge: "Bring the validated product story to the physical scan.", retailerIndependenceAssessment: "No retailer-controlled dependency is evidenced.", selectedEntryOffer: "Free First", offerRationale: "Use proof before the paid path.", physicalScanProofPoint: "Brand scans its own product and sees the experience.", paidConversionHypothesis: "$99 IRL Retail Media after proof.", desiredNextAction: "Seek a short exploratory conversation." },
  contacts: [{ id: "contact-1", name: "Aisha Joshi", currentTitle: "Founder", company: "Buff Beauty", identityEvidenceIds: ["sales-1"], currentRoleEvidenceIds: ["sales-1"], stakeholderFunction: "Brand leadership", problemOwnership: "direct", functionalRelevance: "The evidenced Brand leadership remit directly owns the identified product-story problem.", functionalRelevanceClassification: "sales_inference", confidence: "Confirmed", freshness: "current", conflictingEvidenceIds: [], strategicRoles: ["Best First Contact"], strategicRoleRationale: "Small-company accessibility and direct Brand context.", buyingAuthority: "unknown", buyingAuthorityEvidenceIds: [], contactRoute: { type: "public_professional_profile", value: "https://example.com/aisha", evidenceIds: ["sales-1"] }, evidenceIds: ["sales-1"] }],
  contactSelection: { status: "recommended", bestFirstContactId: "contact-1", unavailableReason: null, smallestSufficientSetRationale: "One evidenced contact is sufficient for this Founder-stage conversation." },
  proofStrategy: "Start with the business problem and demonstrate the physical scan concept after interest.",
  claims: [{ id: "claim-1", statement: "Aisha Joshi is publicly associated with Buff Beauty.", classification: "verified_fact", evidenceRefs: [{ kind: "sales_evidence", id: "sales-1" }] }, { id: "claim-2", statement: "Free First is a $0 proof mechanism.", classification: "goshsha_capability", evidenceRefs: [{ kind: "goshsha_capability", id: "cap-free-first" }] }],
  inheritedUnknowns: [{ originalText: "Brand interest and content rights remain unknown until verified.", status: "unresolved", resolution: null, salesEvidenceIds: [] }],
  rights: { status: "unknown", evidenceIds: [], conditionalRequirement: "The Brand must later supply or confirm Brand-owned or properly licensed content." },
  retailerIndependence: { posture: "retailer_independent", description: "No evidence-supported retailer dependency exists.", evidenceIds: [] },
  objections: [{ objection: "What is required?", response: "One product and properly licensed video are required for the proof.", claimIds: ["claim-2"], escalate: false }],
  outreach: { recommendedChannel: "Public professional profile", objective: "Start a qualified conversation.", initialMessage: "Would you be open to seeing a product-level scan proof?", firstFollowUp: "I can show the physical scan proof point.", secondFollowUp: "Happy to share a concise example if useful.", closeTheLoop: null, claimIds: ["claim-2"] },
  evidence: [{ id: "sales-1", publisher: "Public professional page", sourceUrl: "https://example.com/aisha?utm_source=test", supportedClaim: "Aisha Joshi is publicly associated with Buff Beauty.", classification: "verified_fact" }],
}; }
function response(value = proposal()) { return { id: "resp_sales", model: "gpt-5.6-terra", status: "completed", output: [{ type: "web_search_call", action: { sources: [{ url: "https://example.com/aisha?utm_source=test", title: "Aisha" }] } }, { type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }], usage: { input_tokens: 100, input_tokens_details: { cached_tokens: 10 }, output_tokens: 50, output_tokens_details: { reasoning_tokens: 5 }, total_tokens: 150 } }; }
function normalize(value = proposal()) { return normalizeCompletedOpenAISalesResponse({ response: response(value), request: request(), requestedModel: "gpt-5.6-terra", serverReceivedAt: "2026-09-24T12:30:00.000Z" }); }

test("exact historical handoff reaches SALES normalization without changing its score or rights deduction", async () => {
  const growthExport = JSON.parse(await readFile(new URL("./fixtures/cymbiotika-growth-v1-handoff.json", import.meta.url), "utf8"));
  const browserPayload = JSON.parse(JSON.stringify({ export: growthExport, candidateId: "G01-20261013-CYMBIOTIKA-WHOLEFOODS", founderApproval: { approved: true, scope: "sales_preparation_only" } }));
  const intake = validateSalesIntake({ input: browserPayload, approvedByUid: "founder", approvedAt: "2026-10-15T12:00:00.000Z", salesContract: syntheticSalesContractMetadata });
  assert.equal(intake.status, "valid");
  assert.equal(intake.envelope.schemaVersion, "growth-sales-handoff-v1.1");
  const historicalRequest = { envelope: intake.envelope, founderAuthorization: { authorized: true, scope: "one_sales_research_run" }, budgetAuthority: { confirmedByFounder: true, salesMonthSpendUsd: 2.14, commercialDepartmentMonthSpendUsd: 2.14 } };
  const value = proposal();
  value.inheritedUnknowns = intake.envelope.evidence.knownUnknowns.map((originalText) => ({ originalText, status: "unresolved", resolution: null, salesEvidenceIds: [] }));
  const normalized = normalizeCompletedOpenAISalesResponse({ response: response(value), request: historicalRequest, requestedModel: "gpt-5.6-terra", serverReceivedAt: "2026-10-15T12:30:00.000Z" });
  assert.equal(normalized.playbook.growthQualification.score, 81);
  assert.equal(intake.envelope.qualification.deductions.unresolvedRightsAssumption, 10);
  assert.equal(normalized.playbook.rights.status, "unknown");
  assert.deepEqual(normalized.playbook.growthQualification.candidateSha256, intake.envelope.candidate.candidateSha256);
  const result = { outcome: "accepted", envelope: intake.envelope, providerProfile: { timeoutMs: 150_000, maximumWebSearchCalls: 6, maximumContacts: 6, maximumContactsPerRole: 2, maximumSources: 30, maximumOutputTokens: 12_000 }, contract: syntheticSalesContractMetadata, providerProjection: { version: SALES_PROVIDER_INTELLIGENCE_VERSION, sha256: APPROVED_SALES_PROVIDER_INTELLIGENCE_SHA256 }, spendingAuthority: historicalRequest.budgetAuthority, proposal: normalized };
  const crmExport = buildCrmSalesIngestionExport(result);
  assert.equal(validateCrmSalesExport(crmExport), crmExport);
  assert.deepEqual(crmExport.source.phase1AEnvelope.source.compatibility, intake.envelope.source.compatibility);

  const legacyEnvelope = structuredClone(intake.envelope);
  legacyEnvelope.schemaVersion = "growth-sales-handoff-v1";
  delete legacyEnvelope.source.compatibility;
  legacyEnvelope.envelope.payloadSha256 = "";
  legacyEnvelope.envelope.payloadSha256 = createHash("sha256").update(canonicalJson(legacyEnvelope)).digest("hex");
  const legacyCrmExport = buildCrmSalesIngestionExport({ ...result, envelope: legacyEnvelope });
  assert.equal(validateCrmSalesExport(legacyCrmExport), legacyCrmExport);
  assert.equal(legacyCrmExport.source.phase1AEnvelope.schemaVersion, "growth-sales-handoff-v1");
  assert.ok(validateSalesResearchRequest({ ...historicalRequest, envelope: legacyEnvelope }).some((error) => error.includes("legacy v1 envelopes are read-only")));
});

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

function completeSyntheticCymbiotikaProposal(cymRequest = syntheticCymbiotikaRequest()) {
  const value = proposal();
  const sourceUrl = "https://example.com/synthetic-cymbiotika-retail-role?utm_source=fixture";
  value.strategy = {
    ...value.strategy,
    observedTrigger: "Synthetic fixture: a current physical-retail expansion.",
    selectedEntryOffer: "Free First",
    offerRationale: "Use the $0 proof mechanism before any conditional paid path.",
    paidConversionHypothesis: "A paid offer remains conditional on proof and a later commercial decision.",
  };
  value.contacts = [{
    id: "synthetic-contact-1", name: "Synthetic Retail Marketing Contact", currentTitle: "Director of Retail Marketing", company: "Cymbiotika",
    identityEvidenceIds: ["SLS-E1"], currentRoleEvidenceIds: ["SLS-E1"], stakeholderFunction: "Retail marketing", problemOwnership: "direct",
    functionalRelevance: "The evidenced current role owns retailer-specific marketing programs; buying authority remains unknown.", functionalRelevanceClassification: "sales_inference",
    confidence: "Confirmed", freshness: "current", conflictingEvidenceIds: [], strategicRoles: ["Best First Contact"], strategicRoleRationale: "The evidenced remit is relevant to a retail proof conversation.",
    buyingAuthority: "unknown", buyingAuthorityEvidenceIds: [], contactRoute: { type: "public_professional_profile", value: "https://example.com/synthetic-cymbiotika-retail-role", evidenceIds: ["SLS-E1"] }, evidenceIds: ["SLS-E1"],
  }];
  value.contactSelection = { status: "recommended", bestFirstContactId: "synthetic-contact-1", unavailableReason: null, smallestSufficientSetRationale: "One current, publicly evidenced role is sufficient for an initial Founder-reviewed approach." };
  value.evidence = [{ id: "SLS-E1", publisher: "Explicitly synthetic professional profile", sourceUrl, supportedClaim: "Synthetic fixture: the current role owns retailer-specific marketing programs.", classification: "verified_fact" }];
  value.inheritedUnknowns = cymRequest.envelope.evidence.knownUnknowns.map((originalText) => ({ originalText, status: "unresolved", resolution: null, salesEvidenceIds: [] }));
  const rightsUnknown = value.inheritedUnknowns[0].originalText;
  const rightsInner = rightsUnknown.replace(/^Whether\s+/, "").replace(/[.!?]+$/, "");
  value.claims = [
    { id: "CLM-JOB", statement: "The current role owns retailer-specific marketing programs and shopper engagement initiatives.", classification: "verified_fact", evidenceRefs: [{ kind: "sales_evidence", id: "SLS-E1" }] },
    { id: "CLM-GROWTH", statement: "Synthetic fixture: Cymbiotika has a physical-retail trigger.", classification: "verified_fact", evidenceRefs: [{ kind: "growth_evidence", id: "CYM-E1" }] },
    { id: "CLM-FREE", statement: GOSHSHHA_CAPABILITY_FACTS["cap-free-first"], classification: "goshsha_capability", evidenceRefs: [{ kind: "goshsha_capability", id: "cap-free-first" }] },
    { id: "CLM-CONDITION", statement: "The Brand must later supply or confirm Brand-owned or properly licensed content.", classification: "goshsha_capability", evidenceRefs: [{ kind: "goshsha_capability", id: "cap-free-first" }] },
    { id: "CLM-RIGHTS", statement: `Whether ${rightsInner} is unknown.`, classification: "unknown", evidenceRefs: [] },
    { id: "CLM-NO-PROMISE", statement: "A Free First proof does not establish or guarantee reach, conversion, sales lift, or ROI.", classification: "hypothesis", evidenceRefs: [{ kind: "goshsha_capability", id: "cap-free-first" }] },
  ];
  value.rights = { status: "unknown", evidenceIds: [], conditionalRequirement: "The Brand must later supply or confirm Brand-owned or properly licensed content." };
  value.outreach = { ...value.outreach, initialMessage: "Would you be open to reviewing one $0 product-level proof? It does not guarantee reach, conversion, sales lift, or ROI.", claimIds: ["CLM-JOB", "CLM-GROWTH", "CLM-FREE", "CLM-NO-PROMISE"] };
  value.objections = [{ objection: "Can you use our existing Creator video?", response: "Content rights remain unknown. The Brand must later supply or confirm Brand-owned or properly licensed content.", claimIds: ["CLM-CONDITION", "CLM-RIGHTS"], escalate: true }];
  return value;
}

function completeSyntheticCymbiotikaResponse(value, { includeActionSource = true, includeAnnotation = true } = {}) {
  const source = { url: "https://example.com/synthetic-cymbiotika-retail-role?utm_source=fixture", title: "Explicitly synthetic professional profile" };
  return {
    id: "resp_synthetic_cymbiotika", model: "gpt-5.6-terra", status: "completed",
    output: [
      ...(includeActionSource ? [{ type: "web_search_call", action: { sources: [source] } }] : []),
      { type: "message", content: [{ type: "output_text", text: JSON.stringify(value), ...(includeAnnotation ? { annotations: [{ type: "url_citation", ...source }] } : {}) }] },
    ],
    usage: { input_tokens: 400, input_tokens_details: { cached_tokens: 40 }, output_tokens: 300, output_tokens_details: { reasoning_tokens: 30 }, total_tokens: 700 },
  };
}

function normalizeCompleteSyntheticCymbiotika(value, cymRequest, responseOptions) {
  return normalizeCompletedOpenAISalesResponse({ response: completeSyntheticCymbiotikaResponse(value, responseOptions), request: cymRequest, requestedModel: "gpt-5.6-terra", serverReceivedAt: "2026-10-14T10:00:00.000Z" });
}

test("valid provider output becomes a nonpersistent, non-sending playbook and CRM preview", () => {
  const result = normalize();
  assert.equal(result.playbook.schemaVersion, "sales-playbook-v1.2"); assert.equal(result.playbook.growthQualification.score, 81); assert.equal(result.playbook.growthQualification.band, "Immediate Priority");
  assert.equal(result.playbook.readiness.businessDevelopment, "ready"); assert.equal(result.playbook.readiness.fulfillment, "requirements_unresolved");
  assert.equal(result.playbook.outreach.sendingAuthorized, false); assert.equal(result.playbook.crmReadyPacket.schemaVersion, "sales-crm-ready-v1"); assert.equal(result.playbook.crmReadyPacket.crmWriteAuthorized, false); assert.equal(result.playbook.authority.persistence, false);
  assert.doesNotMatch([result.playbook.outreach.initialMessage, result.playbook.outreach.firstFollowUp, result.playbook.outreach.secondFollowUp, result.playbook.outreach.closeTheLoop].filter(Boolean).join(" "), /rights?|licens|clearance|select(?:ed)? content/i);
  assert.equal(result.playbook.opportunityStrategy.offerFacts.irlRetailMedia, "$99 / one product / one video / 90 days / first 1,000 qualified views");
  assert.equal(result.playbook.evidence[0].canonicalUrl, "https://example.com/aisha"); assert.equal(result.playbook.evidence[0].rawUrl, "https://example.com/aisha?utm_source=test");
  assert.equal(result.playbook.positioningFoundation.schemaVersion, "goshsha-commercial-positioning-v1");
  assert.equal(result.playbook.positioningFoundation.audienceObjection.objection, "How many users does Goshsha have?");
  assert.equal(result.playbook.objections[0].objection, "How many users does Goshsha have?");
});

test("complete explicitly synthetic Cymbiotika-shaped proposal passes with unknown rights and buying authority", () => {
  const cymRequest = syntheticCymbiotikaRequest();
  const value = completeSyntheticCymbiotikaProposal(cymRequest);
  const result = normalizeCompleteSyntheticCymbiotika(value, cymRequest);
  assert.equal(result.playbook.growthQualification.brand, "Cymbiotika");
  assert.equal(result.playbook.rights.status, "unknown");
  assert.deepEqual(result.playbook.rights.evidenceIds, []);
  assert.equal(result.playbook.contacts[0].buyingAuthority, "unknown");
  assert.equal(result.playbook.inheritedUnknowns.every((item) => item.status === "unresolved"), true);
  assert.equal(result.playbook.evidence[0].canonicalUrl, "https://example.com/synthetic-cymbiotika-retail-role");
  assert.equal(result.playbook.evidence[0].rawUrl, "https://example.com/synthetic-cymbiotika-retail-role?utm_source=fixture");
  assert.equal(result.playbook.outreach.sendingAuthorized, false);
  assert.equal(result.playbook.crmReadyPacket.crmWriteAuthorized, false);
  assert.equal(result.playbook.authority.persistence, false);
});

test("business-development output needs no provider-authored rights, asset, or activation checklist", () => {
  const value = proposal();
  delete value.rights;
  delete value.inheritedUnknowns;
  value.strategy.offerRationale = "Start with a simple product-level conversation and discuss the catalog offer if the Brand is interested.";
  value.outreach.initialMessage = "Your retail expansion creates a useful product-education moment. Would you be open to a short conversation about a simple Goshsha proof?";
  value.outreach.firstFollowUp = "Happy to share the practical approach and current offer options if this is relevant.";
  value.outreach.secondFollowUp = "If another teammate owns shopper education, a referral would help.";
  const result = normalize(value);
  assert.equal(result.playbook.readiness.businessDevelopment, "ready");
  assert.equal(result.playbook.readiness.fulfillment, "requirements_unresolved");
  assert.equal(result.playbook.rights.status, "unknown");
  assert.deepEqual(result.playbook.rights.evidenceIds, []);
  assert.equal(result.playbook.authority.sendingAuthorized, false);
  assert.match(result.playbook.outreach.initialMessage, /short conversation/);
});

test("one generated-output chain reaches one Founder-reviewed unsent opening without rights or prior correspondence", async () => {
  const salesRequest = syntheticCymbiotikaRequest();
  const generatedSales = normalizeCompleteSyntheticCymbiotika(completeSyntheticCymbiotikaProposal(salesRequest), salesRequest);
  const salesResult = { outcome:"accepted", envelope:salesRequest.envelope, contract:syntheticSalesContractMetadata, providerProjection:{version:SALES_PROVIDER_INTELLIGENCE_VERSION,sha256:APPROVED_SALES_PROVIDER_INTELLIGENCE_SHA256,pairedSalesContractVersion:"V1.4",pairedSalesContractSha256:syntheticSalesContractMetadata.sha256}, proposal:generatedSales, spendingAuthority:{}, providerProfile:{} };
  const crmExport = buildCrmSalesIngestionExport(salesResult);
  const crmPlan = buildCrmIngestionPlan({artifact:crmExport,snapshot:{records:{},identityKeys:{},possibleAccountMatches:[],possibleContactMatches:[],completedReceipt:null},crmContractSha256:APPROVED_CRM_CONTRACT_SHA256,at:"2026-10-14T10:01:00.000Z"});
  const account=crmPlan.creates.find(x=>x.entityType==="account").record, pursuit=crmPlan.creates.find(x=>x.entityType==="salesPursuit").record, contact=crmPlan.creates.find(x=>x.entityType==="contact").record;
  account.data.dnc={status:"inactive"};account.data.dncEvaluation="allowed";contact.data.dnc={status:"inactive"};contact.data.dncEvaluation="allowed";
  const baseRecords=crmPlan.creates.filter(x=>x.entityType!=="interaction").map(x=>x.record),recordMap=Object.fromEntries(baseRecords.map(record=>[crmRecordPath(record.entityType,record.id),record]));
  const initRequest=validateMutationClientRequest({idempotencyKey:"synthetic_initial_outreach_conversation",expectedRevisions:{[crmRecordPath("account",account.id)]:account.revision,[crmRecordPath("salesPursuit",pursuit.id)]:pursuit.revision,[crmRecordPath("contact",contact.id)]:contact.revision},mutation:{kind:"initialize_conversation",accountId:account.id,pursuitId:pursuit.id,participants:[{type:"crm_contact",id:contact.id},{type:"goshsha_internal",id:"goshsha_founder"}],channelContext:"email",evidence:[{id:"founder_participant_selection",classification:"founder_provided_information",source:"Synthetic Founder fixture",statement:"The Founder selected this exact current Contact for initial outreach preparation.",observedAt:"2026-10-14T10:02:00.000Z",evidenceUrl:null}]}});
  const initPacket=constructMutationPacket(initRequest,"founder","2026-10-14T10:02:00.000Z"),initPlan=buildCrmMutationPlan({packet:initPacket,records:recordMap,crmContractSha256:APPROVED_CRM_CONTRACT_SHA256}),initializedPursuit=initPlan.operations[0].after,conversation=initializedPursuit.data.canonicalConversation;
  const records=baseRecords.map(record=>record.id===pursuit.id?initializedPursuit:record);
  const crmSnapshot=buildCrmRevenueSnapshot({accountId:account.id,pursuitId:pursuit.id,records,truncatedCollections:[],generatedAt:"2026-10-14T10:03:00.000Z",generatedByUid:"founder",crmContractVersion:"V1.1",crmContractSha256:APPROVED_CRM_CONTRACT_SHA256}).snapshot;
  assert.equal(crmSnapshot.interactions.length,0);assert.equal(crmSnapshot.pursuit.rightsState.status,"unknown");
  const recommendation=buildRevenueRecommendation({snapshot:crmSnapshot,runContext:{reportingMonth:"2026-10",founderSuppliedCollectedBaseline:null,baselineEvidenceClassification:"unknown"},revenueContract:{version:"V1.2",sha256:APPROVED_REVENUE_CONTRACT_SHA256},commercialGoal:{goalId:COMMERCIAL_GOAL_BODY.goalId,version:COMMERCIAL_GOAL_BODY.version,sha256:COMMERCIAL_GOAL_SHA256},generatedAt:"2026-10-14T10:04:00.000Z"});
  assert.equal(recommendation.recommendation.family,"establish_qualified_engagement");
  const approvedPackage=buildApprovedActionPackage({recommendation,selectedFamily:recommendation.recommendation.family,displayedRecommendationId:recommendation.identity.recommendationId,expectedRevisionSetSha256:recommendation.binding.crmRevisionSetSha256,approvedByUid:"founder",approvedAt:"2026-10-14T10:05:00.000Z"});
  const routing=createWorkforceRoutingPreview({package:approvedPackage,currentBinding:{accountId:account.id,pursuitId:pursuit.id,crmRevisionSetSha256:crmSnapshot.revisionBinding.revisionSetSha256},createdAt:"2026-10-14T10:05:30.000Z"});
  const artifact=crmPlan.infrastructureOperations.find(x=>x.kind==="create_immutable_artifact").value,reference=crmPlan.infrastructureOperations.find(x=>x.kind==="set_current_reference").value,playbook=projectCurrentSalesPlaybook({artifact,reference,accountId:account.id,pursuitId:pursuit.id});
  const packet=assembleConversationIntelligencePacket({generatedAt:"2026-10-14T10:06:00.000Z",accountId:account.id,pursuitId:pursuit.id,closerContract:{version:"V1",sha256:APPROVED_CLOSER_CONTRACT_SHA256},growthContract:{version:"V1.1",sha256:salesRequest.envelope.source.growthContract.sha256},salesContract:{version:"V1.4",sha256:syntheticSalesContractMetadata.sha256},crmContract:{version:"V1.1",sha256:APPROVED_CRM_CONTRACT_SHA256},revenueContract:{version:"V1.2",sha256:APPROVED_REVENUE_CONTRACT_SHA256},growth:{sourceEnvelopeId:salesRequest.envelope.envelope.id,sourceEnvelopeSha256:salesRequest.envelope.envelope.payloadSha256,candidateSha256:salesRequest.envelope.candidate.candidateSha256,sourceVersion:salesRequest.envelope.schemaVersion,score:salesRequest.envelope.qualification.score,band:salesRequest.envelope.qualification.band,confidence:salesRequest.envelope.qualification.confidence,feasibility:salesRequest.envelope.qualification.founderStagePursuitFeasibility,brand:salesRequest.envelope.opportunity.brand,productOrEvent:salesRequest.envelope.opportunity.productOrEvent,wedge:salesRequest.envelope.opportunity.goshshaWedge,retailerIndependence:salesRequest.envelope.opportunity.retailerAssessment,unknowns:salesRequest.envelope.evidence.knownUnknowns},sales:{artifactSha256:artifact.artifactSha256,playbookId:artifact.artifactId,playbookVersion:artifact.playbookSchemaVersion,playbookSuperseded:false,pursuitDecision:playbook.pursuitDecision,contacts:[{contactId:contact.id,title:contact.data.currentTitle,strategicRoles:contact.data.strategicRoles,classification:"sales_inference",buyingAuthority:contact.data.buyingAuthority,freshness:contact.data.freshness,conflicts:[]}],bestFirstContactId:contact.id,positioning:playbook.positioning,approvedClaims:playbook.approvedClaims,platformClaims:playbook.platformClaims,positioningArtifact:playbook.positioningArtifact,mechanicsQualifications:playbook.mechanicsQualifications,audienceObjection:playbook.audienceObjection,prohibitedClaims:playbook.prohibitedClaims,offerContext:playbook.offerContext,objections:playbook.objections,escalationBoundaries:playbook.escalationBoundaries},crm:{revisionSetSha256:crmSnapshot.revisionBinding.revisionSetSha256,conversationThreadId:conversation.conversationId,participants:[{contactId:contact.id,title:contact.data.currentTitle}],interactions:[],dnc:crmSnapshot.relationshipSafety,stage:crmSnapshot.pursuit.stage,rightsState:crmSnapshot.pursuit.rightsState,selectedEntryOfferId:crmSnapshot.pursuit.selectedEntryOfferId,offerCatalog:crmSnapshot.offerCatalog,milestones:crmSnapshot.commercialEvidence.milestones,nextAction:crmSnapshot.nextAction,freshness:{...crmSnapshot.freshness,unknownFreshnessFields:[],staleFields:[]}},revenue:{approvedPackage,routingPreview:routing,priority:recommendation.economics.priority,timing:recommendation.economics.timing,proofState:recommendation.observedState.proofState},authority:{authorityId:"packet-authority",version:"v1",scope:"tier0_packet_readiness",approvedByUid:"founder",effectiveAt:"2026-10-14T10:05:00.000Z",expiresAt:"2026-10-14T10:20:00.000Z",permitted:["validate","assemble","inspect","preview_readiness"],prohibited:["external_messaging","sending","scheduling","crm_mutation","provider_invocation","payment_action","production_mutation","objective_activation","autonomous_downstream_invocation","durable_assignment_acceptance","closer_simulation"],recipientContactId:contact.id,channel:"email",threadId:conversation.conversationId,executionAuthorized:false,closerInvoked:false,persisted:false}});
  assert.equal(packet.readiness,"ready_to_simulate");assert.equal(packet.packetContractSha256,APPROVED_CLOSER_PACKET_CONTRACT_SHA256);
  const authority=buildFounderSimulationAuthority({packet,snapshot:crmSnapshot,detail:{account:{dnc:{evaluation:"allowed"}},contacts:[{id:contact.id,accountId:account.id,freshness:"current",conflictingEvidenceIds:[],warnings:[],dnc:{scope:"contact",evaluation:"allowed"}}]},playbook,approvedPackage,recipientContactId:contact.id,simulationChannelContext:"email",simulationAction:"simulate_objective_aligned_outbound_turn",approvedByUid:"founder",approvedAt:"2026-10-14T10:06:30.000Z"});
  const output=await executeFounderReviewedSimulation({authority,currentPacket:packet,now:"2026-10-14T10:07:00.000Z",explicitSimulationRequest:true,coordinator:new InMemoryAtomicSimulationConsumptionCoordinator(createSharedInMemorySimulationReceiptStore(),()=>"2026-10-14T10:07:00.000Z"),generator:new DeterministicFixtureSimulationGenerator()});
  assert.equal(authority.binding.latestInteraction.state,"no_prior_interaction");assert.equal(output.status,"SIMULATED_FOR_FOUNDER_REVIEW");assert.equal(output.safety.sent,false);assert.equal(output.safety.externalAction,false);assert.doesNotMatch(output.pair.message,/rights?|licens|permission|select(?:ed)? content/i);

  const initializedRecords=Object.fromEntries(baseRecords.map(record=>[crmRecordPath(record.entityType,record.id),record.id===pursuit.id?initializedPursuit:record]));
  const replyRequest=validateMutationClientRequest({idempotencyKey:"synthetic_attributed_reply",expectedRevisions:{[crmRecordPath("account",account.id)]:account.revision,[crmRecordPath("salesPursuit",pursuit.id)]:initializedPursuit.revision,[crmRecordPath("contact",contact.id)]:contact.revision},mutation:{kind:"record_interaction",accountId:account.id,pursuitId:pursuit.id,contactId:contact.id,interactionType:"inbound_received",exactStatement:"We are interested in discussing the paid option for one retail product.",summary:"Synthetic attributed paid-interest reply.",occurredAt:"2026-10-14T10:08:00.000Z",evidenceAuthenticity:"synthetic",conversation:{participants:[{type:"crm_contact",id:contact.id},{type:"goshsha_internal",id:"goshsha_founder"}],senderParticipantKey:`crm_contact:${contact.id}`,recipientParticipantKeys:["goshsha_internal:goshsha_founder"],channel:"email",replyToInteractionId:null,providerReference:null,evidenceIds:["synthetic_reply"]},evidence:[{id:"synthetic_reply",classification:"future_brand_statement",source:"Explicit synthetic reply fixture",statement:"We are interested in discussing the paid option for one retail product.",observedAt:"2026-10-14T10:08:00.000Z",evidenceUrl:null}]}});
  const replyPacket=constructMutationPacket(replyRequest,"founder","2026-10-14T10:08:30.000Z"),replyPlan=buildCrmMutationPlan({packet:replyPacket,records:initializedRecords,crmContractSha256:APPROVED_CRM_CONTRACT_SHA256});
  const afterReply={...initializedRecords};for(const operation of replyPlan.operations){if(operation.after)afterReply[operation.path]=operation.after;}
  const replySnapshot=buildCrmRevenueSnapshot({accountId:account.id,pursuitId:pursuit.id,records:Object.values(afterReply),truncatedCollections:[],generatedAt:"2026-10-14T10:09:00.000Z",generatedByUid:"founder",crmContractVersion:"V1.1",crmContractSha256:APPROVED_CRM_CONTRACT_SHA256}).snapshot;
  assert.equal(replySnapshot.interactions.at(-1).exactAttributedStatement,"We are interested in discussing the paid option for one retail product.");
  const revisedRecommendation=buildRevenueRecommendation({snapshot:replySnapshot,runContext:{reportingMonth:"2026-10",founderSuppliedCollectedBaseline:null,baselineEvidenceClassification:"unknown"},revenueContract:{version:"V1.2",sha256:APPROVED_REVENUE_CONTRACT_SHA256},commercialGoal:{goalId:COMMERCIAL_GOAL_BODY.goalId,version:COMMERCIAL_GOAL_BODY.version,sha256:COMMERCIAL_GOAL_SHA256},generatedAt:"2026-10-14T10:10:00.000Z"});
  const feedback=buildGrowthCommercialOutcomeFeedback({accountId:account.id,pursuitId:pursuit.id,growthCandidateSha256:salesRequest.envelope.candidate.candidateSha256,crmRevisionSetSha256:replySnapshot.revisionBinding.revisionSetSha256,interactions:replySnapshot.interactions,salesPlaybookArtifactId:artifact.artifactId,salesPlaybookArtifactSha256:artifact.artifactSha256,revenueRecommendationId:revisedRecommendation.identity.recommendationId,revenueRecommendationFamily:revisedRecommendation.recommendation.family,generatedAt:"2026-10-14T10:10:30.000Z"});
  assert.equal(feedback.attributedOutcomes.at(-1).exactAttributedStatement,"We are interested in discussing the paid option for one retail product.");assert.equal(feedback.authority.growthRunAuthorized,false);assert.equal(feedback.authority.externalActionAuthorized,false);
  const revisedPackage=buildApprovedActionPackage({recommendation:revisedRecommendation,selectedFamily:revisedRecommendation.recommendation.family,displayedRecommendationId:revisedRecommendation.identity.recommendationId,expectedRevisionSetSha256:revisedRecommendation.binding.crmRevisionSetSha256,approvedByUid:"founder",approvedAt:"2026-10-14T10:11:00.000Z"}),revisedRouting=createWorkforceRoutingPreview({package:revisedPackage,currentBinding:{accountId:account.id,pursuitId:pursuit.id,crmRevisionSetSha256:replySnapshot.revisionBinding.revisionSetSha256},createdAt:"2026-10-14T10:11:10.000Z"});
  const refreshedConversation=afterReply[crmRecordPath("salesPursuit",pursuit.id)].data.canonicalConversation;
  const refreshedPacket=assembleConversationIntelligencePacket({generatedAt:"2026-10-14T10:11:30.000Z",accountId:account.id,pursuitId:pursuit.id,closerContract:packet.sourceContracts.closer,growthContract:packet.sourceContracts.growth,salesContract:packet.sourceContracts.sales,crmContract:packet.sourceContracts.crm,revenueContract:packet.sourceContracts.revenue,growth:packet.growth,sales:packet.sales,crm:{revisionSetSha256:replySnapshot.revisionBinding.revisionSetSha256,conversationThreadId:refreshedConversation.conversationId,participants:[{contactId:contact.id,title:contact.data.currentTitle}],interactions:replySnapshot.interactions,dnc:replySnapshot.relationshipSafety,stage:replySnapshot.pursuit.stage,rightsState:replySnapshot.pursuit.rightsState,selectedEntryOfferId:replySnapshot.pursuit.selectedEntryOfferId,offerCatalog:replySnapshot.offerCatalog,milestones:replySnapshot.commercialEvidence.milestones,nextAction:replySnapshot.nextAction,freshness:{...replySnapshot.freshness,unknownFreshnessFields:[],staleFields:[]}},revenue:{approvedPackage:revisedPackage,routingPreview:revisedRouting,priority:revisedRecommendation.economics.priority,timing:revisedRecommendation.economics.timing,proofState:revisedRecommendation.observedState.proofState},authority:{authorityId:"refreshed-packet-authority",version:"v1",scope:"tier0_packet_readiness",approvedByUid:"founder",effectiveAt:"2026-10-14T10:11:00.000Z",expiresAt:"2026-10-14T10:26:00.000Z",permitted:["validate","assemble","inspect","preview_readiness"],prohibited:["external_messaging","sending","scheduling","crm_mutation","provider_invocation","payment_action","production_mutation","objective_activation","autonomous_downstream_invocation","durable_assignment_acceptance","closer_simulation"],recipientContactId:contact.id,channel:"email",threadId:refreshedConversation.conversationId,executionAuthorized:false,closerInvoked:false,persisted:false}});
  const refreshedAuthority=buildFounderSimulationAuthority({packet:refreshedPacket,snapshot:replySnapshot,detail:{account:{dnc:{evaluation:"allowed"}},contacts:[{id:contact.id,accountId:account.id,freshness:"current",conflictingEvidenceIds:[],warnings:[],dnc:{scope:"contact",evaluation:"allowed"}}]},playbook,approvedPackage:revisedPackage,recipientContactId:contact.id,simulationChannelContext:"email",simulationAction:"simulate_response_to_latest_inbound",approvedByUid:"founder",approvedAt:"2026-10-14T10:12:00.000Z"});
  const responseDraft=await executeFounderReviewedSimulation({authority:refreshedAuthority,currentPacket:refreshedPacket,now:"2026-10-14T10:12:30.000Z",explicitSimulationRequest:true,coordinator:new InMemoryAtomicSimulationConsumptionCoordinator(createSharedInMemorySimulationReceiptStore(),()=>"2026-10-14T10:12:30.000Z"),generator:new DeterministicFixtureSimulationGenerator()});
  assert.equal(responseDraft.status,"SIMULATED_FOR_FOUNDER_REVIEW");assert.equal(responseDraft.observationPreview.exactAttributedEvidence.statement,"We are interested in discussing the paid option for one retail product.");assert.equal(responseDraft.safety.sent,false);assert.notEqual(refreshedPacket.packetSha256,packet.packetSha256);assert.notEqual(revisedRecommendation.identity.recommendationId,recommendation.identity.recommendationId);
});

// Superseded phrase/rights gates were removed; active structural and authority coverage follows.
test("exact inherited rights unknown accepts only narrow epistemic wrappers with unchanged inner text", () => {
  const cymRequest = syntheticCymbiotikaRequest();
  const original = cymRequest.envelope.evidence.knownUnknowns[0];
  const inner = original.replace(/^Whether\s+/, "").replace(/[.!?]+$/, "");
  const acceptedStatements = [
    original,
    `Whether ${inner} is unknown.`,
    `Whether ${inner} remains unknown.`,
    `Whether ${inner} is unresolved.`,
    `Whether ${inner} remains unresolved.`,
    `It is unknown whether ${inner}.`,
    `It remains unknown whether ${inner}.`,
    `It is not known whether ${inner}.`,
  ];
  for (const statement of acceptedStatements) {
    const value = proposal();
    value.inheritedUnknowns = cymRequest.envelope.evidence.knownUnknowns.map((originalText) => ({ originalText, status: "unresolved", resolution: null, salesEvidenceIds: [] }));
    value.claims.push({ id: "rights-epistemic-wrapper", statement, classification: "unknown", evidenceRefs: [] });
    const result = normalizeCompletedOpenAISalesResponse({ response: response(value), request: cymRequest, requestedModel: "gpt-5.6-terra", serverReceivedAt: "2026-10-14T09:00:00.000Z" });
    assert.equal(result.playbook.claims.at(-1).statement, statement);
    assert.equal(result.playbook.rights.status, "unknown");
    assert.deepEqual(result.playbook.rights.evidenceIds, []);
    assert.equal(result.playbook.inheritedUnknowns[0].status, "unresolved");
  }
});

// Superseded phrase/rights gates were removed; active structural and authority coverage follows.
test("Phase 1B requires separate authorization and a current intact Phase 1A envelope", () => {
  assert.deepEqual(validateSalesResearchRequest(request()), []);
  const missing = request(); missing.founderAuthorization.authorized = false; assert.ok(validateSalesResearchRequest(missing).length);
  const tampered = structuredClone(request()); tampered.envelope.qualification.score = 99; assert.ok(validateSalesResearchRequest(tampered).length);
});

// Superseded phrase/rights gates were removed; active structural and authority coverage follows.
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

// Superseded phrase/rights gates were removed; active structural and authority coverage follows.
test("complete synthetic Responses accept locally governed commercial boundaries across every generated prose family", () => {
  const cymRequest = syntheticCymbiotikaRequest();
  const value = completeSyntheticCymbiotikaProposal(cymRequest);
  value.limitations = ["The fixture does not guarantee reach, conversion, sales lift, or ROI."];
  value.salesPursuitRationale = "Use a proof mechanism rather than guaranteed audience delivery.";
  value.strategy.observedTrigger = "The observed trigger is a retail expansion, not a reach or conversion guarantee.";
  value.strategy.specificProblem = "The problem concerns product context rather than guaranteed sales lift.";
  value.strategy.goshshaWedge = "Position the proof as product context; it should not be represented as causal sales attribution or guaranteed conversion.";
  value.strategy.retailerIndependenceAssessment = "Retailer independence must not be represented as retailer endorsement or guaranteed audience delivery.";
  value.strategy.offerRationale = "Free First is a proof mechanism, not a reach, sales, or conversion guarantee.";
  value.strategy.physicalScanProofPoint = "Assess supported signals rather than guaranteed results.";
  value.strategy.paidConversionHypothesis = "A possible paid path does not establish or guarantee conversion, sales lift, or ROI.";
  value.strategy.desiredNextAction = "Request a conversation, not a discount or custom implementation.";
  value.contacts[0].functionalRelevance = "The evidenced remit supports a conversation rather than guaranteed buying authority or results.";
  value.contacts[0].strategicRoleRationale = "The role is relevant, but it should not be represented as guaranteed budget or conversion authority.";
  value.contactSelection.smallestSufficientSetRationale = "One contact is sufficient for discovery rather than a guarantee of conversion.";
  value.proofStrategy = "Frame the proof around supported product-scan and content-engagement signals, not shopper identity, retailer data, causal sales attribution, sales lift, conversion, ROI, or guaranteed audience delivery.";
  value.claims.push({ id: "CLM-BOUNDARY", statement: "The proof does not establish or guarantee reach, conversion, sales lift, or ROI.", classification: "hypothesis", evidenceRefs: [{ kind: "goshsha_capability", id: "cap-free-first" }] });
  value.retailerIndependence.description = "The posture should not be represented as retailer approval, guaranteed reach, or sales attribution.";
  value.objections = [
    { objection: "Will this guarantee ROI?", response: "No; it should not be represented as guaranteed conversion, sales lift, ROI, or audience delivery.", claimIds: ["CLM-BOUNDARY"], escalate: false },
  ];
  value.outreach.objective = "Request a proof discussion rather than promise sales lift.";
  value.outreach.initialMessage = "This would be a proof mechanism, not a reach, sales, or conversion guarantee.";
  value.outreach.firstFollowUp = "The proof should not be represented as guaranteed audience delivery.";
  value.outreach.secondFollowUp = "Included qualified views are an entitlement ceiling rather than guaranteed delivered audience.";
  value.outreach.closeTheLoop = "No discount, custom implementation, or guaranteed result is offered.";
  value.outreach.claimIds.push("CLM-BOUNDARY");

  const result = normalizeCompleteSyntheticCymbiotika(value, cymRequest);
  assert.equal(result.playbook.authority.externalAction, false);
  assert.equal(result.playbook.outreach.sendingAuthorized, false);
  assert.equal(result.playbook.crmReadyPacket.crmWriteAuthorized, false);
});

// Superseded phrase/rights gates were removed; active structural and authority coverage follows.
test("attributed source evidence stays under evidence-to-claim rules rather than recommendation-prose scanning", () => {
  const cymRequest = syntheticCymbiotikaRequest();
  const value = completeSyntheticCymbiotikaProposal(cymRequest);
  value.evidence[0].supportedClaim = "Synthetic source quotation: the employer seeks retail velocity and guarantees nothing about Goshsha.";
  const result = normalizeCompleteSyntheticCymbiotika(value, cymRequest);
  assert.match(result.playbook.evidence[0].supportedClaim, /Synthetic source quotation/);
  assert.equal(result.playbook.outreach.sendingAuthorized, false);
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

// Superseded phrase/rights gates were removed; active structural and authority coverage follows.
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

// Superseded phrase/rights gates were removed; active structural and authority coverage follows.
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

// Superseded phrase/rights gates were removed; active structural and authority coverage follows.
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
