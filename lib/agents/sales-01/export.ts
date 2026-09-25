import type { GrowthSalesCandidateContext, GrowthSalesExportV1 } from "./types";
import type { GrowthProviderProjectionMetadata } from "../growth-01/provider-research-contract";
import type { ScoredCandidate, ValidatedGrowthRun } from "../growth-01/types";

const REGULATED_CLAIM = /\b(medical|therapeutic|treat(?:s|ment)?|prevent(?:s|ion)?|disease|health|efficacy|effective|safety|safe|dosage|dose|ingredient[- ]interaction|regulatory|fda)\b/i;

function contextFor(candidate: ScoredCandidate): GrowthSalesCandidateContext {
  return {
    candidateId: candidate.id,
    triggerDate: { value: null, provenance: "unknown" },
    physicalScanExperience: { value: null, provenance: "unknown" },
    boundarySnapshot: {
      rightsStatus: "unknown",
      rightsEvidenceIds: [],
      regulatedClaims: candidate.claims
        .filter((claim) => REGULATED_CLAIM.test(claim.claim))
        .map((claim) => ({ claimId: claim.id, classification: "unknown", evidenceIds: [...claim.evidenceIds], attribution: null })),
      retailerAuthorizationClaimed: false,
      buyerAuthorityKnown: false,
      budgetKnown: false,
      purchaseIntentKnown: false,
      timingCommitmentKnown: false,
      unsupportedCapabilityIntroduced: false,
    },
  };
}

export function createGrowthSalesExport(params: {
  validatedRun: ValidatedGrowthRun;
  providerProjection: GrowthProviderProjectionMetadata | null;
  exportedAt?: string;
}): GrowthSalesExportV1 {
  return {
    exportVersion: "growth-sales-export-v1",
    exportedAt: params.exportedAt || new Date().toISOString(),
    validatedRun: params.validatedRun,
    providerProjection: params.providerProjection,
    candidateContexts: params.validatedRun.candidates.map(contextFor),
    authority: {
      exportOnly: true,
      founderApprovedForSales: false,
      salesInvoked: false,
      persisted: false,
      downstreamInvoked: false,
      externalAction: false,
    },
  };
}
