import {
  APPROVED_GROWTH_PROVIDER_PROJECTION_SHA256,
  GROWTH_PROVIDER_RESEARCH_PROJECTION_VERSION,
  PAIRED_FROZEN_GROWTH_CONTRACT_SHA256,
  PAIRED_FROZEN_GROWTH_CONTRACT_VERSION,
} from "../growth-01/provider-research-contract";
import { scoreGrowthCandidate } from "../growth-01/scoring";
import { buffBenchmarkCandidate } from "../growth-01/fixtures";
import type { ValidatedGrowthRun } from "../growth-01/types";
import { createGrowthSalesExport } from "./export";
import type { GrowthSalesExportV1, SalesContractMetadata } from "./types";
import { APPROVED_GROWTH_CONTRACT_SHA256, APPROVED_SALES_CONTRACT_SHA256 } from "./contract";

export const syntheticSalesContractMetadata: SalesContractMetadata = {
  name: "SALES-01",
  version: "V1.1",
  path: "agents/sales-01/AGENT.md",
  sha256: APPROVED_SALES_CONTRACT_SHA256,
  byteLength: 1,
  loadedAt: "2026-09-24T12:00:00.000Z",
  repositoryCommit: null,
};

export function createSyntheticValidatedGrowthRun(): ValidatedGrowthRun {
  const scored = scoreGrowthCandidate(structuredClone(buffBenchmarkCandidate)).candidate;
  return {
    run: {
      id: "synthetic-growth-run-for-sales-phase-1a",
      requestedByUid: "synthetic-founder",
      requestedAt: "2026-09-24T12:00:00.000Z",
      asOfDate: "2026-09-24",
      marketFocus: ["beauty"],
      status: "valid",
      candidateCount: 1,
      qualifiedCount: 1,
      authority: "founder_supervised_preview_only",
      persistence: false,
      externalCommunication: false,
    },
    contract: {
      name: "GROWTH-01",
      version: "V1",
      path: "agents/growth-01/AGENT.md",
      sha256: APPROVED_GROWTH_CONTRACT_SHA256,
      byteLength: 1,
      loadedAt: "2026-09-24T12:00:00.000Z",
      repositoryCommit: null,
    },
    candidates: [scored],
    findings: [],
    dailyBriefMarkdown: "# Synthetic GROWTH fixture\n",
  };
}

export function createSyntheticGrowthSalesExport(): GrowthSalesExportV1 {
  return createGrowthSalesExport({
    validatedRun: createSyntheticValidatedGrowthRun(),
    providerProjection: {
      version: GROWTH_PROVIDER_RESEARCH_PROJECTION_VERSION,
      sha256: APPROVED_GROWTH_PROVIDER_PROJECTION_SHA256,
      pairedFrozenContractVersion: PAIRED_FROZEN_GROWTH_CONTRACT_VERSION,
      pairedFrozenContractSha256: PAIRED_FROZEN_GROWTH_CONTRACT_SHA256,
    },
    exportedAt: "2026-09-24T12:01:00.000Z",
  });
}
