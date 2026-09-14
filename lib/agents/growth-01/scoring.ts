import type {
  Deductions,
  GrowthCandidateInput,
  ScoreBand,
  ScoreCap,
  ScoreCategory,
  ScoredCandidate,
  ValidationFinding,
} from "./types";

export const SCORE_CATEGORY_LIMITS = {
  physicalRetailRelevance: 18,
  currentTimelyTrigger: 15,
  creatorContentActivity: 15,
  shelfEducationNeed: 15,
  currentGoshshaFit: 12,
  commercialRepeatablePotential: 10,
  practicalActionability: 5,
  evidenceQualityCompleteness: 10,
} as const;

export const DEDUCTION_LIMITS = {
  staleTrigger: { min: 5, max: 15 },
  speculativeFit: { min: 5, max: 10 },
  materialContradiction: { min: 10, max: 20 },
  unavailableCapabilityDependency: { min: 5, max: 20 },
  unresolvedRightsAssumption: { min: 5, max: 15 },
  weakRetailConnection: { min: 5, max: 10 },
} as const;

export const SCORE_CAPS = {
  noVerifiedRetailPresence: 59,
  noCurrentTrigger: 64,
  unsupportedCentralClaim: 49,
  primarilyUnavailableCapability: 49,
  unresolvedMaterialContradiction: 49,
  noSpecificCurrentProductUse: 64,
} as const;

export const MAX_GROWTH_SCORE = Object.values(SCORE_CATEGORY_LIMITS).reduce(
  (total, value) => total + value,
  0
);

export function deriveScoreBand(score: number): ScoreBand {
  if (score >= 80) return "Immediate Priority";
  if (score >= 65) return "Strong Opportunity";
  if (score >= 50) return "Watch";
  return "Low Priority";
}

function scoreRangeFindings(candidate: GrowthCandidateInput): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  for (const [category, maximum] of Object.entries(SCORE_CATEGORY_LIMITS) as Array<[ScoreCategory, number]>) {
    const value = candidate.scores?.[category];
    if (!Number.isFinite(value) || value < 0 || value > maximum) {
      findings.push({
        code: "score_out_of_range",
        severity: "error",
        candidateId: candidate.id,
        field: `scores.${category}`,
        message: `${category} must be between 0 and ${maximum}.`,
      });
    }
  }

  return findings;
}

function deductionFindings(candidateId: string, deductions: Deductions): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  for (const [type, value] of Object.entries(deductions)) {
    const limits = DEDUCTION_LIMITS[type as keyof typeof DEDUCTION_LIMITS];
    if (!limits || !Number.isFinite(value) || value! < limits.min || value! > limits.max) {
      findings.push({
        code: "deduction_out_of_range",
        severity: "error",
        candidateId,
        field: `deductions.${type}`,
        message: limits
          ? `${type} must be between ${limits.min} and ${limits.max} when applied.`
          : `${type} is not an approved GROWTH-01 deduction.`,
      });
    }
  }

  return findings;
}

export function scoreGrowthCandidate(candidate: GrowthCandidateInput): {
  candidate: ScoredCandidate;
  findings: ValidationFinding[];
} {
  const findings = [
    ...scoreRangeFindings(candidate),
    ...deductionFindings(candidate.id, candidate.deductions || {}),
  ];

  const grossScore = (Object.keys(SCORE_CATEGORY_LIMITS) as ScoreCategory[]).reduce(
    (total, category) => total + (Number.isFinite(candidate.scores?.[category]) ? candidate.scores[category] : 0),
    0
  );
  const deductionTotal = Object.values(candidate.deductions || {}).reduce(
    (total, value) => total + (Number.isFinite(value) ? Number(value) : 0),
    0
  );
  const scoreBeforeCap = Math.max(0, grossScore - deductionTotal);
  const requestedCaps = candidate.caps || [];
  const capValues = requestedCaps.map((cap) => SCORE_CAPS[cap]).filter(Number.isFinite);
  const applicableCap = capValues.length > 0 ? Math.min(...capValues) : null;
  const finalScore = Math.max(0, applicableCap == null ? scoreBeforeCap : Math.min(scoreBeforeCap, applicableCap));
  const band = deriveScoreBand(finalScore);

  if (candidate.claimedGrossScore != null && candidate.claimedGrossScore !== grossScore) {
    findings.push({
      code: "claimed_gross_mismatch",
      severity: "error",
      candidateId: candidate.id,
      field: "claimedGrossScore",
      message: `Claimed gross score ${candidate.claimedGrossScore} does not match computed gross score ${grossScore}.`,
    });
  }
  if (candidate.claimedFinalScore != null && candidate.claimedFinalScore !== finalScore) {
    findings.push({
      code: "claimed_final_mismatch",
      severity: "error",
      candidateId: candidate.id,
      field: "claimedFinalScore",
      message: `Claimed final score ${candidate.claimedFinalScore} does not match computed final score ${finalScore}.`,
    });
  }
  if (candidate.claimedBand != null && candidate.claimedBand !== band) {
    findings.push({
      code: "claimed_band_mismatch",
      severity: "error",
      candidateId: candidate.id,
      field: "claimedBand",
      message: `Claimed band ${candidate.claimedBand} does not match computed band ${band}.`,
    });
  }

  return {
    candidate: {
      ...candidate,
      computed: {
        grossScore,
        deductionTotal,
        scoreBeforeCap,
        applicableCap,
        finalScore,
        band,
      },
    },
    findings,
  };
}

export function scoreCapValue(cap: ScoreCap): number {
  return SCORE_CAPS[cap];
}
