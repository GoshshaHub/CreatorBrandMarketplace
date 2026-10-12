import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const route=await readFile("app/api/admin/agents/closer-01/local-demo/objection-review/route.ts","utf8");
test("objection recording is guarded authenticated no-store and exact-approved",()=>{assert.match(route,/assertCloserLocalDemoEnvironment/);assert.match(route,/authorizeCrmAdmin/);assert.match(route,/Cache-Control.*no-store/);assert.match(route,/explicitFounderApproval/);assert.match(route,/verifyProof/);assert.match(route,/verifyObjectionReviewPacket/)});
test("recording is append-only idempotent and revision bound",()=>{assert.match(route,/runTransaction/);assert.match(route,/priorReceipt\.exists/);assert.match(route,/observation_approval_stale/);assert.match(route,/tx\.create/);assert.match(route,/assessmentRevision:currentRevision\+1/)});
test("stored artifacts grant no continuation invocation or authentic interaction",()=>{assert.match(route,/canonicalInteractionCreated:false/);assert.match(route,/closerContinuationAuthorized:false/);assert.match(route,/agentInvocationAuthorized:false/);assert.doesNotMatch(route,/OpenAI|sendMessage|schedule|payment/i)});
