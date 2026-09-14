import type { ScoredCandidate, ValidationFinding } from "./types";

function cleanLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function buildDailyBriefMarkdown(params: {
  asOfDate: string;
  marketPattern?: string;
  candidates: ScoredCandidate[];
  findings: ValidationFinding[];
}): string {
  const qualified = params.candidates
    .filter((candidate) => candidate.selectionStatus === "qualified")
    .sort((a, b) => b.computed.finalScore - a.computed.finalScore);
  const immediate = qualified.filter((candidate) => candidate.computed.band === "Immediate Priority").length;
  const strong = qualified.filter((candidate) => candidate.computed.band === "Strong Opportunity").length;
  const structural = qualified.filter((candidate) => candidate.opportunityType === "Exceptional Structural").length;
  const watch = params.candidates.filter((candidate) => candidate.selectionStatus === "watch").length;
  const lines = [
    `# GROWTH-01 Daily Brief — ${params.asOfDate}`,
    "",
    `**Qualified / Immediate / Strong / Structural / Watch:** ${qualified.length} / ${immediate} / ${strong} / ${structural} / ${watch}`,
    `**Founder decisions:** ${qualified.length ? "Review qualified opportunities for SALES-01 handoff" : "No qualified handoff recommended"}`,
    `**Market pattern:** ${cleanLine(params.marketPattern || "No Founder-supplied market pattern.")}`,
  ];

  for (const candidate of qualified) {
    const evidenceLinks = candidate.evidence.slice(0, 5).map((item) => `${item.publisher} — ${item.publicationDate || item.accessDate} — ${item.supportedClaim} — ${item.sourceUrl}`);
    lines.push(
      "",
      `### ${cleanLine(candidate.brand)} — ${cleanLine(candidate.productOrEvent)}`,
      "",
      `**Score/Band/Confidence:** ${candidate.computed.finalScore}/100 / ${candidate.computed.band} / ${candidate.confidence}`,
      `**Founder-Stage Pursuit Feasibility:** ${candidate.founderStagePursuitFeasibility}`,
      `**Feasibility rationale:** ${cleanLine(candidate.feasibilityRationale)}`,
      `**Opportunity type:** ${candidate.opportunityType}`,
      `**Trigger:** ${cleanLine(candidate.trigger)}`,
      `**Why now:** ${cleanLine(candidate.whyNow)}`,
      `**Goshsha Wedge:** ${cleanLine(candidate.goshshaWedge)}`,
      `**Retailer independence / Evidence-supported dependency:** ${candidate.retailerAssessment.posture === "retailer_independent" ? "Retailer-independent" : cleanLine(candidate.retailerAssessment.dependencyDescription || "Dependency evidence incomplete")}`,
      `**Recommended offering:** ${candidate.recommendedOffering}`,
      `**Free First acquisition role:** ${candidate.freeFirst.recommendation}`,
      `**Intended learning or proof point:** ${cleanLine(candidate.freeFirst.intendedLearningOrProofPoint)}`,
      `**Paid conversion hypothesis:** ${candidate.freeFirst.paidConversionHypothesis}`,
      `**Fastest Revenue Path:** ${candidate.fastestRevenuePath}`,
      `**Revenue-path rationale:** ${cleanLine(candidate.revenuePathRationale)}`,
      `**Evidence strength / Known gap:** ${candidate.confidence}; ${cleanLine(candidate.knownUnknowns.join("; ") || "No supplied unknowns")}`,
      `**Next action / Handoff:** ${candidate.handoff} — ${cleanLine(candidate.nextAction)}`,
      `**Scoring:** gross ${candidate.computed.grossScore}; deductions ${candidate.computed.deductionTotal}; cap ${candidate.computed.applicableCap ?? "none"}; final ${candidate.computed.finalScore}`,
      "**Key sources:**",
      ...evidenceLinks.map((item) => `- ${item}`)
    );
  }

  const watchItems = params.candidates.filter((candidate) => candidate.selectionStatus === "watch");
  if (watchItems.length > 0) {
    lines.push("", "## Watch / Rescore", ...watchItems.map((candidate) => `- ${candidate.brand} — ${candidate.productOrEvent}: ${candidate.nextAction}`));
  }
  const errors = params.findings.filter((finding) => finding.severity === "error");
  if (errors.length > 0) {
    lines.push("", "## Validation Failed", ...errors.map((finding) => `- ${finding.candidateId || "run"}: ${finding.message}`));
  }

  return `${lines.join("\n")}\n`;
}
