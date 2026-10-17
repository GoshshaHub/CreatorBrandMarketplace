import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { register } from "node:module";
import test from "node:test";
import { GrowthAdminAuthError } from "../../lib/agents/growth-01/admin-auth.ts";

test("actual authenticated feedback handler reconstructs shared context without paid run, write, or strategy rewrite",async()=>{
  process.env.NODE_ENV="test";
  register(`data:text/javascript,${encodeURIComponent(`export async function resolve(specifier, context, nextResolve) { return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context); }`)}`,import.meta.url);
  const route=await import(`../../app/api/admin/agents/growth-01/commercial-feedback/route.ts?test=${Date.now()}`),request=()=>new Request("http://localhost/api/admin/agents/growth-01/commercial-feedback",{method:"POST",headers:{authorization:"Bearer synthetic","content-type":"application/json"},body:JSON.stringify({accountId:"acct",pursuitId:"pursuit"})});
  let reconstructions=0;
  globalThis.__growthFeedbackRouteTestDependencies={authorize:async()=>{throw new GrowthAdminAuthError(403,"Admin access required.")},reconstruct:async()=>{reconstructions++;throw new Error("must not reconstruct")}};
  const denied=await route.POST(request());assert.equal(denied.status,403);assert.equal(reconstructions,0);
  globalThis.__growthFeedbackRouteTestDependencies={authorize:async()=>({uid:"founder"}),reconstruct:async()=>{reconstructions++;return{snapshot:{upstream:{growth:{candidateSha256:"a".repeat(64)}},revisionBinding:{revisionSetSha256:"b".repeat(64)},snapshotIdentity:{snapshotId:"snapshot"},interactions:[{interactionId:"reply",type:"inbound_received",exactAttributedStatement:"We are interested in discussing the paid option.",occurredAt:"2026-10-16T12:00:00.000Z",classification:"attributed_statement",evidenceAuthenticity:"authentic",authenticCommercialLearningEligible:true}]},playbook:{playbookId:"playbook",artifactSha256:"c".repeat(64)},recommendation:{identity:{recommendationId:"recommendation"},recommendation:{family:"pursue_standard_paid_conversion"}}}}};
  const response=await route.POST(request()),body=await response.json();assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"no-store");assert.equal(reconstructions,1);assert.equal(body.feedback.attributedOutcomes[0].exactAttributedStatement,"We are interested in discussing the paid option.");assert.deepEqual([body.paidRunTriggered,body.providerInvoked,body.strategyRewritten,body.persisted,body.externalAction],[false,false,false,false,false]);assert.deepEqual(Object.values(body.feedback.authority),[false,false,false,false]);delete globalThis.__growthFeedbackRouteTestDependencies;
});

test("GROWTH workspace exposes feedback as an explicit read-only action separate from research",async()=>{const page=await readFile("app/admin/growth-01/page.tsx","utf8"),route=await readFile("app/api/admin/agents/growth-01/commercial-feedback/route.ts","utf8");assert.match(page,/Load shared context \(read only\)/);assert.match(page,/does not run GROWTH, rewrite strategy, persist data, or authorize an external action/);assert.doesNotMatch(route,/OpenAI|provider\.research|\.set\(|\.create\(|\.update\(|runTransaction/);assert.match(route,/authorizeGrowthAdmin/);});
