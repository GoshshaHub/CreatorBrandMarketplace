import type { RevenueObjectiveFamily } from "../revenue-01/types";

export const CLOSER_PREPARATION_REVENUE_FAMILIES = [
  "establish_qualified_engagement",
  "complete_proof_milestone",
  "pursue_standard_paid_conversion",
  "pursue_repeat_or_retention",
] as const satisfies readonly RevenueObjectiveFamily[];

export function isCloserPreparationRevenueFamily(value: unknown): value is (typeof CLOSER_PREPARATION_REVENUE_FAMILIES)[number] {
  return typeof value === "string" && CLOSER_PREPARATION_REVENUE_FAMILIES.some(family => family === value);
}
