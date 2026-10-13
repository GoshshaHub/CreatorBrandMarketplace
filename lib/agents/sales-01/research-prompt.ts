import type { SalesResearchProviderContext } from "./research-types";
import { verifyCommercialPositioning } from "../commercial-positioning";

export const GOSHSHHA_CAPABILITY_FACTS = {
  "cap-free-first": "Free First is $0, one product, one properly licensed uploaded video, 30 days, first 250 qualified views, and is a proof/acquisition mechanism rather than revenue.",
  "cap-retail-media": "IRL Retail Media is $99 for one product, one video, 90 days, and the first 1,000 qualified views.",
  "cap-creator-network": "Creator Network has a 14-day trial with card and then costs $75/month.",
  "cap-retailer-independent": "Goshsha is a consumer-initiated digital layer on the shopper's own device and does not require retailer participation unless a specific workflow depends on retailer-controlled infrastructure or authorization.",
} as const;

export function buildSalesResearchInstructions(context: SalesResearchProviderContext): string {
  const envelope = context.envelope;
  const commercialPositioning = context.commercialPositioning ?? verifyCommercialPositioning();
  return [
    "# SALES-01 Provider Intelligence Projection",
    `Projection version: ${context.providerProjection.version}\nProjection SHA-256: ${context.providerProjection.sha256}\nPaired SALES contract: ${context.salesContract.version}\nContract SHA-256: ${context.salesContract.sha256}`,
    context.providerProjection.body,
    "## Founder-owned canonical commercial positioning",
    JSON.stringify(commercialPositioning),
    "## Immutable GROWTH qualification",
    JSON.stringify({
      candidateId: envelope.candidate.candidateId,
      brand: envelope.opportunity.brand,
      productOrEvent: envelope.opportunity.productOrEvent,
      score: envelope.qualification.score,
      band: envelope.qualification.band,
      confidence: envelope.qualification.confidence,
      feasibility: envelope.qualification.founderStagePursuitFeasibility,
      trigger: envelope.opportunity.trigger,
      whyNow: envelope.opportunity.whyNow,
      wedge: envelope.opportunity.goshshaWedge,
      retailerAssessment: envelope.opportunity.retailerAssessment,
      freeFirst: envelope.opportunity.freeFirst,
      fastestRevenuePath: envelope.opportunity.fastestRevenuePath,
      evidence: envelope.evidence.items.map((item) => ({ id: item.id, publisher: item.publisher, url: item.sourceUrl, supportedClaim: item.supportedClaim, classification: item.classification })),
      materialClaims: envelope.evidence.materialClaims,
      knownUnknowns: envelope.evidence.knownUnknowns,
      boundarySnapshot: envelope.boundarySnapshot,
    }),
    "## Server-controlled capability facts",
    JSON.stringify(GOSHSHHA_CAPABILITY_FACTS),
    "## Exact evidence-reference namespaces",
    JSON.stringify({
      growth_evidence: {
        allowedIds: envelope.evidence.items.map((item) => item.id),
        rule: "Use only for inherited facts supported by the immutable GROWTH evidence item with the exact same ID.",
      },
      sales_evidence: {
        allowedIds: "Exactly the IDs you declare in this same output's evidence[] after researching current-run native sources.",
        rule: "Use only for current-run SALES facts. An inherited GROWTH ID is invalid in this namespace.",
      },
      goshsha_capability: {
        allowedIds: Object.keys(GOSHSHHA_CAPABILITY_FACTS),
        rule: "Use only for exact server-controlled Goshsha capability facts. Capability IDs are not Brand or prospect evidence.",
      },
      crossNamespaceReuse: "prohibited",
      idRepairOrSubstitution: "prohibited",
    }),
    "Return only strict structured output. Do not copy or alter the GROWTH score/band. Every inherited unknown must appear verbatim in inheritedUnknowns. Outreach claimIds must identify claims in the claims ledger.",
  ].join("\n\n");
}
