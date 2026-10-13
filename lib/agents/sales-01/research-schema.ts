import { createHash } from "crypto";

import { canonicalizeResearchUrl } from "../growth-01/research-schema";
import { GOSHSHHA_CAPABILITY_FACTS } from "./research-prompt";
import type { SalesClaim, SalesContact, SalesProviderExecutionMetadata, SalesResearchProposal, SalesResearchRejectionDiagnostics, SalesResearchRequest, SalesRightsRejectionDiagnostics, SalesSourceRejectionDiagnostics } from "./research-types";
import { verifySalesEnvelopeIntegrity } from "./validation";
import { APPROVED_SALES_CONTRACT_SHA256 } from "./contract";
import { verifyCommercialPositioning } from "../commercial-positioning";

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
  rejectionDiagnostics: SalesResearchRejectionDiagnostics | null;
  constructor(code: string, message: string, httpStatus = 502, execution: SalesProviderExecutionMetadata | null = null, diagnostics: SalesResearchRejectionDiagnostics | null = null) {
    super(message); this.name = "SalesResearchError"; this.code = code; this.httpStatus = httpStatus; this.providerExecution = execution; this.rejectionDiagnostics = diagnostics;
  }
}

const text = { type: "string" } as const;
const nullableText = { anyOf: [text, { type: "null" }] } as const;
const evidenceRefs = { type: "array", maxItems: 12, items: { type: "object", additionalProperties: false, required: ["kind", "id"], properties: { kind: { type: "string", enum: ["growth_evidence", "sales_evidence", "goshsha_capability"] }, id: text } } } as const;

export const OPENAI_SALES_INTELLIGENCE_JSON_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["partial", "limitations", "salesPursuitDecision", "salesPursuitRationale", "strategy", "contacts", "contactSelection", "proofStrategy", "claims", "inheritedUnknowns", "rights", "retailerIndependence", "objections", "outreach", "evidence"],
  properties: {
    partial: { type: "boolean" }, limitations: { type: "array", maxItems: 20, items: text },
    salesPursuitDecision: { type: "string", enum: ["Pursue Now", "Nurture / Revisit", "Do Not Pursue"] }, salesPursuitRationale: text,
    strategy: { type: "object", additionalProperties: false, required: ["observedTrigger", "specificProblem", "goshshaWedge", "retailerIndependenceAssessment", "selectedEntryOffer", "offerRationale", "physicalScanProofPoint", "paidConversionHypothesis", "desiredNextAction"], properties: { observedTrigger: text, specificProblem: text, goshshaWedge: text, retailerIndependenceAssessment: text, selectedEntryOffer: { type: "string", enum: ["Free First", "IRL Retail Media", "Creator Network", "Combined"] }, offerRationale: text, physicalScanProofPoint: text, paidConversionHypothesis: text, desiredNextAction: text } },
    contacts: { type: "array", maxItems: MAX_SALES_CONTACTS, items: { type: "object", additionalProperties: false, required: ["id", "name", "currentTitle", "company", "identityEvidenceIds", "currentRoleEvidenceIds", "stakeholderFunction", "problemOwnership", "functionalRelevance", "functionalRelevanceClassification", "confidence", "freshness", "conflictingEvidenceIds", "strategicRoles", "strategicRoleRationale", "buyingAuthority", "buyingAuthorityEvidenceIds", "contactRoute", "evidenceIds"], properties: { id: text, name: text, currentTitle: text, company: text, identityEvidenceIds: { type: "array", maxItems: 6, items: text }, currentRoleEvidenceIds: { type: "array", maxItems: 6, items: text }, stakeholderFunction: text, problemOwnership: { type: "string", enum: ["direct", "adjacent", "not_evidenced", "unknown"] }, functionalRelevance: text, functionalRelevanceClassification: { type: "string", enum: ["sales_inference"] }, confidence: { type: "string", enum: ["Confirmed", "Probable", "Uncertain"] }, freshness: { type: "string", enum: ["current", "stale", "conflicting", "unknown"] }, conflictingEvidenceIds: { type: "array", maxItems: 6, items: text }, strategicRoles: { type: "array", maxItems: 5, items: { type: "string", enum: ["Best First Contact", "Internal Champion", "Economic Buyer", "Executive Sponsor", "Operational Owner"] } }, strategicRoleRationale: text, buyingAuthority: { type: "string", enum: ["unknown", "supported"] }, buyingAuthorityEvidenceIds: { type: "array", maxItems: 6, items: text }, contactRoute: { type: "object", additionalProperties: false, required: ["type", "value", "evidenceIds"], properties: { type: { type: "string", enum: ["direct_public_business", "general_company", "public_professional_profile", "unknown"] }, value: nullableText, evidenceIds: { type: "array", maxItems: 6, items: text } } }, evidenceIds: { type: "array", maxItems: 12, items: text } } } },
    contactSelection: { type: "object", additionalProperties: false, required: ["status", "bestFirstContactId", "unavailableReason", "smallestSufficientSetRationale"], properties: { status: { type: "string", enum: ["recommended", "unavailable"] }, bestFirstContactId: nullableText, unavailableReason: nullableText, smallestSufficientSetRationale: text } },
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
type NativeSourceChannel = "web_search_action" | "url_citation_annotation";
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const currentUtcDate = () => new Date().toISOString().slice(0, 10);
const requiredText = (value: unknown, field: string) => { if (typeof value !== "string" || !value.trim()) throw new SalesResearchError("provider_output_invalid", `${field} must contain text.`, 422); return value.trim(); };
const REGULATED_OR_EFFICACY = /\b(?:medical|therapeutic|treat(?:s|ment)?|prevent(?:s|ion)?|disease|efficacy|effective|safety|safe|dosage|dose|ingredient[- ]interaction|fda approved|clinically proven)\b/i;
const RIGHTS_ASSERTION = /\b(?:owns?|controls?|has cleared|licensed|rights? to|can reuse)\b.*\b(?:content|video|creator|activation|reuse)\b/i;
const RIGHTS_TOPIC = /\b(?:content rights?|activation rights?|reuse rights?|rights? to (?:use|reuse)|owns?|controls?|licensed content|creator content|creator video)\b/i;
const ATTRIBUTED_RIGHTS = /\b(?:states?|claims?|reports?|says?|according to)\b/i;
const CONDITIONAL_RIGHTS_REQUIREMENT = "The Brand must later supply or confirm Brand-owned or properly licensed content.";
const UNKNOWN_RIGHTS_PATTERNS = [
  /^(?:the brand(?:'s)? )?(?:content|activation|reuse) rights? (?:remain|remains|are|is) (?:unknown|unresolved|not verified|not confirmed)(?: until (?:verified|confirmed))?[.!]?$/i,
  /^rights? to (?:use|reuse) (?:specific )?(?:creator )?(?:video )?content (?:remain|remains|are|is) (?:unknown|unresolved|not verified|not confirmed)(?: until (?:verified|confirmed))?[.!]?$/i,
];
const UNSUPPORTED_COMMERCIAL_PROMISE = /\b(?:discount(?:ed)?|guarantee[ds]?|custom entitlement|custom implementation|guaranteed results?|guaranteed roi)\b/i;
const UNSUPPORTED_AUDIENCE_CLAIM = /\b(?:massive|large|millions? of|guaranteed)\b.{0,30}\b(?:audience|users?|reach|impressions?|views?)\b|\b(?:all|every)\b.{0,20}\b(?:shopper|customer)\b.{0,20}\b(?:uses?|has|will)\b.{0,10}\bGoshsha\b|\b(?:guaranteed|causal)\b.{0,30}\b(?:sales lift|conversion|roi|attribution)\b/i;

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

const MAX_REJECTION_NATIVE_HASHES = 20;
const MAX_DIAGNOSTIC_HOSTNAME_LENGTH = 253;
const sha256Diagnostic = (value: string) => createHash("sha256").update(value).digest("hex");
function safeDiagnosticHostname(canonicalUrl: string): string | null {
  try {
    const hostname = new URL(canonicalUrl).hostname.toLowerCase();
    if (!hostname || hostname.length > MAX_DIAGNOSTIC_HOSTNAME_LENGTH || !/^[a-z0-9.-]+$/.test(hostname)) return null;
    return hostname;
  } catch { return null; }
}

function nativeSources(response: Record<string, unknown>, accessDate: string) {
  const raw: Array<{ source: NativeSource; channel: NativeSourceChannel }> = [];
  let actionSourceCount = 0;
  let annotationSourceCount = 0;
  for (const item of Array.isArray(response.output) ? response.output : []) {
    if ((item as any)?.type === "web_search_call" && Array.isArray((item as any).action?.sources)) {
      for (const source of (item as any).action.sources) { raw.push({ source, channel: "web_search_action" }); actionSourceCount += 1; }
    }
    if ((item as any)?.type === "message" && Array.isArray((item as any).content)) {
      for (const content of (item as any).content) {
        if (!Array.isArray(content?.annotations)) continue;
        for (const annotation of content.annotations) {
          if (annotation?.type !== "url_citation" || typeof annotation.url !== "string") continue;
          raw.push({ source: { url: annotation.url, title: annotation.title }, channel: "url_citation_annotation" });
          annotationSourceCount += 1;
        }
      }
    }
  }
  const map = new Map<string, { rawUrl: string; canonicalUrl: string; title: string; publicationDate: string | null; accessDate: string }>();
  for (const { source } of raw) {
    if (typeof source.url !== "string") continue;
    const canonicalUrl = canonicalizeResearchUrl(source.url);
    const date = source.publication_date ?? source.published_at ?? source.page_age ?? null;
    if (date != null && (typeof date !== "string" || !validDate(date) || date > currentUtcDate() || date > accessDate)) throw new SalesResearchError("native_publication_date_invalid", "A native source contained an invalid or future publication date.", 422);
    if (!map.has(canonicalUrl)) map.set(canonicalUrl, { rawUrl: source.url, canonicalUrl, title: safeString(source.title) || new URL(canonicalUrl).hostname, publicationDate: date as string | null, accessDate });
  }
  return { map, actionSourceCount, annotationSourceCount };
}

function sourceRejectionDiagnostics(params: { evidenceItem: any; evidenceOrdinal: number; proposedCanonicalUrl: string; native: ReturnType<typeof nativeSources>; request: SalesResearchRequest }): SalesSourceRejectionDiagnostics {
  const nativeHashes = [...params.native.map.keys()].map(sha256Diagnostic).sort();
  const inheritedCanonical = new Set(params.request.envelope.evidence.items.flatMap((item) => { try { return [canonicalizeResearchUrl(item.sourceUrl)]; } catch { return []; } }));
  const evidenceId = typeof params.evidenceItem?.id === "string" ? params.evidenceItem.id.slice(0, 500) : "";
  return {
    failureStage: "sales_evidence_native_reconciliation",
    failingEvidenceOrdinal: Math.max(0, Math.min(params.evidenceOrdinal, MAX_SALES_RESEARCH_SOURCES - 1)),
    failingEvidenceIdSha256: sha256Diagnostic(evidenceId),
    proposedCanonicalUrlSha256: sha256Diagnostic(params.proposedCanonicalUrl),
    proposedHostname: safeDiagnosticHostname(params.proposedCanonicalUrl),
    nativeActionSourceCount: Math.min(params.native.actionSourceCount, 1_000),
    nativeAnnotationSourceCount: Math.min(params.native.annotationSourceCount, 1_000),
    nativeCanonicalSourceCount: Math.min(params.native.map.size, 1_000),
    nativeCanonicalUrlHashes: nativeHashes.slice(0, MAX_REJECTION_NATIVE_HASHES),
    nativeHashListTruncated: nativeHashes.length > MAX_REJECTION_NATIVE_HASHES,
    matchesInheritedGrowthSource: inheritedCanonical.has(params.proposedCanonicalUrl),
    redirectResolutionAttempted: false,
  };
}

type RightsSemanticCategory = SalesRightsRejectionDiagnostics["semanticCategory"];
function normalizedRightsText(value: string): string { return value.trim().replace(/\s+/g, " "); }
function isRightsUnknownText(value: string, originalUnknowns: string[]): boolean {
  const normalized = normalizedRightsText(value);
  return originalUnknowns.some((item) => RIGHTS_TOPIC.test(item) && normalizedRightsText(item) === normalized)
    || UNKNOWN_RIGHTS_PATTERNS.some((pattern) => pattern.test(normalized));
}
function classifyRightsClaim(statement: string, originalUnknowns: string[]): RightsSemanticCategory | null {
  const normalized = normalizedRightsText(statement);
  if (normalized === CONDITIONAL_RIGHTS_REQUIREMENT) return "conditional_requirement";
  if (RIGHTS_ASSERTION.test(normalized)) return ATTRIBUTED_RIGHTS.test(normalized) ? "attributed_rights_statement" : "affirmative_assertion";
  if (isRightsUnknownText(normalized, originalUnknowns)) return "unknown_qualification";
  if (RIGHTS_TOPIC.test(normalized)) return ATTRIBUTED_RIGHTS.test(normalized) ? "attributed_rights_statement" : "ambiguous_rights_language";
  return null;
}
function rightsUnknownState(originalUnknowns: string[], inheritedUnknowns: any[]) {
  const originals = originalUnknowns.filter((item) => RIGHTS_TOPIC.test(item));
  const preserved = originals.length > 0 && originals.every((originalText) => inheritedUnknowns.some((item) => item?.originalText === originalText && item.status === "unresolved" && item.resolution === null && Array.isArray(item.salesEvidenceIds) && item.salesEvidenceIds.length === 0));
  return { present: originals.length > 0, preserved };
}
function rightsRejectionDiagnostics(params: { claim: any; claimOrdinal: number; category: RightsSemanticCategory; rights: any; originalUnknowns: string[]; inheritedUnknowns: any[] }): SalesRightsRejectionDiagnostics {
  const unknownState = rightsUnknownState(params.originalUnknowns, params.inheritedUnknowns);
  const classifications = new Set(["verified_fact", "attributed_brand_claim", "goshsha_capability", "reasonable_inference", "hypothesis", "unknown", "prohibited_unsupported"]);
  const statuses = new Set(["unknown", "explicitly_supported", "not_applicable"]);
  const claimId = typeof params.claim?.id === "string" ? params.claim.id : "";
  const statement = typeof params.claim?.statement === "string" ? params.claim.statement : "";
  return {
    failureStage: "sales_claim_rights_validation",
    failingClaimOrdinal: Math.max(0, Math.min(params.claimOrdinal, 39)),
    failingClaimIdSha256: sha256Diagnostic(claimId),
    statementSha256: sha256Diagnostic(statement),
    classification: classifications.has(params.claim?.classification) ? params.claim.classification : "invalid",
    rightsStatus: statuses.has(params.rights?.status) ? params.rights.status : "invalid",
    semanticCategory: params.category,
    evidenceReferenceCount: Math.min(Array.isArray(params.claim?.evidenceRefs) ? params.claim.evidenceRefs.length : 0, 12),
    rightsEvidenceCount: Math.min(Array.isArray(params.rights?.evidenceIds) ? params.rights.evidenceIds.length : 0, 8),
    inheritedRightsUnknownPresent: unknownState.present,
    inheritedRightsUnknownPreserved: unknownState.preserved,
    rawClaimRetained: false,
  };
}

export function validateSalesResearchRequest(value: unknown): string[] {
  if (!value || typeof value !== "object") return ["Request must be an object."];
  const input = value as Partial<SalesResearchRequest>; const errors: string[] = [];
  if (input.founderAuthorization?.authorized !== true || input.founderAuthorization.scope !== "one_sales_research_run") errors.push("Separate Founder authorization for one SALES research run is required.");
  if (!input.envelope || !verifySalesEnvelopeIntegrity(input.envelope) || input.envelope.authority.salesPreparationAuthorized !== true) errors.push("A current valid Phase 1A envelope is required.");
  if (input.envelope?.salesContract?.sha256 !== APPROVED_SALES_CONTRACT_SHA256 || input.envelope?.salesContract?.version !== "V1.3") errors.push("The Phase 1A envelope is not paired to SALES V1.3.");
  if (input.budgetAuthority?.confirmedByFounder !== true) errors.push("Founder spending confirmation is required.");
  if (!Number.isFinite(input.budgetAuthority?.salesMonthSpendUsd) || Number(input.budgetAuthority?.salesMonthSpendUsd) < 0) errors.push("Current SALES calendar-month spend is required.");
  if (!Number.isFinite(input.budgetAuthority?.commercialDepartmentMonthSpendUsd) || Number(input.budgetAuthority?.commercialDepartmentMonthSpendUsd) < 0) errors.push("Current Commercial AI calendar-month spend is required.");
  return errors;
}

function validateContacts(contacts: SalesContact[], selection: RawProposal["contactSelection"], evidenceById: Map<string, { canonicalUrl: string; classification: string }>) {
  const evidenceIds = new Set(evidenceById.keys());
  if (!Array.isArray(contacts) || contacts.length > MAX_SALES_CONTACTS) throw new SalesResearchError("contact_limit_exceeded", `Provider returned more than ${MAX_SALES_CONTACTS} contacts.`, 422);
  const roleCounts = new Map<string, number>();
  const contactIds = new Set<string>();
  for (const contact of contacts) {
    requiredText(contact.id, "contact.id"); requiredText(contact.name, "contact.name"); requiredText(contact.currentTitle, "contact.currentTitle"); requiredText(contact.company, "contact.company"); requiredText(contact.strategicRoleRationale, "contact.strategicRoleRationale");
    if (contactIds.has(contact.id)) throw new SalesResearchError("duplicate_contact_id", "Contacts must have unique IDs.", 422); contactIds.add(contact.id);
    requiredText(contact.stakeholderFunction, "contact.stakeholderFunction"); requiredText(contact.functionalRelevance, "contact.functionalRelevance");
    if (contact.functionalRelevanceClassification !== "sales_inference") throw new SalesResearchError("functional_relevance_classification_invalid", "Functional relevance must remain a SALES inference.", 422);
    for (const [field, ids, required] of [["identityEvidenceIds", contact.identityEvidenceIds, true], ["currentRoleEvidenceIds", contact.currentRoleEvidenceIds, true], ["conflictingEvidenceIds", contact.conflictingEvidenceIds, contact.freshness === "conflicting"], ["evidenceIds", contact.evidenceIds, false]] as const) {
      if (!Array.isArray(ids) || (required && !ids.length) || ids.some((id) => !evidenceIds.has(id))) throw new SalesResearchError("contact_evidence_invalid", `${field} must reference current reconciled SALES evidence.`, 422);
    }
    if ([...contact.identityEvidenceIds, ...contact.currentRoleEvidenceIds].some((id) => evidenceById.get(id)?.classification !== "verified_fact")) throw new SalesResearchError("contact_fact_evidence_invalid", "Identity and current-role evidence must be classified as verified fact.", 422);
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
  const best = contacts.filter((contact) => contact.strategicRoles.includes("Best First Contact"));
  if (best.length > 1) throw new SalesResearchError("best_first_contact_limit_exceeded", "SALES may recommend at most one Best First Contact.", 422);
  requiredText(selection?.smallestSufficientSetRationale, "contactSelection.smallestSufficientSetRationale");
  if (best.length === 0) {
    if (selection?.status !== "unavailable" || selection.bestFirstContactId !== null || typeof selection.unavailableReason !== "string" || !selection.unavailableReason.trim()) throw new SalesResearchError("best_first_contact_gap_missing", "No Best First Contact requires an explicit unavailable evidence-gap explanation.", 422);
  } else {
    const contact = best[0];
    if (selection?.status !== "recommended" || selection.bestFirstContactId !== contact.id || selection.unavailableReason !== null) throw new SalesResearchError("best_first_contact_selection_invalid", "The explicit Best First Contact selection must match the single recommendation.", 422);
    if (!["direct", "adjacent"].includes(contact.problemOwnership) || contact.confidence === "Uncertain" || contact.freshness !== "current") throw new SalesResearchError("best_first_contact_support_insufficient", "Best First Contact requires evidenced problem ownership, sufficient confidence, and current role evidence.", 422);
    const genericPartnerships = /^partnerships?$/i.test(contact.stakeholderFunction.trim());
    const unrelated = /\b(?:distribution|licensing|technology alliances?|corporate development|wholesale)\b/i.test(`${contact.currentTitle} ${contact.stakeholderFunction}`);
    if (genericPartnerships || unrelated) throw new SalesResearchError("best_first_contact_function_unsupported", "A generic or unrelated Partnerships function cannot be Best First Contact without a directly relevant evidenced remit.", 422);
  }
}

function validateClaims(claims: SalesClaim[], growthIds: Set<string>, salesIds: Set<string>, rights: RawProposal["rights"], originalUnknowns: string[], inheritedUnknowns: RawProposal["inheritedUnknowns"]) {
  const claimIds = new Set<string>();
  const unknownState = rightsUnknownState(originalUnknowns, inheritedUnknowns);
  for (const [claimOrdinal, claim] of claims.entries()) {
    if (claimIds.has(claim.id)) throw new SalesResearchError("duplicate_claim_id", "Claims must have unique IDs.", 422); claimIds.add(claim.id);
    requiredText(claim.statement, "claim.statement");
    if (REGULATED_OR_EFFICACY.test(claim.statement) && claim.classification === "verified_fact") throw new SalesResearchError("regulated_claim_invalid", `Claim ${claim.id} cannot turn Brand health, safety, or efficacy messaging into an independently verified fact.`, 422);
    const rightsCategory = classifyRightsClaim(claim.statement, originalUnknowns);
    if (rightsCategory) {
      const diagnostics = rightsRejectionDiagnostics({ claim, claimOrdinal, category: rightsCategory, rights, originalUnknowns, inheritedUnknowns });
      const unknownContext = rights?.status === "unknown" && Array.isArray(rights?.evidenceIds) && rights.evidenceIds.length === 0 && unknownState.present && unknownState.preserved;
      const unknownQualificationValid = rightsCategory === "unknown_qualification" && unknownContext && claim.classification === "unknown" && Array.isArray(claim.evidenceRefs) && claim.evidenceRefs.length === 0;
      const conditionalRequirementValid = rightsCategory === "conditional_requirement" && unknownContext && claim.classification === "goshsha_capability" && Array.isArray(claim.evidenceRefs) && claim.evidenceRefs.length === 1 && claim.evidenceRefs[0]?.kind === "goshsha_capability" && claim.evidenceRefs[0]?.id === "cap-free-first";
      const affirmativeSupported = rightsCategory === "affirmative_assertion"
        && rights?.status === "explicitly_supported"
        && claim.classification === "verified_fact"
        && Array.isArray(claim.evidenceRefs)
        && claim.evidenceRefs.length > 0
        && claim.evidenceRefs.every((ref) => ref.kind === "sales_evidence" && Array.isArray(rights.evidenceIds) && rights.evidenceIds.includes(ref.id));
      if (!unknownQualificationValid && !conditionalRequirementValid && !affirmativeSupported) throw new SalesResearchError("rights_claim_unsupported", `Claim ${claim.id} has unsupported or incompatible content-rights semantics.`, 422, null, diagnostics);
    }
    if (UNSUPPORTED_COMMERCIAL_PROMISE.test(claim.statement) && claim.classification !== "prohibited_unsupported") throw new SalesResearchError("unsupported_commercial_promise", `Claim ${claim.id} introduces an unauthorized commercial promise.`, 422);
    if (UNSUPPORTED_AUDIENCE_CLAIM.test(claim.statement) && claim.classification !== "prohibited_unsupported") throw new SalesResearchError("unsupported_audience_claim", `Claim ${claim.id} contains an unsupported audience, reach, or performance assertion.`, 422);
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
    const accessDate = params.serverReceivedAt.slice(0, 10); const native = nativeSources(params.response, accessDate); if (!native.map.size) throw new SalesResearchError("native_source_provenance_missing", "Provider returned no native source provenance.", 422);
    const referenced = new Map<string, any>();
    const evidence = (proposal.evidence || []).map((item: any, evidenceOrdinal: number) => {
      const canonical = canonicalizeResearchUrl(requiredText(item.sourceUrl, "evidence.sourceUrl")); const source = native.map.get(canonical);
      if (!source) throw new SalesResearchError("model_only_source_rejected", "A SALES citation was absent from native provider provenance.", 422, null, sourceRejectionDiagnostics({ evidenceItem: item, evidenceOrdinal, proposedCanonicalUrl: canonical, native, request: params.request }));
      if (!referenced.has(canonical)) referenced.set(canonical, source);
      return { id: requiredText(item.id, "evidence.id"), publisher: requiredText(item.publisher, "evidence.publisher"), ...source, supportedClaim: requiredText(item.supportedClaim, "evidence.supportedClaim"), classification: item.classification };
    });
    if (referenced.size > MAX_SALES_RESEARCH_SOURCES) throw new SalesResearchError("source_limit_exceeded", `Provider evidence referenced more than ${MAX_SALES_RESEARCH_SOURCES} sources.`, 422);
    const salesIds = new Set<string>(evidence.map((item: any) => String(item.id))); if (salesIds.size !== evidence.length) throw new SalesResearchError("duplicate_evidence_id", "SALES evidence IDs must be unique.", 422);
    const growthIds = new Set(params.request.envelope.evidence.items.map((item) => item.id));
    validateContacts(proposal.contacts, proposal.contactSelection, new Map(evidence.map((item: any) => [item.id, item])));
    const originals = params.request.envelope.evidence.knownUnknowns;
    if (!Array.isArray(proposal.inheritedUnknowns) || proposal.inheritedUnknowns.length !== originals.length || originals.some((value) => !proposal.inheritedUnknowns.some((item: any) => item.originalText === value))) throw new SalesResearchError("inherited_unknown_missing", "Every inherited GROWTH unknown must survive verbatim.", 422);
    for (const item of proposal.inheritedUnknowns) if (item.status === "resolved_by_sales_evidence" && (!item.salesEvidenceIds?.length || item.salesEvidenceIds.some((id: string) => !salesIds.has(id)))) throw new SalesResearchError("unknown_resolution_unsupported", "Resolving an inherited unknown requires current SALES evidence.", 422);
    const claimIds = validateClaims(proposal.claims, growthIds, salesIds, proposal.rights, originals, proposal.inheritedUnknowns);
    if (proposal.rights.status === "explicitly_supported" && (!proposal.rights.evidenceIds.length || proposal.rights.evidenceIds.some((id: string) => !salesIds.has(id)))) throw new SalesResearchError("rights_evidence_missing", "Affirmative rights status requires explicit SALES evidence.", 422);
    if (params.request.envelope.boundarySnapshot.rightsStatus === "unknown" && proposal.rights.status === "not_applicable") throw new SalesResearchError("rights_unknown_dropped", "Inherited rights uncertainty cannot silently disappear.", 422);
    if (proposal.retailerIndependence.posture === "evidence_supported_dependency" && (!proposal.retailerIndependence.evidenceIds.length || proposal.retailerIndependence.evidenceIds.some((id: string) => !salesIds.has(id)))) throw new SalesResearchError("retailer_dependency_unsupported", "Retailer dependency requires explicit SALES evidence.", 422);
    const claimsById = new Map<string, SalesClaim>(proposal.claims.map((claim: SalesClaim) => [claim.id, claim]));
    for (const id of proposal.outreach.claimIds || []) {
      if (!claimIds.has(id)) throw new SalesResearchError("outreach_claim_invalid", "Outreach references an unapproved claim.", 422);
      if (claimsById.get(id)?.classification === "prohibited_unsupported") throw new SalesResearchError("outreach_prohibited_claim", "Outreach cannot use a prohibited unsupported claim.", 422);
    }
    for (const objection of proposal.objections || []) for (const id of objection.claimIds || []) if (!claimIds.has(id)) throw new SalesResearchError("objection_claim_invalid", "An objection response references an unapproved claim.", 422);
    for (const value of [proposal.strategy?.goshshaWedge, proposal.strategy?.offerRationale, proposal.outreach?.initialMessage, proposal.outreach?.firstFollowUp, proposal.outreach?.secondFollowUp, ...(proposal.objections || []).flatMap((item: any) => [item.objection, item.response])]) if (typeof value === "string" && UNSUPPORTED_AUDIENCE_CLAIM.test(value)) throw new SalesResearchError("unsupported_audience_claim", "Provider output contains an unsupported audience, reach, or performance assertion.", 422);
    const best = proposal.contactSelection.status === "recommended" ? proposal.contactSelection.bestFirstContactId : null;
    const envelope = params.request.envelope;
    const positioning = verifyCommercialPositioning();
    const platformClaims = [
      { id: "positioning-product-mechanics", statement: `${positioning.body.productMechanics.shopperDevice} ${positioning.body.productMechanics.shopperAction} ${positioning.body.productMechanics.contentAvailability}`, classification: "goshsha_capability" as const },
      { id: "positioning-measurement", statement: positioning.body.measurableMeaning.definition, classification: "goshsha_capability" as const },
      { id: "positioning-audience-distinction", statement: positioning.body.audienceDistinction.goshshaPosition, classification: "goshsha_capability" as const },
    ];
    const audienceObjection = { objection: positioning.body.userCountObjection.objection, response: positioning.body.userCountObjection.response, deeperQualification: positioning.body.userCountObjection.deeperQualification };
    return { execution, normalizedSourceCount: referenced.size, playbook: {
      schemaVersion: "sales-playbook-v1.1", createdAt: params.serverReceivedAt,
      growthQualification: { candidateId: envelope.candidate.candidateId, brand: envelope.opportunity.brand, productOrEvent: envelope.opportunity.productOrEvent, score: envelope.qualification.score, band: envelope.qualification.band, confidence: envelope.qualification.confidence, feasibility: envelope.qualification.founderStagePursuitFeasibility, candidateSha256: envelope.candidate.candidateSha256 },
      salesPursuitDecision: proposal.salesPursuitDecision, salesPursuitRationale: requiredText(proposal.salesPursuitRationale, "salesPursuitRationale"), opportunityStrategy: { ...proposal.strategy, offerFacts: { freeFirst: "$0 / one product / one properly licensed uploaded video / 30 days / first 250 qualified views / proof-acquisition only", irlRetailMedia: "$99 / one product / one video / 90 days / first 1,000 qualified views", creatorNetwork: "14-day trial with card / then $75/month" } }, positioningFoundation: { schemaVersion: positioning.schemaVersion, version: positioning.version, sha256: positioning.sha256, opportunitySpecificPositioning: requiredText(proposal.strategy.goshshaWedge, "strategy.goshshaWedge"), approvedPlatformClaims: platformClaims, mechanicsQualifications: [positioning.body.productMechanics.shopperDevice, positioning.body.productMechanics.shopperAction, positioning.body.productMechanics.contentAvailability, positioning.body.rightsQualification, positioning.body.measurableMeaning.definition], audienceObjection, prohibitedClaims: positioning.body.prohibitedClaims, offerBindings: { catalogVersion: positioning.body.offerBindings.catalogVersion, catalogSha256: positioning.body.offerBindings.catalogSha256, product2OfferId: positioning.body.offerBindings.product2OfferId, freeFirstOfferId: positioning.body.offerBindings.freeFirstOfferId } }, contacts: proposal.contacts, contactSelection: proposal.contactSelection, proofStrategy: requiredText(proposal.proofStrategy, "proofStrategy"), claims: proposal.claims, inheritedUnknowns: proposal.inheritedUnknowns, rights: proposal.rights, retailerIndependence: proposal.retailerIndependence, objections: [{ objection: audienceObjection.objection, response: `${audienceObjection.response} ${audienceObjection.deeperQualification}`, claimIds: platformClaims.map(x=>x.id), escalate: false }, ...proposal.objections],
      outreach: { ...proposal.outreach, sendingAuthorized: false }, fastestRevenuePath: envelope.opportunity.fastestRevenuePath, evidence,
      crmReadyPacket: { schemaVersion: "sales-crm-ready-v1", account: envelope.opportunity.brand, opportunity: envelope.opportunity.productOrEvent, salesPursuitDecision: proposal.salesPursuitDecision, bestFirstContactId: best, bestFirstContactStatus: proposal.contactSelection.status, bestFirstContactUnavailableReason: proposal.contactSelection.unavailableReason, contactIds: proposal.contacts.map((contact: SalesContact) => contact.id), trigger: envelope.opportunity.trigger, wedge: envelope.opportunity.goshshaWedge, entryOffer: proposal.strategy.selectedEntryOffer, nextAction: proposal.strategy.desiredNextAction, inheritedUnknowns: proposal.inheritedUnknowns, sourceIds: evidence.map((item: any) => item.id), crmWriteAuthorized: false },
      authority: { founderReviewed: false, sendingAuthorized: false, crmWriteAuthorized: false, persistence: false, revenueInvocationAuthorized: false, closerInvocationAuthorized: false, externalAction: false },
    } };
  } catch (error) {
    if (error instanceof SalesResearchError && execution.providerStatus === "completed") error.providerExecution = { ...execution, outcome: "provider_completed_local_rejection", ...(error.rejectionDiagnostics ? { rejectionDiagnostics: error.rejectionDiagnostics } : {}) };
    throw error;
  }
}
