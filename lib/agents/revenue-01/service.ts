import { COMMERCIAL_GOAL_BODY, COMMERCIAL_GOAL_SHA256 } from "./commercial-goals";
import { loadRevenueContractMetadata } from "./contract";
import { buildRevenueRecommendation } from "./recommendation";
import type { CrmRevenueSnapshotV1 } from "../crm-01/revenue-snapshot-types";
import type { RevenueRunContext } from "./types";

export async function createDeterministicRevenueRecommendation(params:{snapshot:CrmRevenueSnapshotV1;runContext:RevenueRunContext;now?:Date}){
  const now=params.now??new Date(),contract=await loadRevenueContractMetadata(now);
  return buildRevenueRecommendation({snapshot:params.snapshot,runContext:params.runContext,revenueContract:{version:contract.version,sha256:contract.sha256},commercialGoal:{goalId:COMMERCIAL_GOAL_BODY.goalId,version:COMMERCIAL_GOAL_BODY.version,sha256:COMMERCIAL_GOAL_SHA256},generatedAt:now.toISOString()});
}
