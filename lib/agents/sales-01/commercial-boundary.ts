export type SalesCommercialBoundaryKind = "commercial_promise" | "audience_claim";
export type SalesCommercialBoundaryReason =
  | "affirmative_promise"
  | "mixed_clause"
  | "remote_negation"
  | "ambiguous_language"
  | "double_negative";

export type SalesCommercialBoundaryFinding = {
  fieldPath: string;
  boundary: SalesCommercialBoundaryKind;
  reason: SalesCommercialBoundaryReason;
  matchedCategory: "guarantee" | "discount" | "custom_scope" | "performance" | "audience" | "attribution";
  statement: string;
};

type PatternDefinition = {
  boundary: SalesCommercialBoundaryKind;
  pattern: RegExp;
};

const COMMERCIAL_PROMISE = /\b(?:guaranteed results?|guaranteed roi|custom entitlement|custom implementation|discount(?:ed)?|guarantee[ds]?|promise[sd]?\s+(?:reach|views?|sales lift|conversion|roi|results?)|(?:will|would)\s+(?:deliver|increase|improve|drive)\b.{0,30}\b(?:reach|views?|sales|sales lift|conversion|roi|results?))\b/gi;
const AUDIENCE_CLAIM = /\b(?:massive|large|millions? of|guaranteed)\b.{0,30}\b(?:audience|users?|reach|impressions?|views?)\b|\b(?:all|every)\b.{0,20}\b(?:shopper|customer)\b.{0,20}\b(?:uses?|has|will)\b.{0,10}\bGoshsha\b|\b(?:guaranteed|causal)\b.{0,30}\b(?:sales lift|conversion|roi|attribution)\b/gi;

const PATTERNS: PatternDefinition[] = [
  { boundary: "commercial_promise", pattern: COMMERCIAL_PROMISE },
  { boundary: "audience_claim", pattern: AUDIENCE_CLAIM },
];

const AMBIGUOUS_PREFIX = /\b(?:unclear|unknown|uncertain|ambiguous|possible|possibly|perhaps|maybe)\b(?:(?![.!?;]).){0,80}\b(?:whether|if)?\s*$/i;
const DOUBLE_NEGATIVE_PREFIX = /\b(?:not\s+(?:fail|unable|unlikely|impossible|not)|never\s+fail)\b(?:(?![.!?;]).){0,80}$/i;
const DIRECT_VERB_NEGATION = /\b(?:does|do|did|will|would|can|could|may|might|is|are|was|were|has|have|had|should|must)\s+not\s+(?:(?:establish|represent|imply|promise|offer|provide|include|authorize|require|grant|create|constitute|have)\s+or\s+)*(?:(?:establish|represent|imply|promise|offer|provide|include|authorize|require|grant|create|constitute|have)\s+)?(?:a|an|any|the)?\s*$/i;
const ACTIVE_PROHIBITION = /\bdo\s+not\s+(?:position|describe|present|represent|market|treat)\b(?:(?![.!?;]).){0,120}\bas\s+(?:a|an|any|the)?\s*(?:an?\s+)?(?:approved|standard|supported)?\s*$/i;
const PASSIVE_PROHIBITION_START = /\b(?:should|must|can|could|may|might|will|would|is|are|was|were)\s+not\s+be\s+(?:represented|positioned|described|presented|marketed|treated)\s+as\s*/ig;
const CONDITIONAL_COMMERCIAL_BOUNDARY = /\b(?:discount|custom entitlement|custom implementation)\b(?:(?![.!?;]).){0,120}\b(?:requires?|would require)\b(?:(?![.!?;]).){0,80}\b(?:separate|explicit|founder)\b(?:(?![.!?;]).){0,40}\b(?:approval|authorization)\b(?:(?![.!?;]).){0,100}\b(?:not authorized|not included|not offered|not available)\b/i;

const GOVERNED_LIST_ITEMS = [
  "audience",
  "audience delivery",
  "causal attribution",
  "causal sales attribution",
  "conversion",
  "custom entitlement",
  "custom implementation",
  "discount",
  "discounted pricing",
  "guaranteed audience delivery",
  "guaranteed conversion",
  "guaranteed reach",
  "guaranteed results",
  "guaranteed roi",
  "guaranteed sales lift",
  "impressions",
  "reach",
  "results",
  "roi",
  "sales",
  "sales attribution",
  "sales lift",
  "shopper identity",
  "retailer data",
  "retailer endorsement",
  "retailer approval",
  "conversion guarantee",
  "reach guarantee",
  "sales guarantee",
  "results guarantee",
  "roi guarantee",
  "views",
];

function semanticClauses(value: string): string[] {
  return value
    .split(/(?:[.!?;]\s+|,\s*(?=(?:but|however|yet|although|though)\b)|\s+(?=(?:but|however|yet|although|though)\b))/i)
    .map((clause) => clause.trim())
    .filter(Boolean);
}

function patternMatches(value: string, pattern: RegExp): RegExpMatchArray[] {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return Array.from(value.matchAll(new RegExp(pattern.source, flags)));
}

function normalizeGovernedList(value: string): string[] | null {
  const items = value
    .replace(/\s+(?:and|or)\s*$/i, "")
    .replace(/^[\s,:-]+|[\s,:-]+$/g, "")
    .split(/\s*,\s*|\s+(?:and|or)\s+/i)
    .map((item) => item.trim().replace(/^(?:and|or)\s+/i, "").replace(/^(?:a|an|any|the)(?:\s+|$)/i, "").toLowerCase())
    .filter(Boolean);
  if (!items.length) return [];
  return items.every((item) => GOVERNED_LIST_ITEMS.includes(item)) ? items : null;
}

function lastPatternEnd(value: string, pattern: RegExp): number | null {
  const matches = patternMatches(value, pattern);
  if (!matches.length) return null;
  const match = matches.at(-1)!;
  return (match.index || 0) + match[0].length;
}

function locallyGoverned(prefix: string): boolean {
  if (DIRECT_VERB_NEGATION.test(prefix) || /\b(?:rather\s+than|instead\s+of)\s+(?:a|an|any|the)?\s*$/i.test(prefix) || ACTIVE_PROHIBITION.test(prefix)) return true;

  const passiveEnd = lastPatternEnd(prefix, PASSIVE_PROHIBITION_START);
  if (passiveEnd !== null && normalizeGovernedList(prefix.slice(passiveEnd)) !== null) return true;

  const notMatches = patternMatches(prefix, /\bnot\s+/ig);
  if (notMatches.length) {
    const lastNot = notMatches.at(-1)!;
    const afterNot = prefix.slice((lastNot.index || 0) + lastNot[0].length);
    if (normalizeGovernedList(afterNot) !== null) return true;
  }

  const noMatches = patternMatches(prefix, /(?:^|[,:;]\s*)no\s+/ig);
  if (!noMatches.length) return false;
  const lastNo = noMatches.at(-1)!;
  return normalizeGovernedList(prefix.slice((lastNo.index || 0) + lastNo[0].length)) !== null;
}

function categoryFor(match: string, boundary: SalesCommercialBoundaryKind): SalesCommercialBoundaryFinding["matchedCategory"] {
  const value = match.toLowerCase();
  if (/discount/.test(value)) return "discount";
  if (/custom/.test(value)) return "custom_scope";
  if (/attribution/.test(value)) return "attribution";
  if (boundary === "audience_claim" || /audience|users?|reach|impressions?|views?/.test(value)) return "audience";
  if (/sales|conversion|roi|results?|deliver|increase|improve|drive/.test(value)) return "performance";
  return "guarantee";
}

function reasonFor(clause: string, prefix: string): SalesCommercialBoundaryReason {
  if (DOUBLE_NEGATIVE_PREFIX.test(prefix)) return "double_negative";
  if (AMBIGUOUS_PREFIX.test(prefix)) return "ambiguous_language";
  if (/\b(?:but|however|yet|although|though)\b/i.test(clause)) return "mixed_clause";
  if (/\bnot\b/i.test(prefix)) return "remote_negation";
  return "affirmative_promise";
}

export function analyzeSalesCommercialBoundary(fieldPath: string, statement: string): SalesCommercialBoundaryFinding[] {
  const findings: SalesCommercialBoundaryFinding[] = [];
  if (/^\s*(?:will|would|can|could|does|do|is|are|should|may|might)\b[^.!]*\?\s*$/i.test(statement)) return findings;
  for (const clause of semanticClauses(statement)) {
    for (const { boundary, pattern } of PATTERNS) {
      let priorGovernedMatch: RegExpMatchArray | null = null;
      for (const match of patternMatches(clause, pattern)) {
        const index = match.index || 0;
        const prefix = clause.slice(0, index).slice(-220);
        const matchedCategory = categoryFor(match[0], boundary);
        if (boundary === "commercial_promise" && ["discount", "custom_scope"].includes(matchedCategory) && CONDITIONAL_COMMERCIAL_BOUNDARY.test(clause)) continue;
        if (locallyGoverned(prefix)) {
          priorGovernedMatch = match;
          continue;
        }
        const connective = priorGovernedMatch
          ? clause.slice((priorGovernedMatch.index || 0) + priorGovernedMatch[0].length, index)
          : "";
        const inheritsGovernedScope = Boolean(priorGovernedMatch)
          && /^(?:discount(?:ed)?|custom entitlement|custom implementation)$/i.test(match[0])
          && /^\s*(?:,?\s*(?:and|or)\s+)?(?:a|an|any|the)?\s*$/i.test(connective);
        if (inheritsGovernedScope) continue;
        findings.push({
          fieldPath,
          boundary,
          reason: reasonFor(clause, prefix),
          matchedCategory,
          statement,
        });
      }
    }
  }
  return findings;
}

export function collectSalesCommercialBoundaryFindings(fields: Array<{ fieldPath: string; statement: unknown }>): SalesCommercialBoundaryFinding[] {
  return fields.flatMap(({ fieldPath, statement }) => typeof statement === "string" ? analyzeSalesCommercialBoundary(fieldPath, statement) : []);
}
