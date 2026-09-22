import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { authorizeGrowthAdmin, GrowthAdminAuthError } from "../../lib/agents/growth-01/admin-auth.ts";

test("non-Admin and spoofed client roles cannot authorize research", async () => {
  const request = new Request("https://irl.goshsha.com/api/admin/agents/growth-01/research", {
    method: "POST",
    headers: { Authorization: "Bearer valid", "x-client-role": "admin" },
  });
  await assert.rejects(
    () => authorizeGrowthAdmin(request, {
      verifyIdToken: async () => ({ uid: "verified-uid" }),
      loadUser: async () => ({ exists: true, isAdmin: false }),
    }),
    (error) => error instanceof GrowthAdminAuthError && error.status === 403
  );
});

test("route is bounded, synchronous, nonpersistent, and has no downstream execution", async () => {
  const route = await readFile("app/api/admin/agents/growth-01/research/route.ts", "utf8");
  assert.match(route, /export const maxDuration = 180/);
  assert.match(route, /authorizeGrowthAdmin/);
  assert.doesNotMatch(route, /\.(set|add|update|delete)\s*\(/);
  assert.doesNotMatch(route, /SALES.*invoke|CRM.*invoke|sendEmail|notification|schedule|queue|background/i);
  assert.doesNotMatch(route, /NEXT_PUBLIC_OPENAI|console\.log\([^)]*API/i);
});

test("browser receives no API key and displays proposal separately from Phase 1A validation", async () => {
  const page = await readFile("app/admin/growth-01/research/page.tsx", "utf8");
  assert.doesNotMatch(page, /OPENAI_API_KEY|NEXT_PUBLIC_OPENAI/);
  assert.match(page, /Untrusted provider proposal/);
  assert.match(page, /Phase 1A deterministic validation/);
  assert.match(page, /does not persist or independently know cumulative monthly spend/i);
  assert.match(page, /validated brief is not Founder approval/i);
});

test("successful result identifies the frozen contract and failure metadata denies state changes", async () => {
  const route = await readFile("app/api/admin/agents/growth-01/research/route.ts", "utf8");
  assert.match(route, /loadGrowthContractMetadata/);
  assert.match(route, /verifyGrowthProviderResearchProjection/);
  assert.ok(route.indexOf("verifyGrowthProviderResearchProjection") < route.indexOf("new OpenAIResponsesWebResearchProvider"));
  assert.match(route, /persisted:\s*false/);
  assert.match(route, /downstreamInvoked:\s*false/);
  assert.match(route, /automaticRetry:\s*false/);
  assert.match(route, /providerExecution/);
  assert.match(route, /providerFailureCodes/);
});

test("completed local rejection is displayed without exposing the rejected proposal", async () => {
  const page = await readFile("app/admin/growth-01/research/page.tsx", "utf8");
  assert.match(page, /Provider completed, but GROWTH-01 deterministic validation rejected the proposal/);
  assert.match(page, /Cached input tokens/);
  assert.match(page, /Cache-write tokens/);
  assert.match(page, /Total tokens/);
  assert.doesNotMatch(page, /estimated dollar|estimated cost/i);
});
