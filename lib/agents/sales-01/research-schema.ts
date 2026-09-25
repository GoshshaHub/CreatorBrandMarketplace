import { canonicalizeResearchUrl } from "../growth-01/research-schema";
import { GOSHSHHA_CAPABILITY_FACTS } from "./research-prompt";
import type { SalesClaim, SalesContact, SalesProviderExecutionMetadata, SalesResearchProposal, SalesResearchRequest } from "./research-types";
import { verifySalesEnvelopeIntegrity } from "./validation";

export const MAX_SALES_RESEARCH_REQUEST_BYTES = 600_000;
export const MAX_SALES_CONTACTS = 6;
export const MAX_CONTACTS_PER_ROLE = 2;
export const MAX_SALES_RESEARCH_SOURCES = 30;
export const MAX_SALES_WEB_SEARCH_CALLS = 6;
export const MAX_SALES_PROVIDER_OUTPUT_TOKENS = 12_000;
export const SALES_PROVIDER_TIMEOUT_MS = 150_000;

export class SalesResearchError extends Error {
  code: string;
  httpStatus: number;
  providerExecution: SalesProviderExecutionMetadata | null;
  constructor(code: string, message: string, httpStatus = 502, execution: SalesProviderExecutionMetadata | null = null) {
    super(message); this.name = "SalesResearchError"; this.code = code; this.httpStatus = httpStatus; this.providerExecution = execution;
  }
}

const text = { type: "string" } as const;
const nullableText = { anyOf: [text, { type: "null" }] } as const;
const evidenceRefs = { type: "array", maxItems: 12, items: { type: "object", additionalProperties: false, required: ["kind", "id"], properties: { kind: { type: "string", enum: ["growth_evidence", "sales_evidence", "goshsha_capability"] }, id: text } } } as const;

export const OPENAI_SALES_INTELLIGENCE_JSON_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["partial", "limitations", "salesPursuitDecision", "salesPursuitRationale", "strategy", "contacts", "proofStrategy", "claims", "inheritedUnknowns", "rights", "retailerIndependence", "objections", "outreach", "evidence"],
  properties: {
    partial: { type: "boolean" }, limitations: { type: "array", maxItems: 20, items: text },
    salesPursuitDecision: { type: "string", enum: ["Pursue Now", "Nurture / Revisit", "Do Not Pursue"] }, salesPursuitRationale: text,
    strategy: { type: "object", additionalProperties: false, required: ["observedTrigger", "specificProblem", "goshshaWedge", "retailerIndependenceAssessment", "selectedEntryOffer", "offerRationale", "physicalScanProofPoint", "paidConversionHypothesis", "desiredNextAction"], properties: { observedTrigger: text, specificProblem: text, goshshaWedge: text, retailerIndependenceAssessment: text, selectedEntryOffer: { type: "string", enum: ["Free First", "IRL Retail Media", "Creator Network", "Combined"] }, offerRationale: text, physicalScanProofPoint: text, paidConversionHypothesis: text, desiredNextAction: text } },
    contacts: { type: "array", maxItems: MAX_SALES_CONTACTS, items: { type: "object", additionalProperties: false, required: ["id", "name", "currentTitle", "company", "strategicRoles", "strategicRoleRationale", "buyingAuthority", "buyingAuthorityEvidenceIds", "contactRoute", "evidenceIds"], properties: { id: text, name: text, currentTitle: text, company: text, strategicRoles: { type: "array", maxItems: 5, items: { type: "string", enum: ["Best First Contact", "Internal Champion", "Economic Buyer", "Executive Sponsor", "Operational Owner"] } }, strategicRoleRationale: text, buyingAuthority: { type: "string", enum: ["unknown", "supported"] }, buyingAuthorityEvidenceIds: { type: "array", maxItems: 6, items: text }, contactRoute: { type: "object", additionalProperties: false, required: ["type", "value", "evidenceIds"], properties: { type: { type: "string", enum: ["direct_public_business", "general_company", "public_professional_profile", "unknown"] }, value: nullableText, evidenceIds: { type: "array", maxItems: 6, items: text } } }, evidenceIds: { type: "array", maxItems: 8, items: text } } } },
    proofStrategy: text,
    claims: { type: "array", maxItems: 40, items: { type: "object", additionalProperties: false, required: ["id", "statement", "classification", "evidenceRefs"], properties: { id: text, statement: text, classification: { type: "string", enum: ["verified_fact", "attributed_brand_claim", "goshsha_capability", "reasonable_inference", "hypothesis", "unknown", "prohibited_unsupported"] }, evidenceRefs } } },
    inheritedUnknowns: { type: "array", maxItems: 30, items: { type: "object", additionalProperties: false, required: ["originalText", "status", "resolution", "salesEvidenceIds"], properties: { originalText: text, status: { type: "string", enum: ["unresolved", "resolved_by_sales_evidence"] }, resolution: nullableText, salesEvidenceIds: { type: "array", maxItems: 8, items: text } } } },
    rights: { type: "object", additionalProperties: false, required: ["status", "evidenceIds", "conditionalRequirement"], properties: { status: { type: "string", enum: ["unknown", "explicitly_supported", "not_applicable"] }, evidenceIds: { type: "array", maxItems: 8, items: text }, conditionalRequirement: text } },
    retailerIndependence: { type: "object", additionalProperties: false, required: ["posture", "description", "evidenceIds"], properties: { posture: { type: "string", enum: ["retailer_independent", "evidence_supported_dependency"] }, description: text, evidenceIds: { type: "array", maxItems: 8, items: text } } },
    objections: { type: "array", maxItems: 10, items: { type: "object", additionalProperties: false, required: ["objection", "response", "claimIds", "escalate"], properties: { objection: text, response: text, claimIds: { type: "array", maxItems: 12, items: text }, escalate: { type: "boolean" } } } },
    outreach: { type: "object", additionalProperties: false, required: ["recommendedChannel", "objective", "initialMessage", "firstFollowUp", "secondFollowUp", "closeTheLoop", "claimIds"], properties: { recommendedChannel: text, objective: text, initialMessage: text, firstFollowUp: text, secondFollowUp: text, closeTheLoop: nullableText, claimIds: { type: "array", maxItems: 30, items: text } } },
    evidence: { type: "array", maxItems: MAX_SALES_RESEARCH_SOURCES, items: { type: "object", additionalProperties: false, required: ["id", "publisher", "sourceUrl", "supportedClaim", "classification"], properties: { id: text, publisher: text, sourceUrl: text, supportedClaim: text, classification: { type: "string", enum: ["verified_fact", "attributed_brand_claim", "reasonable_inference", "hypothesis", "unknown"] } } } },
  },
} as const;

type RawProposal = any;
type NativeSource = { url?: unknown; title?: unknown; publication_date?: unknown; published_at?: unknown; page_age?: unknown };
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const currentUtcDate = () => new Date().toISOString().slice(0, 10);
const requiredText = (value: unknown, field: string) => { if (typeof value !== "string" || !value.trim()) throw new SalesResearchError("provider_output_invalid", `${field} must contain text.`, 422); return value.trim(); };
const REGULATED_OR_EFFICACY = /\b(?:medical|therapeutic|treat(?:s|ment)?|prevent(?:s|ion)?|disease|efficacy|effective|safety|safe|dosage|dose|ingredient[- ]interaction|fda approved|clinically proven)\b/i;
const RIGHTS_ASSERTION = /\b(?:owns?|controls?|has cleared|licensed|rights? to|can reuse)\b.*\b(?:content|video|creator|activation|reuse)\b/i;
const UNSUPPORTED_COMMERCIAL_PROMISE = /\b(?:discount(?:ed)?|guarantee[ds]?|custom entitlement|custom implementation|guaranteed results?|guaranteed roi)\b/i;

function safeString(value: unknown, max = 300): string | null { return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null; }
function safeTimestamp(value: unknown): string | null { if (typeof value === "number" && Number.isFinite(value)) return new Date(value * 1000).toISOString(); if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString(); return null; }
function safeCount(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null; }

export function extractSalesProviderExecution(params: { response: Record<string, unknown>; requestedModel: string; serverReceivedAt: string; outcome: SalesProviderExecutionMetadata["outcome"] }): SalesProviderExecutionMetadata {
  const usage = (params.response.usage && typeof params.response.usage === "object" ? params.response.usage : {}) as Record<string, unknown>;
  const input = (usage.input_tokens_details && typeof usage.input_tokens_details === "object" ? usage.input_tokens_details : {}) as Record<string, unknown>;
  const output = (usage.output_tokens_details && typeof usage.output_tokens_details === "object" ? usage.output_tokens_details : {}) as Record<string, unknown>;
  const webSearchCalls = (Array.isArray(params.response.output) ? params.response.output : []).filter((item) => item && typeof item === "object" && (item as any).type === "web_search_call").length;
  return { provider: "openai", outcome: params.outcome, requestedModel: safeString(params.requestedModel) || "unknown", returnedModel: safeString(params.response.model), providerResponseId: safeString(params.response.id), providerStatus: safeString(params.response.status, 100), providerCreatedAt: safeTimestamp(params.response.created_at), providerCompletedAt: safeTimestamp(params.response.completed_at), serverReceivedAt: params.serverReceivedAt, usage: { inputTokens: safeCount(usage.input_tokens), cachedInputTokens: safeCount(input.cached_tokens), cacheWriteTokens: safeCount(input.cache_write_tokens), outputTokens: safeCount(usage.output_tokens), reasoningTokens: safeCount(output.reasoning_tokens), totalTokens: safeCount(usage.total_tokens), webSearchCalls } };
}

function outputText(response: Record<string, unknown>): string {
  if (typeof response.output_text === "string") return response.output_text;
  return (Array.isArray(response.output) ? response.output : []).flatMap((item: any) => Array.isArray(item?.content) ? item.content.filter((c: any) => c?.type === "output_text" && typeof c.text === "string").map((c: any) => c.text) : []).join("");
}

function nativeSources(response: Record<string, unknown>, accessDate: string) {
  const raw: NativeSource[] = [];
  for (const item of Array.isArray(response.output) ? response.output : []) if ((item as any)?.type === "web_search_call" && Array.isArray((item as any).action?.sources)) raw.push(...(item as any).action.sources);
  const map = new Map<string, { rawUrl: string; canonicalUrl: string; title: string; publicationDate: string | null; accessDate: string }>();
  for (const source of raw) {
    if (typeof source.url !== "string") continue;
    const canonicalUrl = canonicalizeResearchUrl(source.url);
    const date = source.publication_date ?? source.published_at ?? source.page_age ?? null;
    if (date != null && (typeof date !== "string" || !validDate(date) || date > currentUtcDate() || date > accessDate)) throw new SalesResearchError("native_publication_date_invalid", "A native source contained an invalid or future publication date.", 422);
    if (!map.has(canonicalUrl)) map.set(canonicalUrl, { rawUrl: source.url, canonicalUrl, title: safeString(source.title) || new URL(canonicalUrl).hostname, publicationDate: date as string | null, accessDate });
  }
  return map;
}

export function validateSalesResearchRequest(value: unknown): string[] {
  if (!value || typeof value !== "object") return ["Request must be an object."];
  const input = value as Partial<SalesResearchRequest>; const errors: string[] = [];
  if (input.founderAuthorization?.authorized !== true || input.founderAuthorization.scope !== "one_sales_research_run") errors.push("Separate Founder authorization for one SALES research run is required.");
  if (!input.envelope || !verifySalesEnvelopeIntegrity(input.envelope) || input.envelope.authority.salesPreparationAuthorized !== true) errors.push("A current valid Phase 1A envelope is required.");
  if (input.envelope?.salesContract?.sha256 !== "86141fd7c1aff83cc487346976c6894633a32e37ae498334301138fd658a1f34") errors.push("The Phase 1A envelope is not paired to SALES V1.1.");
  if (input.budgetAuthority?.confirmedByFounder !== true) errors.push("Founder spending confirmation is required.");
  if (!Number.isFinite(input.budgetAuthority?.salesMonthSpendUsd) || Number(input.budgetAuthority?.salesMonthSpendUsd) < 0) errors.push("Current SALES calendar-month spend is required.");
  if (!Number.isFinite(input.budgetAuthority?.commercialDepartmentMonthSpendUsd) || Number(input.budgetAuthority?.commercialDepartmentMonthSpendUsd) < 0) errors.push("Current Commercial AI calendar-month spend is required.");
  return errors;
}

function validateContacts(contacts: SalesContact[], evidenceById: Map<string, { canonicalUrl: string }>) {
  const evidenceIds = new Set(evidenceById.keys());
  if (!Array.isArray(contacts) || contacts.length > MAX_SALES_CONTACTS) throw new SalesResearchError("contact_limit_exceeded", `Provider returned more than ${MAX_SALES_CONTACTS} contacts.`, 422);
  const roleCounts = new Map<string, number>();
  for (const contact of contacts) {
    requiredText(contact.id, "contact.id"); requiredText(contact.name, "contact.name"); requiredText(contact.currentTitle, "contact.currentTitle"); requiredText(contact.company, "contact.company"); requiredText(contact.strategicRoleRationale, "contact.strategicRoleRationale");
    for (const role of contact.strategicRoles || []) { const count = (roleCounts.get(role) || 0) + 1; roleCounts.set(role, count); if (count > MAX_CONTACTS_PER_ROLE) throw new SalesResearchError("stakeholder_role_limit_exceeded", `Provider returned more than ${MAX_CONTACTS_PER_ROLE} contacts for ${role}.`, 422); }
    const route: any = contact.contactRoute;
    if (!["direct_public_business", "general_company", "public_professional_profile", "unknown"].includes(route?.type)) throw new SalesResearchError("contact_route_invalid", "A contact route used an unapproved or inferred type.", 422);
    if (route.type === "unknown" && (route.value != null || route.evidenceIds?.length)) throw new SalesResearchError("unknown_contact_route_invalid", "Unknown contact routes cannot contain guessed details.", 422);
    if (route.type !== "unknown" && (!route.value || !route.evidenceIds?.length || route.evidenceIds.some((id: string) => !evidenceIds.has(id)))) throw new SalesResearchError("contact_route_unverified", "A public contact route requires current SALES evidence.", 422);
    if (route.value && /\b(?:guessed|inferred|pattern|likely email|probable email)\b/i.test(route.value)) throw new SalesResearchError("guessed_contact_rejected", "Guessed contact information is prohibited.", 422);
    if (route.type !== "unknown") {
      let canonicalRoute: string; try { canonicalRoute = canonicalizeResearchUrl(route.value); } catch { throw new SalesResearchError("contact_route_invalid", "Known contact routes must be exact public HTTP(S) pages, not raw or guessed contact details.", 422); }
      if (!route.evidenceIds.some((id: string) => evidenceById.get(id)?.canonicalUrl === canonicalRoute)) throw new SalesResearchError("contact_route_unverified", "A contact-route URL must exactly match its reconciled native source.", 422);
    }
    if (contact.buyingAuthority === "supported" && (!contact.buyingAuthorityEvidenceIds?.length || contact.buyingAuthorityEvidenceIds.some((id) => !evidenceIds.has(id)))) throw new SalesResearchError("buying_authority_unsupported", "Buying authority requires explicit SALES evidence.", 422);
    if (contact.buyingAuthority === "unknown" && contact.buyingAuthorityEvidenceIds?.length) throw new SalesResearchError("buying_authority_state_invalid", "Unknown buying authority cannot carry affirmative evidence.", 422);
  }
}

function validateClaims(claims: SalesClaim[], growthIds: Set<string>, salesIds: Set<string>, rightsStatus: string) {
  const claimIds = new Set<string>();
  for (const claim of claims) {
    if (claimIds.has(claim.id)) throw new SalesResearchError("duplicate_claim_id", "Claims must have unique IDs.", 422); claimIds.add(claim.id);
    requiredText(claim.statement, "claim.statement");
    if (REGULATED_OR_EFFICACY.test(claim.statement) && claim.classification === "verified_fact") throw new SalesResearchError("regulated_claim_invalid", `Claim ${claim.id} cannot turn Brand health, safety, or efficacy messaging into an independently verified fact.`, 422);
    if (RIGHTS_ASSERTION.test(claim.statement) && rightsStatus !== "explicitly_supported") throw new SalesResearchError("rights_claim_unsupported", `Claim ${claim.id} asserts content rights without an explicitly supported rights state.`, 422);
    if (UNSUPPORTED_COMMERCIAL_PROMISE.test(claim.statement) && claim.classification !== "prohibited_unsupported") throw new SalesResearchError("unsupported_commercial_promise", `Claim ${claim.id} introduces an unauthorized commercial promise.`, 422);
    if (["verified_fact", "attributed_brand_claim"].includes(claim.classification) && !claim.evidenceRefs.length) throw new SalesResearchError("factual_claim_unlinked", `Claim ${claim.id} lacks evidence.`, 422);
    for (const ref of claim.evidenceRefs) {
      const valid = ref.kind === "growth_evidence" ? growthIds.has(ref.id) : ref.kind === "sales_evidence" ? salesIds.has(ref.id) : ref.kind === "goshsha_capability" ? Object.hasOwn(GOSHSHHA_CAPABILITY_FACTS, ref.id) : false;
      if (!valid) throw new SalesResearchError("claim_reference_invalid", `Claim ${claim.id} has an invalid evidence reference.`, 422);
    }
  }
  return claimIds;
}

export function normalizeCompletedOpenAISalesResponse(params: { response: Record<string, unknown>; request: SalesResearchRequest; requestedModel: string; serverReceivedAt: string }): SalesResearchProposal {
  const execution = extractSalesProviderExecution({ response: params.response, requestedModel: params.requestedModel, serverReceivedAt: params.serverReceivedAt, outcome: "accepted" });
  try {
    if (params.response.status !== "completed") throw new SalesResearchError("provider_incomplete", "Provider response did not complete.");
    if (execution.usage.webSearchCalls > MAX_SALES_WEB_SEARCH_CALLS) throw new SalesResearchError("web_search_limit_exceeded", "Provider exceeded the approved web-search limit.", 422);
    const raw = outputText(params.response); if (!raw) throw new SalesResearchError("provider_output_missing", "Provider returned no structured output.");
    let proposal: RawProposal; try { proposal = JSON.parse(raw); } catch { throw new SalesResearchError("provider_output_malformed", "Provider structured output was malformed."); }
    const accessDate = params.serverReceivedAt.slice(0, 10); const native = nativeSources(params.response, accessDate); if (!native.size) throw new SalesResearchError("native_source_provenance_missing", "Provider returned no native source provenance.", 422);
    const referenced = new Map<string, any>();
    const evidence = (proposal.evidence || []).map((item: any) => {
      const canonical = canonicalizeResearchUrl(requiredText(item.sourceUrl, "evidence.sourceUrl")); const source = native.get(canonical);
      if (!source) throw new SalesResearchError("model_only_source_rejected", "A SALES citation was absent from native provider provenance.", 422);
      if (!referenced.has(canonical)) referenced.set(canonical, source);
      return { id: requiredText(item.id, "evidence.id"), publisher: requiredText(item.publisher, "evidence.publisher"), ...source, supportedClaim: requiredText(item.supportedClaim, "evidence.supportedClaim"), classification: item.classification };
    });
    if (referenced.size > MAX_SALES_RESEARCH_SOURCES) throw new SalesResearchError("source_limit_exceeded", `Provider evidence referenced more than ${MAX_SALES_RESEARCH_SOURCES} sources.`, 422);
    const salesIds = new Set<string>(evidence.map((item: any) => String(item.id))); if (salesIds.size !== evidence.length) throw new SalesResearchError("duplicate_evidence_id", "SALES evidence IDs must be unique.", 422);
    const growthIds = new Set(params.request.envelope.evidence.items.map((item) => item.id));
    validateContacts(proposal.contacts, new Map(evidence.map((item: any) => [item.id, item])));
    const claimIds = validateClaims(proposal.claims, growthIds, salesIds, proposal.rights?.status);
    const originals = params.request.envelope.evidence.knownUnknowns;
    if (!Array.isArray(proposal.inheritedUnknowns) || proposal.inheritedUnknowns.length !== originals.length || originals.some((value) => !proposal.inheritedUnknowns.some((item: any) => item.originalText === value))) throw new SalesResearchError("inherited_unknown_missing", "Every inherited GROWTH unknown must survive verbatim.", 422);
    for (const item of proposal.inheritedUnknowns) if (item.status === "resolved_by_sales_evidence" && (!item.salesEvidenceIds?.length || item.salesEvidenceIds.some((id: string) => !salesIds.has(id)))) throw new SalesResearchError("unknown_resolution_unsupported", "Resolving an inherited unknown requires current SALES evidence.", 422);
    if (proposal.rights.status === "explicitly_supported" && (!proposal.rights.evidenceIds.length || proposal.rights.evidenceIds.some((id: string) => !salesIds.has(id)))) throw new SalesResearchError("rights_evidence_missing", "Affirmative rights status requires explicit SALES evidence.", 422);
    if (params.request.envelope.boundarySnapshot.rightsStatus === "unknown" && proposal.rights.status === "not_applicable") throw new SalesResearchError("rights_unknown_dropped", "Inherited rights uncertainty cannot silently disappear.", 422);
    if (proposal.retailerIndependence.posture === "evidence_supported_dependency" && (!proposal.retailerIndependence.evidenceIds.length || proposal.retailerIndependence.evidenceIds.some((id: string) => !salesIds.has(id)))) throw new SalesResearchError("retailer_dependency_unsupported", "Retailer dependency requires explicit SALES evidence.", 422);
    const claimsById = new Map<string, SalesClaim>(proposal.claims.map((claim: SalesClaim) => [claim.id, claim]));
    for (const id of proposal.outreach.claimIds || []) {
      if (!claimIds.has(id)) throw new SalesResearchError("outreach_claim_invalid", "Outreach references an unapproved claim.", 422);
      if (claimsById.get(id)?.classification === "prohibited_unsupported") throw new SalesResearchError("outreach_prohibited_claim", "Outreach cannot use a prohibited unsupported claim.", 422);
    }
    for (const objection of proposal.objections || []) for (const id of objection.claimIds || []) if (!claimIds.has(id)) throw new SalesResearchError("objection_claim_invalid", "An objection response references an unapproved claim.", 422);
    const best = proposal.contacts.find((contact: SalesContact) => contact.strategicRoles.includes("Best First Contact"));
    const envelope = params.request.envelope;
    return { execution, normalizedSourceCount: referenced.size, playbook: {
      schemaVersion: "sales-playbook-v1", createdAt: params.serverReceivedAt,
      growthQualification: { candidateId: envelope.candidate.candidateId, brand: envelope.opportunity.brand, productOrEvent: envelope.opportunity.productOrEvent, score: envelope.qualification.score, band: envelope.qualification.band, confidence: envelope.qualification.confidence, feasibility: envelope.qualification.founderStagePursuitFeasibility, candidateSha256: envelope.candidate.candidateSha256 },
      salesPursuitDecision: proposal.salesPursuitDecision, salesPursuitRationale: requiredText(proposal.salesPursuitRationale, "salesPursuitRationale"), opportunityStrategy: { ...proposal.strategy, offerFacts: { freeFirst: "$0 / one product / one properly licensed uploaded video / 30 days / first 250 qualified views / proof-acquisition only", irlRetailMedia: "$99 / one product / one video / 90 days / first 1,000 qualified views", creatorNetwork: "14-day trial with card / then $75/month" } }, contacts: proposal.contacts, proofStrategy: requiredText(proposal.proofStrategy, "proofStrategy"), claims: proposal.claims, inheritedUnknowns: proposal.inheritedUnknowns, rights: proposal.rights, retailerIndependence: proposal.retailerIndependence, objections: proposal.objections,
      outreach: { ...proposal.outreach, sendingAuthorized: false }, fastestRevenuePath: envelope.opportunity.fastestRevenuePath, evidence,
      crmReadyPacket: { schemaVersion: "sales-crm-ready-v1", account: envelope.opportunity.brand, opportunity: envelope.opportunity.productOrEvent, salesPursuitDecision: proposal.salesPursuitDecision, bestFirstContactId: best?.id || null, contactIds: proposal.contacts.map((contact: SalesContact) => contact.id), trigger: envelope.opportunity.trigger, wedge: envelope.opportunity.goshshaWedge, entryOffer: proposal.strategy.selectedEntryOffer, nextAction: proposal.strategy.desiredNextAction, inheritedUnknowns: proposal.inheritedUnknowns, sourceIds: evidence.map((item: any) => item.id), crmWriteAuthorized: false },
      authority: { founderReviewed: false, sendingAuthorized: false, crmWriteAuthorized: false, persistence: false, revenueInvocationAuthorized: false, closerInvocationAuthorized: false, externalAction: false },
    } };
  } catch (error) {
    if (error instanceof SalesResearchError && execution.providerStatus === "completed") error.providerExecution = { ...execution, outcome: "provider_completed_local_rejection" };
    throw error;
  }
}
