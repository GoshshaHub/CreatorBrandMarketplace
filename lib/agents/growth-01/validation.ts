import type {
  CandidateValidation,
  GrowthCandidateInput,
  GrowthRunRequest,
  ScoredCandidate,
  ValidationFinding,
} from "./types";

export const MAX_GROWTH_CANDIDATES = 25;
export const MAX_QUALIFIED_RESULTS = 5;
export const MAX_GROWTH_REQUEST_BYTES = 250_000;

const PAID_REVENUE_PATHS = new Set([
  "$75/month IRL Creator Network subscription after 14-day trial",
  "$99 IRL Retail Media activation",
  "Multiple IRL Retail Media activations",
  "IRL Creator Network + IRL Retail Media",
  "Unclear",
]);

function nonEmpty(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function validDate(value: unknown): boolean {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function validHttpUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function validateGrowthCandidate(candidate: ScoredCandidate): CandidateValidation {
  const findings: ValidationFinding[] = [];
  const requiredText: Array<[string, unknown]> = [
    ["brand", candidate.brand],
    ["productOrEvent", candidate.productOrEvent],
    ["executiveSummary", candidate.executiveSummary],
    ["trigger", candidate.trigger],
    ["whyNow", candidate.whyNow],
    ["retailRelevance", candidate.retailRelevance],
    ["creatorActivity", candidate.creatorActivity],
    ["shelfNeed", candidate.shelfNeed],
    ["goshshaWedge", candidate.goshshaWedge],
    ["currentFit", candidate.currentFit],
    ["revenuePathRationale", candidate.revenuePathRationale],
    ["commercialHypothesis", candidate.commercialHypothesis],
    ["feasibilityRationale", candidate.feasibilityRationale],
    ["nextAction", candidate.nextAction],
    ["freeFirst.intendedLearningOrProofPoint", candidate.freeFirst?.intendedLearningOrProofPoint],
  ];

  for (const [field, value] of requiredText) {
    if (!nonEmpty(value)) {
      findings.push({ code: "required_field_missing", severity: "error", candidateId: candidate.id, field, message: `${field} is required.` });
    }
  }

  if (candidate.freeFirst?.scoreContribution !== 0) {
    findings.push({
      code: "free_first_score_forbidden",
      severity: "error",
      candidateId: candidate.id,
      field: "freeFirst.scoreContribution",
      message: "Free First is an acquisition/proof mechanism and must contribute zero score points.",
    });
  }

  if (!PAID_REVENUE_PATHS.has(candidate.fastestRevenuePath)) {
    findings.push({
      code: "invalid_fastest_revenue_path",
      severity: "error",
      candidateId: candidate.id,
      field: "fastestRevenuePath",
      message: "Fastest Revenue Path must identify an approved paid destination or Unclear; it cannot terminate at Free First.",
    });
  }

  const evidenceById = new Map(candidate.evidence.map((item) => [item.id, item]));
  for (const evidence of candidate.evidence) {
    if (!evidence.id || !nonEmpty(evidence.publisher) || !nonEmpty(evidence.supportedClaim)) {
      findings.push({ code: "evidence_incomplete", severity: "error", candidateId: candidate.id, field: `evidence.${evidence.id || "unknown"}`, message: "Evidence requires an ID, publisher, and supported claim." });
    }
    if (!validHttpUrl(evidence.sourceUrl)) {
      findings.push({ code: "evidence_url_invalid", severity: "error", candidateId: candidate.id, field: `evidence.${evidence.id}.sourceUrl`, message: "Evidence requires a valid HTTP(S) source URL." });
    }
    if (!validDate(evidence.accessDate)) {
      findings.push({ code: "evidence_access_date_invalid", severity: "error", candidateId: candidate.id, field: `evidence.${evidence.id}.accessDate`, message: "Evidence requires an access date in YYYY-MM-DD form." });
    }
    if (evidence.publicationDate != null && !validDate(evidence.publicationDate)) {
      findings.push({ code: "evidence_publication_date_invalid", severity: "error", candidateId: candidate.id, field: `evidence.${evidence.id}.publicationDate`, message: "Publication date must use YYYY-MM-DD when supplied." });
    }
    if (evidence.sourceType === "founder_supplied_benchmark" && evidence.syntheticBenchmark !== true) {
      findings.push({ code: "benchmark_label_missing", severity: "error", candidateId: candidate.id, field: `evidence.${evidence.id}.syntheticBenchmark`, message: "Founder-supplied benchmark evidence must be explicitly labeled synthetic/benchmark." });
    }
  }

  for (const claim of candidate.claims) {
    if (claim.material && claim.evidenceIds.length === 0) {
      findings.push({ code: "material_claim_missing_evidence", severity: "error", candidateId: candidate.id, field: `claims.${claim.id}`, message: `Material claim "${claim.claim}" has no evidence.` });
    }
    for (const evidenceId of claim.evidenceIds) {
      if (!evidenceById.has(evidenceId)) {
        findings.push({ code: "claim_evidence_not_found", severity: "error", candidateId: candidate.id, field: `claims.${claim.id}`, message: `Claim references missing evidence ${evidenceId}.` });
      }
    }
  }

  if (candidate.retailerAssessment?.posture === "evidence_supported_dependency") {
    if (!nonEmpty(candidate.retailerAssessment.dependencyDescription)) {
      findings.push({ code: "retailer_dependency_description_missing", severity: "error", candidateId: candidate.id, field: "retailerAssessment.dependencyDescription", message: "An affirmative retailer dependency requires a specific description." });
    }
    const dependencyEvidence = candidate.retailerAssessment.evidenceIds || [];
    if (dependencyEvidence.length === 0 || dependencyEvidence.some((id) => !evidenceById.has(id))) {
      findings.push({ code: "retailer_dependency_evidence_missing", severity: "error", candidateId: candidate.id, field: "retailerAssessment.evidenceIds", message: "An affirmative retailer dependency requires linked evidence." });
    }
  }

  if (candidate.selectionStatus === "qualified" && candidate.computed.finalScore < 65) {
    findings.push({ code: "qualification_score_inconsistent", severity: "error", candidateId: candidate.id, field: "selectionStatus", message: "Qualified opportunities must be in the Strong Opportunity or Immediate Priority band." });
  }
  if (candidate.selectionStatus === "watch" && candidate.computed.band !== "Watch") {
    findings.push({ code: "watch_score_inconsistent", severity: "error", candidateId: candidate.id, field: "selectionStatus", message: "Watch status must match the Watch score band." });
  }
  if (candidate.opportunityType === "Exceptional Structural" && candidate.scores.currentTimelyTrigger > 0 && !nonEmpty(candidate.trigger)) {
    findings.push({ code: "structural_trigger_unexplained", severity: "error", candidateId: candidate.id, field: "trigger", message: "Structural opportunities receive only trigger points supported by an explicit trigger." });
  }

  return { valid: findings.every((item) => item.severity !== "error"), findings };
}

export function validateGrowthRunRequest(input: GrowthRunRequest): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  if (!validDate(input.asOfDate)) {
    findings.push({ code: "run_date_invalid", severity: "error", field: "asOfDate", message: "asOfDate must use YYYY-MM-DD." });
  }
  if (!Array.isArray(input.marketFocus) || input.marketFocus.length === 0 || input.marketFocus.some((value) => !["beauty", "skincare", "haircare"].includes(value))) {
    findings.push({ code: "market_focus_invalid", severity: "error", field: "marketFocus", message: "Select at least one approved initial market focus." });
  }
  if (!Array.isArray(input.candidates) || input.candidates.length === 0 || input.candidates.length > MAX_GROWTH_CANDIDATES) {
    findings.push({ code: "candidate_count_invalid", severity: "error", field: "candidates", message: `Provide between 1 and ${MAX_GROWTH_CANDIDATES} candidates.` });
  }
  const maximumQualified = input.maximumQualified ?? MAX_QUALIFIED_RESULTS;
  if (!Number.isInteger(maximumQualified) || maximumQualified < 1 || maximumQualified > MAX_QUALIFIED_RESULTS) {
    findings.push({ code: "maximum_qualified_invalid", severity: "error", field: "maximumQualified", message: `maximumQualified must be between 1 and ${MAX_QUALIFIED_RESULTS}.` });
  }
  const ids = new Set<string>();
  for (const candidate of input.candidates || []) {
    if (!candidate?.id || ids.has(candidate.id)) {
      findings.push({ code: "candidate_id_invalid", severity: "error", candidateId: candidate?.id, field: "id", message: "Candidate IDs are required and must be unique." });
    }
    ids.add(candidate?.id);
  }
  return findings;
}

export function validateQualifiedCount(candidates: ScoredCandidate[], maximumQualified: number): ValidationFinding[] {
  const qualifiedCount = candidates.filter((candidate) => candidate.selectionStatus === "qualified").length;
  if (qualifiedCount > maximumQualified) {
    return [{ code: "qualified_limit_exceeded", severity: "error", field: "candidates", message: `Qualified result count ${qualifiedCount} exceeds the approved maximum ${maximumQualified}.` }];
  }
  return [];
}
