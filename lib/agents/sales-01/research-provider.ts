import type { SalesResearchProposal, SalesResearchProviderContext, SalesResearchRequest, SalesSpendingAuthority } from "./research-types";

export const SALES_RUN_SPENDING_CEILING_USD = 1 as const;
export const SALES_MONTHLY_SPENDING_CEILING_USD = 20 as const;
export const COMMERCIAL_AI_MONTHLY_SPENDING_CEILING_USD = 50 as const;

export interface SalesResearchProvider {
  research(request: SalesResearchRequest, context: SalesResearchProviderContext, signal: AbortSignal): Promise<SalesResearchProposal>;
}

export function calculateSalesSpendingAuthority(input: { confirmedByFounder: boolean; salesMonthSpendUsd: number; commercialDepartmentMonthSpendUsd: number }): SalesSpendingAuthority {
  const validSales = Number.isFinite(input.salesMonthSpendUsd) && input.salesMonthSpendUsd >= 0;
  const validDepartment = Number.isFinite(input.commercialDepartmentMonthSpendUsd) && input.commercialDepartmentMonthSpendUsd >= 0;
  const rounded = (value: number) => Math.max(0, Math.round(value * 100) / 100);
  const remainingSalesBudgetUsd = validSales ? rounded(SALES_MONTHLY_SPENDING_CEILING_USD - input.salesMonthSpendUsd) : 0;
  const remainingCommercialDepartmentBudgetUsd = validDepartment ? rounded(COMMERCIAL_AI_MONTHLY_SPENDING_CEILING_USD - input.commercialDepartmentMonthSpendUsd) : 0;
  const effectiveRunAuthorityUsd = rounded(Math.min(SALES_RUN_SPENDING_CEILING_USD, remainingSalesBudgetUsd, remainingCommercialDepartmentBudgetUsd));
  return {
    perRunCeilingUsd: 1,
    salesMonthlyCeilingUsd: 20,
    commercialDepartmentMonthlyCeilingUsd: 50,
    remainingSalesBudgetUsd,
    remainingCommercialDepartmentBudgetUsd,
    effectiveRunAuthorityUsd,
    fullProfileAuthorized: input.confirmedByFounder === true && validSales && validDepartment && effectiveRunAuthorityUsd >= 1,
    cumulativeAccounting: "founder_supplied_nonpersistent",
    providerDollarCutoffGuaranteed: false,
  };
}

export type ProviderErrorDiagnostics = { status: number; message: string | null; type: string | null; code: string | null; param: string | null; requestId: string | null };
function safe(value: unknown, max = 500): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const compact = value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  if (/authorization|api[_ -]?key|"instructions"\s*:|"input"\s*:/i.test(compact)) return "[redacted provider diagnostic]";
  return compact.replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]").replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_API_KEY]").slice(0, max);
}
export async function consumeSalesProviderErrorDiagnostics(response: Response): Promise<ProviderErrorDiagnostics> {
  let parsed: unknown = null;
  try { const raw = await response.text(); parsed = raw ? JSON.parse(raw) : null; } catch { parsed = null; }
  const error = parsed && typeof parsed === "object" && "error" in parsed ? (parsed as { error?: unknown }).error : null;
  const details = error && typeof error === "object" ? error as Record<string, unknown> : {};
  return { status: response.status, message: safe(details.message), type: safe(details.type, 100), code: safe(details.code, 100), param: safe(details.param, 200), requestId: safe(response.headers.get("x-request-id") || response.headers.get("request-id"), 200) };
}
export function formatSalesProviderErrorDiagnostics(value: ProviderErrorDiagnostics): string {
  const metadata = [value.type && `type=${value.type}`, value.code && `code=${value.code}`, value.param && `param=${value.param}`, value.requestId && `requestId=${value.requestId}`].filter(Boolean).join(", ");
  return [value.message, metadata && `(${metadata})`].filter(Boolean).join(" ");
}
