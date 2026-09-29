import { revenueSha256 } from "./canonical";

export const COMMERCIAL_GOAL_SCHEMA = "goshsha-commercial-goal-v1" as const;
export const COMMERCIAL_GOAL_VERSION = "v1" as const;
export const COMMERCIAL_GOAL_BODY = {
  schemaVersion: COMMERCIAL_GOAL_SCHEMA,
  goalId: "first-1000-monthly-collected-revenue",
  version: COMMERCIAL_GOAL_VERSION,
  metric: "collected_revenue",
  targetAmount: 1000,
  currency: "USD",
  period: "calendar_month",
  effectiveDate: "2026-09-28",
  authority: "Founder",
  status: "active",
} as const;
export const COMMERCIAL_GOAL_SHA256 = revenueSha256(COMMERCIAL_GOAL_BODY);
export function getCommercialGoal() { return { ...COMMERCIAL_GOAL_BODY, sha256: COMMERCIAL_GOAL_SHA256 }; }
