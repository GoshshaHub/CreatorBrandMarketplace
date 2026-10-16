import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { createSyntheticGrowthSalesExport, syntheticSalesContractMetadata } from "../../lib/agents/sales-01/fixtures.ts";
import { verifySalesProviderIntelligenceProjection, APPROVED_SALES_PROVIDER_INTELLIGENCE_SHA256 } from "../../lib/agents/sales-01/provider-intelligence-contract.ts";
import { calculateSalesSpendingAuthority, consumeSalesProviderErrorDiagnostics, formatSalesProviderErrorDiagnostics } from "../../lib/agents/sales-01/research-provider.ts";
import { buildSalesResearchInstructions } from "../../lib/agents/sales-01/research-prompt.ts";
import { OPENAI_SALES_INTELLIGENCE_JSON_SCHEMA } from "../../lib/agents/sales-01/research-schema.ts";
import { validateSalesIntake } from "../../lib/agents/sales-01/validation.ts";
import { OpenAIResponsesWebSalesProvider } from "../../lib/agents/sales-01/providers/openai-responses-web.ts";
import { verifyCommercialPositioning } from "../../lib/agents/commercial-positioning.ts";

function envelope() {
  return validateSalesIntake({ input: { export: createSyntheticGrowthSalesExport(), candidateId: "buff-the-buff-ritual", founderApproval: { approved: true, scope: "sales_preparation_only" } }, approvedByUid: "founder", approvedAt: "2026-09-24T12:00:00.000Z", salesContract: syntheticSalesContractMetadata }).envelope;
}

test("projection v1.7 is paired to SALES V1.4 and one-byte changes fail closed", () => {
  const projection = verifySalesProviderIntelligenceProjection({ salesContractSha256: syntheticSalesContractMetadata.sha256 });
  assert.equal(projection.version, "sales-01-provider-intelligence-v1.7");
  assert.equal(projection.sha256, APPROVED_SALES_PROVIDER_INTELLIGENCE_SHA256);
  assert.throws(() => verifySalesProviderIntelligenceProjection({ salesContractSha256: `${projection.pairedSalesContractSha256[0] === "0" ? "1" : "0"}${projection.pairedSalesContractSha256.slice(1)}` }));
  assert.throws(() => verifySalesProviderIntelligenceProjection({ salesContractSha256: projection.pairedSalesContractSha256, projectionBody: `${projection.body}x` }));
});

test("provider projection preserves evidence, contact, offer, and non-sending boundaries without activation gating", () => {
  const projection = verifySalesProviderIntelligenceProjection({ salesContractSha256: syntheticSalesContractMetadata.sha256 });
  const prompt = buildSalesResearchInstructions({ salesContract: syntheticSalesContractMetadata, providerProjection: projection, envelope: envelope() });
  assert.match(prompt, /Never infer, pattern-match, or guess email/i);
  assert.match(prompt, /Buying authority is unknown/i);
  assert.match(prompt, /smallest sufficient contact set/i);
  assert.match(prompt, /Generic Partnerships is insufficient/i);
  assert.match(prompt, /zero or one Best First Contact/i);
  assert.match(prompt, /Inherited GROWTH unknowns remain server-preserved context/i);
  assert.match(prompt, /evidence\[\] array is only for current-run SALES sources/i);
  assert.match(prompt, /Inherited GROWTH facts must use growth_evidence/i);
  assert.match(prompt, /Exact evidence-reference namespaces/i);
  assert.match(prompt, /"allowedIds":\["buff-retail","buff-content","buff-trigger"\]/i);
  assert.match(prompt, /An inherited GROWTH ID is invalid in this namespace/i);
  assert.match(prompt, /crossNamespaceReuse":"prohibited/i);
  assert.match(prompt, /cap-free-first/);
  assert.match(prompt, /capability reference cannot establish a Brand or prospect fact/i);
  assert.match(prompt, /Do not substitute redirect URLs/i);
  assert.match(prompt, /Creator activity.*does not establish content ownership or reusable Goshsha activation rights/i);
  assert.match(prompt, /posting, reposting, collaboration, sponsorship, Brand use, or Brand association does not establish/i);
  assert.match(prompt, /Each current-run evidence item must declare one or more narrow purposes/i);
  assert.match(prompt, /Purpose labels are untrusted and the server validates them/i);
  assert.match(prompt, /Content permissions, asset selection, licensing evidence, AR readiness, and fulfillment readiness are outside/i);
  assert.match(prompt, /Write useful, natural business language/i);
  assert.match(prompt, /All outreach is non-sending/i);
  assert.match(prompt, /server attaches accurate catalog terms/i);
  assert.match(prompt, /goshsha-commercial-positioning-v1/);
  assert.match(prompt, /How many users does Goshsha have/);
  assert.match(prompt, /not automatically Goshsha traffic/);
  assert.doesNotMatch(prompt, /growthMonthSpendUsd|salesMonthSpendUsd|commercialDepartmentMonthSpendUsd|Firebase UID/);
});

test("strict schema excludes inferred contact routes and limits contacts", () => {
  const contact = OPENAI_SALES_INTELLIGENCE_JSON_SCHEMA.properties.contacts;
  assert.equal(contact.maxItems, 6);
  assert.deepEqual(contact.items.properties.contactRoute.properties.type.enum, ["direct_public_business", "general_company", "public_professional_profile", "unknown"]);
  assert.equal(contact.items.properties.contactRoute.properties.type.enum.includes("inferred"), false);
  for (const field of ["identityEvidenceIds", "currentRoleEvidenceIds", "stakeholderFunction", "problemOwnership", "functionalRelevance", "functionalRelevanceClassification", "confidence", "freshness", "conflictingEvidenceIds"]) assert.ok(contact.items.required.includes(field));
  assert.deepEqual(OPENAI_SALES_INTELLIGENCE_JSON_SCHEMA.properties.contactSelection.properties.status.enum, ["recommended", "unavailable"]);
});

test("strict schema uses the supported Responses subset and omits activation-readiness fields", () => {
  const serialized = JSON.stringify(OPENAI_SALES_INTELLIGENCE_JSON_SCHEMA);
  for (const unsupported of ["uniqueItems","allOf","not","dependentRequired","dependentSchemas","if","then","else"]) assert.equal(serialized.includes(`\"${unsupported}\"`),false,`unsupported strict-schema keyword: ${unsupported}`);
  assert.equal(OPENAI_SALES_INTELLIGENCE_JSON_SCHEMA.required.includes("rights"), false);
  assert.equal(OPENAI_SALES_INTELLIGENCE_JSON_SCHEMA.required.includes("inheritedUnknowns"), false);
  assert.equal(Object.hasOwn(OPENAI_SALES_INTELLIGENCE_JSON_SCHEMA.properties, "rights"), false);
  assert.equal(Object.hasOwn(OPENAI_SALES_INTELLIGENCE_JSON_SCHEMA.properties, "inheritedUnknowns"), false);
  assert.equal(OPENAI_SALES_INTELLIGENCE_JSON_SCHEMA.properties.evidence.items.properties.purposes.items.enum.includes("content_rights"), false);
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

test("actual serialized Responses request carries the reviewed schema bytes; this is compatibility validation, not live provider acceptance",async()=>{let body;const provider=new OpenAIResponsesWebSalesProvider({apiKey:"synthetic",model:"gpt-5.6-terra",fetchImpl:async(_url,init)=>{body=JSON.parse(init.body);return new Response(JSON.stringify({error:{type:"synthetic_stop"}}),{status:400,headers:{"content-type":"application/json"}})}}),projection=verifySalesProviderIntelligenceProjection({salesContractSha256:syntheticSalesContractMetadata.sha256}),input={envelope:envelope(),founderAuthorization:{authorized:true,scope:"one_sales_research_run"},budgetAuthority:{confirmedByFounder:true,salesMonthSpendUsd:0,commercialDepartmentMonthSpendUsd:0}};await assert.rejects(provider.research(input,{salesContract:syntheticSalesContractMetadata,providerProjection:projection,envelope:input.envelope,commercialPositioning:verifyCommercialPositioning()},new AbortController().signal));assert.deepEqual(body.text.format.schema,OPENAI_SALES_INTELLIGENCE_JSON_SCHEMA);assert.equal(body.text.format.strict,true);assert.equal(body.store,false);assert.equal(body.parallel_tool_calls,false);assert.equal(JSON.stringify(body).includes("uniqueItems"),false);});

test("provider errors are consumed once and sanitized", async () => {
  let reads = 0;
  const response = { status: 400, headers: new Headers({ "x-request-id": "req_sales_safe" }), async text() { reads += 1; return JSON.stringify({ error: { message: "Authorization: Bearer sk-secret {\"instructions\":\"private\"}", type: "invalid_request_error", code: "bad", param: "text.format.schema" } }); } };
  const diagnostics = await consumeSalesProviderErrorDiagnostics(response); const formatted = formatSalesProviderErrorDiagnostics(diagnostics);
  assert.equal(reads, 1); assert.match(formatted, /invalid_request_error/); assert.doesNotMatch(formatted, /sk-secret|Authorization|private/);
});
