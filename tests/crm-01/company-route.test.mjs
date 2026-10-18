import assert from "node:assert/strict";
import test from "node:test";
import { companyRouteRecipientId, initializeCanonicalConversation } from "../../lib/agents/crm-01/conversation.ts";
import { buildAuthoritativeSuppressionCheck } from "../../lib/agents/crm-01/suppression-check.ts";

const at="2026-10-18T12:00:00.000Z";
const rec=(entityType,id,data,revision=1)=>({recordSchemaVersion:"crm-record-v1",entityType,id,data,revision,createdAt:at,updatedAt:at,provenance:["founder_provided_information"],history:[]});

test("evidenced general-company route has stable identity without person or buying authority",()=>{
  const route={accountId:"acct",channel:"linkedin",routeType:"general_company",value:"https://www.linkedin.com/company/example/",evidenceIds:["S-E5"]};
  const id=companyRouteRecipientId(route),conversation=initializeCanonicalConversation({accountId:"acct",pursuitId:"pursuit",participants:[{type:"company_route",id,channel:"linkedin",routeType:"general_company",value:route.value,evidenceIds:route.evidenceIds},{type:"goshsha_internal",id:"goshsha_founder"}],recordedAt:at,actorUid:"founder"});
  assert.equal(conversation.participants.find(x=>x.type==="company_route").id,id);
  assert.equal("buyingAuthority" in conversation.participants.find(x=>x.type==="company_route"),false);
  assert.equal(conversation.communicationAuthority,false);
});

test("authoritative internal check distinguishes clear, suppression, and unavailable without inferring consent",()=>{
  const recipient={type:"company_route",id:"companyroute_1",channel:"linkedin"};
  const routeEvidence=rec("contact","route-record",{accountId:"acct",contactRoute:{type:"general_company",value:"https://www.linkedin.com/company/example/",evidenceIds:["S-E5"]}},2);
  const clear=buildAuthoritativeSuppressionCheck({accountId:"acct",recipient,checkedAt:at,records:[rec("account","acct",{dnc:{status:"inactive",evidenceRefs:["internal-ledger"]},dncEvaluation:"allowed"}),routeEvidence]});
  assert.equal(clear.result,"no_applicable_suppression_found");assert.equal(clear.consentInferred,false);assert.equal(clear.sendingAuthorized,false);
  assert.equal(buildAuthoritativeSuppressionCheck({accountId:"acct",recipient,checkedAt:at,records:[rec("account","acct",{dnc:{status:"active"}}),routeEvidence]}).result,"suppression_found");
  assert.equal(buildAuthoritativeSuppressionCheck({accountId:"acct",recipient,checkedAt:at,records:[rec("account","acct",{dnc:{status:"conflicting"}}),routeEvidence]}).result,"conflicting");
  assert.equal(buildAuthoritativeSuppressionCheck({accountId:"acct",recipient,checkedAt:at,records:[rec("account","acct",{dnc:{status:"inactive"}})]}).result,"not_checked_or_unavailable");
  assert.equal(buildAuthoritativeSuppressionCheck({accountId:"acct",recipient,checkedAt:at,records:[]}).result,"not_checked_or_unavailable");
});
