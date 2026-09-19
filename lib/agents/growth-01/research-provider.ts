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

export type ProviderErrorDiagnostics = {
  status: number;
  message: string | null;
  type: string | null;
  code: string | null;
  param: string | null;
  requestId: string | null;
};

function sanitizeProviderDiagnostic(value: unknown, maximumLength = 500): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const compact = value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  if (/authorization|api[_ -]?key|"instructions"\s*:|"input"\s*:/i.test(compact)) {
    return "[redacted provider diagnostic]";
  }
  return compact
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_API_KEY]")
    .slice(0, maximumLength);
}

export async function consumeProviderErrorDiagnostics(response: Response): Promise<ProviderErrorDiagnostics> {
  let parsed: unknown = null;
  try {
    const rawBody = await response.text();
    parsed = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    parsed = null;
  }
  const error = parsed && typeof parsed === "object" && "error" in parsed
    ? (parsed as { error?: unknown }).error
    : null;
  const details = error && typeof error === "object" ? error as Record<string, unknown> : {};
  return {
    status: response.status,
    message: sanitizeProviderDiagnostic(details.message),
    type: sanitizeProviderDiagnostic(details.type, 100),
    code: sanitizeProviderDiagnostic(details.code, 100),
    param: sanitizeProviderDiagnostic(details.param, 200),
    requestId: sanitizeProviderDiagnostic(
      response.headers.get("x-request-id") || response.headers.get("request-id"),
      200
    ),
  };
}

export function formatProviderErrorDiagnostics(diagnostics: ProviderErrorDiagnostics): string {
  const metadata = [
    diagnostics.type && `type=${diagnostics.type}`,
    diagnostics.code && `code=${diagnostics.code}`,
    diagnostics.param && `param=${diagnostics.param}`,
    diagnostics.requestId && `requestId=${diagnostics.requestId}`,
  ].filter(Boolean).join(", ");
  return [
    diagnostics.message,
    metadata ? `(${metadata})` : null,
  ].filter(Boolean).join(" ");
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
