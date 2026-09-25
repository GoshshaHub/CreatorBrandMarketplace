import type { GrowthSalesHandoffEnvelopeV1, SalesIntakeFinding } from "./types";

export function buildSalesIntakeSummary(envelope: GrowthSalesHandoffEnvelopeV1 | null, findings: SalesIntakeFinding[]): string {
  if (!envelope) {
    return `# SALES-01 Intake\n\n**Status:** Validation failed\n\n${findings.map((item) => `- ${item.code}: ${item.message}`).join("\n")}\n`;
  }
  const unknowns = envelope.evidence.knownUnknowns.length ? envelope.evidence.knownUnknowns : ["No supplied unknowns."];
  return [
    "# SALES-01 Phase 1A Intake",
    "",
    "**Status:** Valid for SALES preparation only",
    `**Brand / Product:** ${envelope.opportunity.brand} / ${envelope.opportunity.productOrEvent}`,
    `**Growth score / band:** ${envelope.qualification.score}/100 / ${envelope.qualification.band}`,
    `**Confidence / feasibility:** ${envelope.qualification.confidence} / ${envelope.qualification.founderStagePursuitFeasibility}`,
    `**Goshsha Wedge:** ${envelope.opportunity.goshshaWedge}`,
    `**Retailer posture:** ${envelope.opportunity.retailerAssessment.posture}`,
    `**Free First:** ${envelope.opportunity.freeFirst.recommendation}; $0 proof/acquisition only`,
    `**Paid-path hypothesis:** ${envelope.opportunity.fastestRevenuePath}`,
    `**Trigger date:** ${envelope.opportunity.triggerDate.value || "Unknown"}`,
    `**Physical-scan experience:** ${envelope.opportunity.physicalScanExperience.value || "Unknown"}`,
    `**Content rights:** ${envelope.boundarySnapshot.rightsStatus}`,
    `**Regulated-claim classifications:** ${envelope.boundarySnapshot.regulatedClaims.length ? envelope.boundarySnapshot.regulatedClaims.map((item) => `${item.claimId}=${item.classification}`).join("; ") : "None identified in supplied material claims"}`,
    "**Known unknowns:**",
    ...unknowns.map((item) => `- ${item}`),
    "",
    "**Authority:** No contact research, message generation, persistence, CRM write, REVENUE/CLOSER invocation, or external action is authorized.",
    `**Candidate SHA-256:** ${envelope.candidate.candidateSha256}`,
    `**Envelope SHA-256:** ${envelope.envelope.payloadSha256}`,
    "",
  ].join("\n");
}
