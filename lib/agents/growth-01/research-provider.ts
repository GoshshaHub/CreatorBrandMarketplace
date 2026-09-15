import type {
  GrowthResearchProposal,
  GrowthResearchProviderContext,
  GrowthResearchRequest,
  SpendingAuthority,
} from "./research-types";

export const GROWTH_RUN_SPENDING_CEILING_USD = 1 as const;
export const GROWTH_MONTHLY_SPENDING_CEILING_USD = 20 as const;
export const COMMERCIAL_AI_MONTHLY_SPENDING_CEILING_USD = 50 as const;

export interface GrowthResearchProvider {
  research(
    request: GrowthResearchRequest,
    context: GrowthResearchProviderContext,
    signal: AbortSignal
  ): Promise<GrowthResearchProposal>;
}

function boundedMoney(value: number): number {
  return Math.max(0, Math.round(value * 100) / 100);
}

export function calculateSpendingAuthority(input: {
  confirmedByFounder: boolean;
  growthMonthSpendUsd: number;
  commercialDepartmentMonthSpendUsd: number;
}): SpendingAuthority {
  const validGrowthSpend = Number.isFinite(input.growthMonthSpendUsd) && input.growthMonthSpendUsd >= 0;
  const validDepartmentSpend = Number.isFinite(input.commercialDepartmentMonthSpendUsd) && input.commercialDepartmentMonthSpendUsd >= 0;
  const remainingGrowthBudgetUsd = validGrowthSpend
    ? boundedMoney(GROWTH_MONTHLY_SPENDING_CEILING_USD - input.growthMonthSpendUsd)
    : 0;
  const remainingCommercialDepartmentBudgetUsd = validDepartmentSpend
    ? boundedMoney(COMMERCIAL_AI_MONTHLY_SPENDING_CEILING_USD - input.commercialDepartmentMonthSpendUsd)
    : 0;
  const effectiveRunAuthorityUsd = boundedMoney(
    Math.min(
      GROWTH_RUN_SPENDING_CEILING_USD,
      remainingGrowthBudgetUsd,
      remainingCommercialDepartmentBudgetUsd
    )
  );

  return {
    perRunCeilingUsd: GROWTH_RUN_SPENDING_CEILING_USD,
    growthMonthlyCeilingUsd: GROWTH_MONTHLY_SPENDING_CEILING_USD,
    commercialDepartmentMonthlyCeilingUsd: COMMERCIAL_AI_MONTHLY_SPENDING_CEILING_USD,
    remainingGrowthBudgetUsd,
    remainingCommercialDepartmentBudgetUsd,
    effectiveRunAuthorityUsd,
    fullProfileAuthorized:
      input.confirmedByFounder === true &&
      validGrowthSpend &&
      validDepartmentSpend &&
      effectiveRunAuthorityUsd >= GROWTH_RUN_SPENDING_CEILING_USD,
    cumulativeAccounting: "founder_supplied_nonpersistent",
    providerDollarCutoffGuaranteed: false,
  };
}
