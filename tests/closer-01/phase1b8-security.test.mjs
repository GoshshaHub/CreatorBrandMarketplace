import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const route=readFileSync("app/api/admin/agents/closer-01/local-demo/objection-pattern/route.ts","utf8"),ui=readFileSync("app/admin/revenue-01/closer-local-demo/ObjectionPatternReview.tsx","utf8");
test("pattern route is guarded Admin-only exact-approved atomic and idempotent",()=>{assert.match(route,/assertCloserLocalDemoEnvironment/);assert.match(route,/authorizeCrmAdmin/);assert.match(route,/explicitFounderApproval/);assert.match(route,/verifyProof/);assert.match(route,/runTransaction/);assert.match(route,/prior\.exists/);assert.match(route,/replayed:!wrote/);assert.match(route,/pattern_review_approval_stale/);assert.match(route,/Cache-Control.*no-store/)});
test("UI exposes evidence/count semantics and does not imply automatic change",()=>{assert.match(ui,/Distinct|Prospects/);assert.match(ui,/Source Interactions/);assert.match(ui,/Exact Founder approval preview/);assert.match(ui,/No strategy, offer, Revenue objective, continuation authority/);assert.match(ui,/Synthetic/)});
