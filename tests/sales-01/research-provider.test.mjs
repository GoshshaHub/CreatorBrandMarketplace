import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { createSyntheticGrowthSalesExport, syntheticSalesContractMetadata } from "../../lib/agents/sales-01/fixtures.ts";
import { verifySalesProviderIntelligenceProjection, APPROVED_SALES_PROVIDER_INTELLIGENCE_SHA256 } from "../../lib/agents/sales-01/provider-intelligence-contract.ts";
import { calculateSalesSpendingAuthority, consumeSalesProviderErrorDiagnostics, formatSalesProviderErrorDiagnostics } from "../../lib/agents/sales-01/research-provider.ts";
import { buildSalesResearchInstructions } from "../../lib/agents/sales-01/research-prompt.ts";
import { OPENAI_SALES_INTELLIGENCE_JSON_SCHEMA } from "../../lib/agents/sales-01/research-schema.ts";
import { validateSalesIntake } from "../../lib/agents/sales-01/validation.ts";

function envelope() {
  return validateSalesIntake({ input: { export: createSyntheticGrowthSalesExport(), candidateId: "buff-the-buff-ritual", founderApproval: { approved: true, scope: "sales_preparation_only" } }, approvedByUid: "founder", approvedAt: "2026-09-24T12:00:00.000Z", salesContract: syntheticSalesContractMetadata }).envelope;
}

test("projection is paired to SALES V1.1 and one-byte changes fail closed", () => {
  const projection = verifySalesProviderIntelligenceProjection({ salesContractSha256: "86141fd7c1aff83cc487346976c6894633a32e37ae498334301138fd658a1f34" });
  assert.equal(projection.version, "sales-01-provider-intelligence-v1");
  assert.equal(projection.sha256, APPROVED_SALES_PROVIDER_INTELLIGENCE_SHA256);
  assert.throws(() => verifySalesProviderIntelligenceProjection({ salesContractSha256: `0${projection.pairedSalesContractSha256.slice(1)}` }));
  assert.throws(() => verifySalesProviderIntelligenceProjection({ salesContractSha256: projection.pairedSalesContractSha256, projectionBody: `${projection.body}x` }));
});

test("provider projection preserves contact, claims, rights, unknown, and non-sending boundaries", () => {
  const projection = verifySalesProviderIntelligenceProjection({ salesContractSha256: syntheticSalesContractMetadata.sha256 });
  const prompt = buildSalesResearchInstructions({ salesContract: syntheticSalesContractMetadata, providerProjection: projection, envelope: envelope() });
  assert.match(prompt, /Never infer, pattern-match, or guess email/i);
  assert.match(prompt, /Buying authority is unknown/i);
  assert.match(prompt, /Every inherited GROWTH unknown/i);
  assert.match(prompt, /Creator activity does not establish content rights/i);
  assert.match(prompt, /All outreach is non-sending/i);
  assert.doesNotMatch(prompt, /growthMonthSpendUsd|salesMonthSpendUsd|commercialDepartmentMonthSpendUsd|Firebase UID/);
});

test("strict schema excludes inferred contact routes and limits contacts", () => {
  const contact = OPENAI_SALES_INTELLIGENCE_JSON_SCHEMA.properties.contacts;
  assert.equal(contact.maxItems, 6);
  assert.deepEqual(contact.items.properties.contactRoute.properties.type.enum, ["direct_public_business", "general_company", "public_professional_profile", "unknown"]);
  assert.equal(contact.items.properties.contactRoute.properties.type.enum.includes("inferred"), false);
});

test("SALES spending authority is hierarchical $1 → $20 → $50 and requires the full dollar", () => {
  assert.equal(calculateSalesSpendingAuthority({ confirmedByFounder: true, salesMonthSpendUsd: 0, commercialDepartmentMonthSpendUsd: 0 }).fullProfileAuthorized, true);
  const salesLimited = calculateSalesSpendingAuthority({ confirmedByFounder: true, salesMonthSpendUsd: 19.01, commercialDepartmentMonthSpendUsd: 0 });
  assert.equal(salesLimited.effectiveRunAuthorityUsd, 0.99); assert.equal(salesLimited.fullProfileAuthorized, false);
  const departmentLimited = calculateSalesSpendingAuthority({ confirmedByFounder: true, salesMonthSpendUsd: 0, commercialDepartmentMonthSpendUsd: 49.5 });
  assert.equal(departmentLimited.effectiveRunAuthorityUsd, 0.5); assert.equal(departmentLimited.fullProfileAuthorized, false);
  assert.equal(departmentLimited.providerDollarCutoffGuaranteed, false);
});

test("adapter is one request, store false, bounded, sequential, and has no retry", async () => {
  const source = await readFile("lib/agents/sales-01/providers/openai-responses-web.ts", "utf8");
  assert.equal((source.match(/await this\.fetchImpl\(/g) || []).length, 1);
  assert.match(source, /store:\s*false/); assert.match(source, /parallel_tool_calls:\s*false/); assert.match(source, /max_tool_calls:\s*MAX_SALES_WEB_SEARCH_CALLS/);
  assert.doesNotMatch(source, /for\s*\([^)]*retry|while\s*\(|automaticRetry\s*:\s*true/i);
});

test("provider errors are consumed once and sanitized", async () => {
  let reads = 0;
  const response = { status: 400, headers: new Headers({ "x-request-id": "req_sales_safe" }), async text() { reads += 1; return JSON.stringify({ error: { message: "Authorization: Bearer sk-secret {\"instructions\":\"private\"}", type: "invalid_request_error", code: "bad", param: "text.format.schema" } }); } };
  const diagnostics = await consumeSalesProviderErrorDiagnostics(response); const formatted = formatSalesProviderErrorDiagnostics(diagnostics);
  assert.equal(reads, 1); assert.match(formatted, /invalid_request_error/); assert.doesNotMatch(formatted, /sk-secret|Authorization|private/);
});
