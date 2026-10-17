import { revenueSha256, revenueStableId } from "../revenue-01/canonical";

export const GROWTH_COMMERCIAL_OUTCOME_FEEDBACK_VERSION = "growth-commercial-outcome-feedback-v2" as const;
export const GROWTH_COMMERCIAL_OUTCOME_FEEDBACK_CANONICALIZATION = "growth-commercial-outcome-feedback-canonical-json-v1" as const;

export function buildGrowthCommercialOutcomeFeedback(params: {
  accountId: string;
  pursuitId: string;
  growthCandidateSha256: string;
  crmRevisionSetSha256: string;
  interactions: Array<{ interactionId: string; type: string; exactAttributedStatement: string | null; occurredAt: string; classification?: string; evidenceAuthenticity?: "authentic" | "synthetic" | "unknown"; authenticCommercialLearningEligible?: boolean }>;
  salesPlaybookArtifactId: string;
  salesPlaybookArtifactSha256: string;
  revenueRecommendationId: string;
  revenueRecommendationFamily: string;
  generatedAt: string;
}) {
  const classifiedOutcomes = params.interactions.map((interaction) => ({
    interactionId: interaction.interactionId,
    type: interaction.type,
    exactAttributedStatement: interaction.exactAttributedStatement,
    occurredAt: interaction.occurredAt,
    classification: interaction.classification ?? "attributed_statement",
    evidenceAuthenticity: interaction.evidenceAuthenticity === "authentic" ? "authentic" as const : interaction.evidenceAuthenticity === "synthetic" ? "synthetic" as const : "unknown" as const,
    authenticCommercialLearningEligible: interaction.evidenceAuthenticity === "authentic" && interaction.authenticCommercialLearningEligible === true,
  }));
  const attributedOutcomes = classifiedOutcomes.filter((interaction) => interaction.authenticCommercialLearningEligible);
  const excludedOutcomes = classifiedOutcomes.filter((interaction) => !interaction.authenticCommercialLearningEligible).map((interaction) => ({ ...interaction, exclusionReason: interaction.evidenceAuthenticity === "synthetic" ? "synthetic_evidence" as const : "authenticity_unknown_or_ineligible" as const }));
  const body = {
    schemaVersion: GROWTH_COMMERCIAL_OUTCOME_FEEDBACK_VERSION,
    canonicalizationVersion: GROWTH_COMMERCIAL_OUTCOME_FEEDBACK_CANONICALIZATION,
    binding: {
      accountId: params.accountId,
      pursuitId: params.pursuitId,
      growthCandidateSha256: params.growthCandidateSha256,
      crmRevisionSetSha256: params.crmRevisionSetSha256,
      salesPlaybookArtifactId: params.salesPlaybookArtifactId,
      salesPlaybookArtifactSha256: params.salesPlaybookArtifactSha256,
      revenueRecommendationId: params.revenueRecommendationId,
    },
    recommendationFamily: params.revenueRecommendationFamily,
    attributedOutcomes,
    excludedOutcomes,
    generatedAt: params.generatedAt,
    authority: { growthRunAuthorized: false as const, providerRequestAuthorized: false as const, crmMutationAuthorized: false as const, externalActionAuthorized: false as const },
  };
  return { ...body, feedbackId: revenueStableId("growthfeedback", body), feedbackSha256: revenueSha256(body) };
}
