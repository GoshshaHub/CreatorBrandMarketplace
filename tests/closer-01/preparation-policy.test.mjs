import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { CLOSER_PREPARATION_REVENUE_FAMILIES, isCloserPreparationRevenueFamily } from "../../lib/agents/closer-01/preparation-policy.ts";

test("one production preparation policy covers initial engagement and later reply objectives", () => {
  assert.deepEqual(CLOSER_PREPARATION_REVENUE_FAMILIES, [
    "establish_qualified_engagement",
    "complete_proof_milestone",
    "pursue_standard_paid_conversion",
    "pursue_repeat_or_retention",
  ]);
  for (const family of CLOSER_PREPARATION_REVENUE_FAMILIES) assert.equal(isCloserPreparationRevenueFamily(family), true);
  for (const family of ["resolve_evidence_or_safety_blocker", "pause_no_commercial_action", "arbitrary"]) assert.equal(isCloserPreparationRevenueFamily(family), false);
});

test("all production CLOSER handlers use the shared policy rather than divergent route allowlists", async () => {
  for (const path of [
    "app/api/admin/agents/closer-01/readiness/route.ts",
    "app/api/admin/agents/closer-01/simulation-authority/route.ts",
    "app/api/admin/agents/closer-01/simulate/route.ts",
  ]) {
    const source = await readFile(path, "utf8");
    assert.ok(source.includes("isCloserPreparationRevenueFamily"), path);
    assert.ok(source.includes("authorizeCrmAdmin"), path);
    assert.ok(source.includes("getCrmRevenueSnapshot"), path);
    assert.ok(source.includes("resolveCurrentSalesPlaybook"), path);
  }
});

test("preparation policy matches the existing CLOSER receiver capability", async () => {
  const source = await readFile("lib/agents/workforce/handoff.ts", "utf8");
  const receiver = source.match(/"future CLOSER-01":\{[^\n]+/)?.[0] ?? "";
  for (const family of CLOSER_PREPARATION_REVENUE_FAMILIES) assert.ok(receiver.includes(`"${family}"`), family);
  assert.ok(receiver.includes("invocationAuthorized:false"));
});
