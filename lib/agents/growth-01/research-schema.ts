import type { GrowthCandidateInput, GrowthRunRequest } from "./types";
import type {
  GrowthResearchProposal,
  GrowthResearchRequest,
  NormalizedResearchSource,
} from "./research-types";

export class GrowthResearchError extends Error {
  code: string;
  httpStatus: number;

  constructor(code: string, message: string, httpStatus = 502) {
    super(message);
    this.name = "GrowthResearchError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export const MAX_RESEARCH_REQUEST_BYTES = 20_000;
export const MAX_RESEARCH_FOCUS_CHARS = 1_000;
export const MAX_RESEARCH_CANDIDATES = 10;
export const MAX_RESEARCH_QUALIFIED = 5;
export const MAX_RESEARCH_SOURCES = 40;
export const MAX_WEB_SEARCH_CALLS = 8;
export const MAX_PROVIDER_OUTPUT_TOKENS = 20_000;
export const PROVIDER_TIMEOUT_MS = 150_000;

const classifications = ["verified_fact", "reasonable_inference", "hypothesis", "unknown"];
const sourceTypes = ["official_brand", "official_retailer", "direct_observation", "trade_business_reporting", "credible_secondary"];

const text = { type: "string" } as const;

export const OPENAI_GROWTH_RESEARCH_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["partial", "limitations", "marketPattern", "candidates"],
  properties: {
    partial: { type: "boolean" },
    limitations: { type: "array", maxItems: 20, items: text },
    marketPattern: text,
    candidates: {
      type: "array",
      minItems: 1,
      maxItems: MAX_RESEARCH_CANDIDATES,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id", "brand", "productOrEvent", "opportunityType", "executiveSummary", "trigger", "whyNow",
          "retailRelevance", "creatorActivity", "shelfNeed", "goshshaWedge", "retailerAssessment", "currentFit",
          "recommendedOffering", "freeFirst", "fastestRevenuePath", "revenuePathRationale", "commercialHypothesis",
          "founderStagePursuitFeasibility", "feasibilityRationale", "confidence", "nextAction", "handoff",
          "knownUnknowns", "evidence", "claims", "scores", "deductions", "caps", "claimedGrossScore",
          "claimedFinalScore", "claimedBand", "selectionStatus"
        ],
        properties: {
          id: text,
          brand: text,
          productOrEvent: text,
          opportunityType: { type: "string", enum: ["Timely Trigger", "Exceptional Structural"] },
          executiveSummary: text,
          trigger: text,
          whyNow: text,
          retailRelevance: text,
          creatorActivity: text,
          shelfNeed: text,
          goshshaWedge: text,
          retailerAssessment: {
            type: "object",
            additionalProperties: false,
            required: ["posture", "dependencyDescription", "evidenceIds"],
            properties: {
              posture: { type: "string", enum: ["retailer_independent", "evidence_supported_dependency"] },
              dependencyDescription: { anyOf: [text, { type: "null" }] },
              evidenceIds: { type: "array", maxItems: 10, items: text },
            },
          },
          currentFit: text,
          recommendedOffering: { type: "string", enum: ["Free First IRL Campaign", "IRL Creator Network", "IRL Retail Media", "Combined", "Unclear"] },
          freeFirst: {
            type: "object",
            additionalProperties: false,
            required: ["recommendation", "intendedLearningOrProofPoint", "paidConversionHypothesis", "scoreContribution"],
            properties: {
              recommendation: { type: "string", enum: ["Recommended", "Not Recommended"] },
              intendedLearningOrProofPoint: text,
              paidConversionHypothesis: { type: "string", enum: ["Product 2", "Multiple Product 2 activations", "Creator Network", "Combined path", "Unclear"] },
              scoreContribution: { type: "number" },
            },
          },
          fastestRevenuePath: { type: "string", enum: ["$75/month IRL Creator Network subscription after 14-day trial", "$99 IRL Retail Media activation", "Multiple IRL Retail Media activations", "IRL Creator Network + IRL Retail Media", "Unclear"] },
          revenuePathRationale: text,
          commercialHypothesis: text,
          founderStagePursuitFeasibility: { type: "string", enum: ["High", "Medium", "Low"] },
          feasibilityRationale: text,
          confidence: { type: "string", enum: ["High", "Medium", "Low"] },
          nextAction: text,
          handoff: { type: "string", enum: ["SALES-01", "Research", "Watch", "Reject"] },
          knownUnknowns: { type: "array", maxItems: 10, items: text },
          evidence: {
            type: "array",
            minItems: 1,
            maxItems: 6,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "publisher", "sourceUrl", "sourceType", "supportedClaim", "classification", "reliability"],
              properties: {
                id: text,
                publisher: text,
                sourceUrl: { type: "string" },
                sourceType: { type: "string", enum: sourceTypes },
                supportedClaim: text,
                classification: { type: "string", enum: classifications },
                reliability: { type: "string", enum: ["high", "medium", "low"] },
              },
            },
          },
          claims: {
            type: "array",
            minItems: 1,
            maxItems: 12,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "claim", "material", "evidenceIds"],
              properties: {
                id: text,
                claim: text,
                material: { type: "boolean" },
                evidenceIds: { type: "array", maxItems: 6, items: text },
              },
            },
          },
          scores: {
            type: "object",
            additionalProperties: false,
            required: ["physicalRetailRelevance", "currentTimelyTrigger", "creatorContentActivity", "shelfEducationNeed", "currentGoshshaFit", "commercialRepeatablePotential", "practicalActionability", "evidenceQualityCompleteness"],
            properties: {
              physicalRetailRelevance: { type: "number" },
              currentTimelyTrigger: { type: "number" },
              creatorContentActivity: { type: "number" },
              shelfEducationNeed: { type: "number" },
              currentGoshshaFit: { type: "number" },
              commercialRepeatablePotential: { type: "number" },
              practicalActionability: { type: "number" },
              evidenceQualityCompleteness: { type: "number" },
            },
          },
          deductions: {
            type: "array",
            maxItems: 6,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["type", "value"],
              properties: {
                type: { type: "string", enum: ["staleTrigger", "speculativeFit", "materialContradiction", "unavailableCapabilityDependency", "unresolvedRightsAssumption", "weakRetailConnection"] },
                value: { type: "number" },
              },
            },
          },
          caps: { type: "array", maxItems: 6, items: { type: "string", enum: ["noVerifiedRetailPresence", "noCurrentTrigger", "unsupportedCentralClaim", "primarilyUnavailableCapability", "unresolvedMaterialContradiction", "noSpecificCurrentProductUse"] } },
          claimedGrossScore: { type: "number" },
          claimedFinalScore: { type: "number" },
          claimedBand: { type: "string", enum: ["Immediate Priority", "Strong Opportunity", "Watch", "Low Priority"] },
          selectionStatus: { type: "string", enum: ["qualified", "watch", "rejected"] },
        },
      },
    },
  },
} as const;

type NativeSource = { url?: unknown; title?: unknown; publication_date?: unknown; published_at?: unknown; page_age?: unknown };
type ProviderCandidate = Omit<GrowthCandidateInput, "evidence" | "deductions"> & {
  evidence: Array<Omit<GrowthCandidateInput["evidence"][number], "accessDate" | "syntheticBenchmark" | "publicationDate"> & { publicationDate?: unknown }>;
  deductions: Array<{ type: keyof NonNullable<GrowthCandidateInput["deductions"]>; value: number }>;
};
type StructuredProposal = { partial: boolean; limitations: string[]; marketPattern: string; candidates: ProviderCandidate[] };

function currentUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validAsOfDate(value: unknown): value is string {
  return typeof value === "string" && validDate(value) && value <= currentUtcDate();
}

export function canonicalizeResearchUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new GrowthResearchError("invalid_source_url", "A provider source URL is not HTTP(S).", 422);
  const fragment = url.hash.slice(1);
  const ordinaryDocumentAnchor = /^[A-Za-z][A-Za-z0-9_-]*$/.test(fragment);
  if (!fragment || ordinaryDocumentAnchor) url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || ["fbclid", "gclid", "mc_cid", "mc_eid"].includes(key.toLowerCase())) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function extractOutputText(response: Record<string, unknown>): string {
  if (typeof response.output_text === "string") return response.output_text;
  const output = Array.isArray(response.output) ? response.output : [];
  return output.flatMap((item) => {
    if (!item || typeof item !== "object" || !Array.isArray((item as { content?: unknown }).content)) return [];
    return ((item as { content: unknown[] }).content).flatMap((content) => {
      if (!content || typeof content !== "object") return [];
      const block = content as { type?: unknown; text?: unknown };
      return block.type === "output_text" && typeof block.text === "string" ? [block.text] : [];
    });
  }).join("");
}

function nativeSourcesFromResponse(response: Record<string, unknown>, asOfDate: string): NormalizedResearchSource[] {
  const output = Array.isArray(response.output) ? response.output : [];
  const rawSources: NativeSource[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const call = item as { type?: unknown; action?: { sources?: unknown } };
    if (call.type === "web_search_call" && Array.isArray(call.action?.sources)) rawSources.push(...call.action.sources as NativeSource[]);
  }
  const deduplicated = new Map<string, NormalizedResearchSource>();
  for (const source of rawSources) {
    if (typeof source.url !== "string") continue;
    const canonicalUrl = canonicalizeResearchUrl(source.url);
    const title = typeof source.title === "string" && source.title.trim()
      ? source.title
      : new URL(canonicalUrl).hostname;
    const nativeDate = source.publication_date ?? source.published_at ?? source.page_age ?? null;
    if (nativeDate != null && (typeof nativeDate !== "string" || !validDate(nativeDate) || nativeDate > currentUtcDate() || nativeDate > asOfDate)) {
      throw new GrowthResearchError("invalid_native_publication_date", "A native provider source contained a malformed or future publication date.", 422);
    }
    if (!deduplicated.has(canonicalUrl)) {
      deduplicated.set(canonicalUrl, {
        id: `source-${deduplicated.size + 1}`,
        rawUrl: source.url,
        canonicalUrl,
        title,
        publicationDate: nativeDate as string | null,
      });
    }
  }
  return [...deduplicated.values()];
}

export function validateGrowthResearchRequest(value: unknown): string[] {
  if (!value || typeof value !== "object") return ["Request body must be an object."];
  const input = value as Partial<GrowthResearchRequest>;
  const errors: string[] = [];
  if (!validAsOfDate(input.asOfDate)) errors.push("asOfDate must be a real YYYY-MM-DD calendar date no later than the server's current UTC date.");
  if (!Array.isArray(input.marketFocus) || input.marketFocus.length === 0 || input.marketFocus.some((item) => !["beauty", "skincare", "haircare"].includes(item))) errors.push("marketFocus must contain approved markets.");
  if (typeof input.founderResearchFocus !== "undefined" && (typeof input.founderResearchFocus !== "string" || input.founderResearchFocus.length > MAX_RESEARCH_FOCUS_CHARS)) errors.push(`founderResearchFocus must be at most ${MAX_RESEARCH_FOCUS_CHARS} characters.`);
  if (!Number.isInteger(input.maximumCandidates) || Number(input.maximumCandidates) < 1 || Number(input.maximumCandidates) > MAX_RESEARCH_CANDIDATES) errors.push(`maximumCandidates must be between 1 and ${MAX_RESEARCH_CANDIDATES}.`);
  if (!Number.isInteger(input.maximumQualified) || Number(input.maximumQualified) < 1 || Number(input.maximumQualified) > MAX_RESEARCH_QUALIFIED) errors.push(`maximumQualified must be between 1 and ${MAX_RESEARCH_QUALIFIED}.`);
  if (!input.budgetAuthority || input.budgetAuthority.confirmedByFounder !== true) errors.push("Founder spending-authority confirmation is required.");
  if (!Number.isFinite(input.budgetAuthority?.growthMonthSpendUsd) || Number(input.budgetAuthority?.growthMonthSpendUsd) < 0) errors.push("Current GROWTH-01 calendar-month spend must be supplied.");
  if (!Number.isFinite(input.budgetAuthority?.commercialDepartmentMonthSpendUsd) || Number(input.budgetAuthority?.commercialDepartmentMonthSpendUsd) < 0) errors.push("Current commercial AI calendar-month spend must be supplied.");
  return errors;
}

export function normalizeOpenAIResearchResponse(params: {
  response: Record<string, unknown>;
  request: GrowthResearchRequest;
  requestedModel: string;
  completedAt: string;
}): GrowthResearchProposal {
  if (!validAsOfDate(params.request.asOfDate)) throw new GrowthResearchError("research_date_invalid", "Research asOfDate must be a real calendar date no later than the server's current UTC date.", 422);
  if (params.response.status !== "completed") throw new GrowthResearchError("provider_incomplete", "Provider response did not complete; no proposal was accepted.");
  const outputText = extractOutputText(params.response);
  if (!outputText) throw new GrowthResearchError("provider_output_missing", "Provider returned no completed structured output.");
  let structured: StructuredProposal;
  try {
    structured = JSON.parse(outputText) as StructuredProposal;
  } catch {
    throw new GrowthResearchError("provider_output_malformed", "Provider structured output was malformed.");
  }
  if (!structured || !Array.isArray(structured.candidates) || structured.candidates.length < 1 || structured.candidates.length > params.request.maximumCandidates) {
    throw new GrowthResearchError("provider_candidate_count_invalid", "Provider returned an invalid candidate count.", 422);
  }
  const nativeSources = nativeSourcesFromResponse(params.response, params.request.asOfDate);
  if (nativeSources.length === 0) throw new GrowthResearchError("native_source_provenance_missing", "Provider returned no native web-search source provenance.", 422);
  const sourceByCanonicalUrl = new Map(nativeSources.map((source) => [source.canonicalUrl, source]));
  const referencedSources = new Map<string, NormalizedResearchSource>();
  const accessDate = params.completedAt.slice(0, 10);
  let qualifiedCount = 0;
  const candidates: GrowthCandidateInput[] = structured.candidates.map((candidate) => {
    if (candidate.selectionStatus === "qualified") qualifiedCount += 1;
    const evidence = candidate.evidence.map((item) => {
      let canonicalUrl: string;
      try {
        canonicalUrl = canonicalizeResearchUrl(item.sourceUrl);
      } catch {
        throw new GrowthResearchError("model_source_url_invalid", `Candidate ${candidate.id} supplied an invalid evidence URL.`, 422);
      }
      const nativeSource = sourceByCanonicalUrl.get(canonicalUrl);
      if (!nativeSource) throw new GrowthResearchError("model_only_source_rejected", `Candidate ${candidate.id} cited a URL absent from native provider provenance.`, 422);
      if (item.publicationDate != null) {
        if (typeof item.publicationDate !== "string" || !validDate(item.publicationDate) || item.publicationDate > currentUtcDate() || item.publicationDate > params.request.asOfDate) throw new GrowthResearchError("publication_date_invalid", `Candidate ${candidate.id} supplied a malformed or future publication date.`, 422);
        if (nativeSource.publicationDate !== item.publicationDate) throw new GrowthResearchError("publication_date_unsupported", `Candidate ${candidate.id} supplied a publication date unsupported by native source metadata.`, 422);
      }
      if (!referencedSources.has(canonicalUrl)) {
        referencedSources.set(canonicalUrl, {
          ...nativeSource,
          id: `source-${referencedSources.size + 1}`,
        });
      }
      return { ...item, sourceUrl: nativeSource.rawUrl, publicationDate: nativeSource.publicationDate, accessDate };
    });
    const deductions = Object.fromEntries(candidate.deductions.map((item) => [item.type, item.value])) as GrowthCandidateInput["deductions"];
    return { ...candidate, evidence, deductions, benchmarkFixture: false };
  });
  if (qualifiedCount > params.request.maximumQualified) throw new GrowthResearchError("provider_qualified_count_invalid", "Provider marked more candidates qualified than the Founder allowed.", 422);
  if (referencedSources.size > MAX_RESEARCH_SOURCES) throw new GrowthResearchError("source_limit_exceeded", `Provider candidates referenced more than ${MAX_RESEARCH_SOURCES} native sources.`, 422);
  const normalizedSources = [...referencedSources.values()];

  const usage = (params.response.usage && typeof params.response.usage === "object" ? params.response.usage : {}) as Record<string, unknown>;
  const outputDetails = (usage.output_tokens_details && typeof usage.output_tokens_details === "object" ? usage.output_tokens_details : {}) as Record<string, unknown>;
  const webSearchCalls = (Array.isArray(params.response.output) ? params.response.output : []).filter((item) => item && typeof item === "object" && (item as { type?: unknown }).type === "web_search_call").length;
  if (webSearchCalls > MAX_WEB_SEARCH_CALLS) throw new GrowthResearchError("web_search_limit_exceeded", "Provider exceeded the approved web-search limit.", 422);

  const proposedRun: GrowthRunRequest = {
    asOfDate: params.request.asOfDate,
    marketFocus: params.request.marketFocus,
    maximumQualified: params.request.maximumQualified,
    marketPattern: structured.marketPattern,
    candidates,
  };
  return {
    provider: "openai",
    requestedModel: params.requestedModel,
    returnedModel: typeof params.response.model === "string" ? params.response.model : "unknown",
    providerRequestId: typeof params.response.id === "string" ? params.response.id : "unknown",
    completedAt: params.completedAt,
    status: structured.partial ? "partial" : "full",
    limitations: Array.isArray(structured.limitations) ? structured.limitations : [],
    usage: {
      inputTokens: typeof usage.input_tokens === "number" ? usage.input_tokens : null,
      outputTokens: typeof usage.output_tokens === "number" ? usage.output_tokens : null,
      totalTokens: typeof usage.total_tokens === "number" ? usage.total_tokens : null,
      reasoningTokens: typeof outputDetails.reasoning_tokens === "number" ? outputDetails.reasoning_tokens : null,
      webSearchCalls,
    },
    normalizedSourceCount: normalizedSources.length,
    sources: normalizedSources,
    proposedRun,
    authority: {
      providerOutput: "untrusted_research_proposal",
      founderApproved: false,
      salesApproved: false,
      crmStateCreated: false,
      authoritativeRevenueOutcomeCreated: false,
      persistence: false,
      externalCommunication: false,
    },
  };
}
