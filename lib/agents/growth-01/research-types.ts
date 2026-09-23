import type { ContractMetadata, GrowthRunRequest } from "./types";
import type { GrowthProviderProjectionMetadata } from "./provider-research-contract";

export type GrowthMarketPriority = {
  priority1: Array<"supplements" | "vitamins" | "wellness_supplements">;
  priority2: Array<"skincare" | "haircare" | "oral_care">;
  priority3: Array<"beauty" | "makeup">;
};

export type GrowthResearchRequest = {
  asOfDate: string;
  marketPriority: GrowthMarketPriority;
  founderResearchFocus?: string;
  maximumCandidates: number;
  maximumQualified: number;
  budgetAuthority: {
    confirmedByFounder: true;
    growthMonthSpendUsd: number;
    commercialDepartmentMonthSpendUsd: number;
  };
};

export type SpendingAuthority = {
  perRunCeilingUsd: 1;
  growthMonthlyCeilingUsd: 20;
  commercialDepartmentMonthlyCeilingUsd: 50;
  remainingGrowthBudgetUsd: number;
  remainingCommercialDepartmentBudgetUsd: number;
  effectiveRunAuthorityUsd: number;
  fullProfileAuthorized: boolean;
  cumulativeAccounting: "founder_supplied_nonpersistent";
  providerDollarCutoffGuaranteed: false;
};

export type NormalizedResearchSource = {
  id: string;
  rawUrl: string;
  canonicalUrl: string;
  title: string;
  publicationDate: string | null;
};

export type GrowthResearchUsage = {
  inputTokens: number | null;
  cachedInputTokens: number | null;
  cacheWriteTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  reasoningTokens: number | null;
  webSearchCalls: number;
};

export type ProviderExecutionMetadata = {
  provider: "openai";
  outcome: "provider_completed_local_rejection" | "accepted";
  requestedModel: string;
  returnedModel: string | null;
  providerResponseId: string | null;
  providerStatus: string | null;
  providerCreatedAt: string | null;
  providerCompletedAt: string | null;
  serverReceivedAt: string;
  usage: GrowthResearchUsage;
};

export type GrowthResearchProposal = {
  provider: "openai";
  requestedModel: string;
  returnedModel: string;
  providerRequestId: string;
  completedAt: string;
  status: "full" | "partial";
  limitations: string[];
  usage: GrowthResearchUsage;
  execution: ProviderExecutionMetadata;
  normalizedSourceCount: number;
  sources: NormalizedResearchSource[];
  proposedRun: GrowthRunRequest;
  authority: {
    providerOutput: "untrusted_research_proposal";
    founderApproved: false;
    salesApproved: false;
    crmStateCreated: false;
    authoritativeRevenueOutcomeCreated: false;
    persistence: false;
    externalCommunication: false;
  };
};

export type GrowthResearchResult = {
  outcome: "accepted";
  researchRun: {
    requestedByUid: string;
    requestedAt: string;
    providerTimeoutMs: 150_000;
    maximumWebSearchCalls: 8;
    maximumCandidates: number;
    maximumQualified: number;
  };
  contract: ContractMetadata;
  providerProjection: GrowthProviderProjectionMetadata;
  spendingAuthority: SpendingAuthority;
  proposal: GrowthResearchProposal;
};

export type GrowthResearchProviderContext = {
  contractVersion: string;
  contractSha256: string;
  providerProjection: GrowthProviderProjectionMetadata & { body: string };
  asOfDate: string;
  marketPriority: GrowthResearchRequest["marketPriority"];
  founderResearchFocus: string;
  maximumCandidates: number;
  maximumQualified: number;
};
