import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("research route is server-authorized, fail-closed before provider, session-only, and has no downstream writes", async () => {
  const route = await readFile("app/api/admin/agents/sales-01/research/route.ts", "utf8");
  assert.match(route, /authorizeSalesAdmin/); assert.match(route, /validateSalesResearchRequest/); assert.match(route, /fullProfileAuthorized/); assert.match(route, /verifySalesProviderIntelligenceProjection/);
  assert.ok(route.indexOf("authorizeSalesAdmin") < route.indexOf("provider.research")); assert.ok(route.indexOf("fullProfileAuthorized") < route.indexOf("provider.research")); assert.ok(route.indexOf("verifySalesProviderIntelligenceProjection") < route.indexOf("provider.research"));
  assert.doesNotMatch(route, /\.set\(|\.add\(|\.update\(|sendEmail|postmark|resend|stripe/i);
  assert.match(route, /crmWriteAuthorized:\s*false/); assert.match(route, /downstreamInvoked:\s*false/); assert.match(route, /externalAction:\s*false/); assert.match(route, /maxDuration\s*=\s*180/);
});

test("Admin UI requires a separate Founder checkbox and labels nonpersistent authority", async () => {
  const page = await readFile("app/admin/sales-01/page.tsx", "utf8");
  assert.match(page, /separately authorize one SALES-01 provider research run/i); assert.match(page, /session-only/i); assert.match(page, /not written to CRM/i); assert.match(page, /does not authorize sending or CRM writes/i);
});
