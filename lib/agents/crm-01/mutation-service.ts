import type { Firestore } from "firebase-admin/firestore";
import { buildCrmMutationPlan } from "./mutation-planner";
import { loadMutationRecords } from "./mutation-firestore";
import type { CrmFounderMutationPacket } from "./mutation-types";

export async function previewCrmMutation(params:{db:Firestore;packet:CrmFounderMutationPacket;crmContractSha256:string}){const records=await loadMutationRecords(params.db,params.packet);return buildCrmMutationPlan({packet:params.packet,records,crmContractSha256:params.crmContractSha256});}
