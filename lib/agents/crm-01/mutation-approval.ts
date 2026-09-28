import { crmSha256 } from "./canonical";
import type { CrmMutationApproval, CrmMutationPlan } from "./mutation-types";
import { CrmMutationError } from "./mutation-validation";

export function verifyMutationApproval(plan:CrmMutationPlan,approval:CrmMutationApproval,uid:string):void {
 const authority={outreach:false,campaigns:false,payments:false,revenueInvocation:false,closerInvocation:false,externalAction:false,executionAuthorized:false};
 if(!approval.approved||approval.scope!=="crm_ingestion"||approval.transactionType!=="canonical_mutation"||approval.approvedByUid!==uid||approval.packetSha256!==plan.packetSha256||approval.mutationPlanSha256!==plan.planSha256||approval.idempotencyKey!==plan.idempotencyKey||crmSha256(approval.expectedRevisions)!==crmSha256(plan.expectedRevisions)||crmSha256(approval.authority)!==crmSha256(authority)||Number.isNaN(Date.parse(approval.approvedAt))) throw new CrmMutationError("approval_invalid","Founder approval does not match the exact canonical CRM mutation.");
}
