import type { GrowthResearchProviderContext } from "./research-types";

export function buildGrowthResearchInstructions(context: GrowthResearchProviderContext): string {
  return [
    "# GROWTH-01 Provider Research Projection",
    `Projection version: ${context.providerProjection.version}\nProjection SHA-256: ${context.providerProjection.sha256}\nPaired frozen GROWTH-01 contract version: ${context.contractVersion}\nPaired frozen contract SHA-256: ${context.contractSha256}`,
    context.providerProjection.body,
    "## Runtime parameters",
    `Research date: ${context.asOfDate}\nMarket priority 1: ${context.marketPriority.priority1.join(", ")}\nMarket priority 2: ${context.marketPriority.priority2.join(", ")}\nMarket priority 3: ${context.marketPriority.priority3.join(", ")}\nFounder research focus: ${context.founderResearchFocus || "No additional focus supplied."}\nMaximum proposed candidates: ${context.maximumCandidates}\nMaximum candidates marked qualified: ${context.maximumQualified}\nReturn at most those limits. Current application ceilings are 10 proposed and 5 qualified. Never lower quality to fill either limit.`,
    "Return only the strict structured output requested by the API schema. The proposal remains untrusted and requires deterministic application validation and Founder review before any downstream use.",
  ].join("\n\n");
}
