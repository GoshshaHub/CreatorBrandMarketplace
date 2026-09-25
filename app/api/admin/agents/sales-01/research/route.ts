import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "../../../../../../lib/firebase-admin";
import { authorizeSalesAdmin, SalesAdminAuthError } from "../../../../../../lib/agents/sales-01/admin-auth";
import { loadSalesContractMetadata, SalesContractIntegrityError } from "../../../../../../lib/agents/sales-01/contract";
import { verifySalesProviderIntelligenceProjection, SalesProviderProjectionIntegrityError } from "../../../../../../lib/agents/sales-01/provider-intelligence-contract";
import { OpenAIResponsesWebSalesProvider } from "../../../../../../lib/agents/sales-01/providers/openai-responses-web";
import { calculateSalesSpendingAuthority } from "../../../../../../lib/agents/sales-01/research-provider";
import { MAX_SALES_RESEARCH_REQUEST_BYTES, SalesResearchError, validateSalesResearchRequest } from "../../../../../../lib/agents/sales-01/research-schema";
import type { SalesResearchRequest, SalesResearchResult } from "../../../../../../lib/agents/sales-01/research-types";

export const runtime = "nodejs";
export const maxDuration = 180;

function errorResponse(status: number, code: string, message: string, providerExecution: unknown = null) {
  return NextResponse.json({ error: message, code, providerExecution, persisted: false, crmWriteAuthorized: false, downstreamInvoked: false, externalAction: false }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const length = Number(request.headers.get("content-length") || "0"); if (length > MAX_SALES_RESEARCH_REQUEST_BYTES) return errorResponse(413, "request_too_large", "SALES research request exceeds the approved size limit.");
    await authorizeSalesAdmin(request, { verifyIdToken: (token) => adminAuth.verifyIdToken(token), loadUser: async (uid) => { const snapshot = await adminDb.collection("users").doc(uid).get(); return { exists: snapshot.exists, isAdmin: snapshot.data()?.isAdmin === true }; } });
    const raw = await request.text(); if (Buffer.byteLength(raw, "utf8") > MAX_SALES_RESEARCH_REQUEST_BYTES) return errorResponse(413, "request_too_large", "SALES research request exceeds the approved size limit.");
    let input: SalesResearchRequest; try { input = JSON.parse(raw) as SalesResearchRequest; } catch { return errorResponse(400, "invalid_json", "SALES research request must be valid JSON."); }
    const errors = validateSalesResearchRequest(input); if (errors.length) return errorResponse(422, "request_validation_failed", errors.join(" "));
    const spendingAuthority = calculateSalesSpendingAuthority({ confirmedByFounder: input.budgetAuthority.confirmedByFounder, salesMonthSpendUsd: input.budgetAuthority.salesMonthSpendUsd, commercialDepartmentMonthSpendUsd: input.budgetAuthority.commercialDepartmentMonthSpendUsd });
    if (!spendingAuthority.fullProfileAuthorized) return errorResponse(422, "spending_authority_insufficient", "The full $1 SALES run is not authorized under the Founder-supplied $20 SALES-month and $50 Commercial-AI-month totals.");
    const contract = await loadSalesContractMetadata();
    const providerProjection = verifySalesProviderIntelligenceProjection({ salesContractSha256: contract.sha256 });
    const provider = new OpenAIResponsesWebSalesProvider({ apiKey: process.env.OPENAI_API_KEY || "", model: process.env.OPENAI_SALES_MODEL || "gpt-5.6-terra" });
    const proposal = await provider.research(input, { salesContract: contract, providerProjection, envelope: input.envelope }, request.signal);
    const result: SalesResearchResult = { outcome: "accepted", providerProfile: { timeoutMs: 150_000, maximumWebSearchCalls: 6, maximumContacts: 6, maximumContactsPerRole: 2, maximumSources: 30, maximumOutputTokens: 12_000 }, contract, providerProjection, spendingAuthority, proposal };
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SalesAdminAuthError) return errorResponse(error.status, "authorization_failed", error.message);
    if (error instanceof SalesContractIntegrityError || error instanceof SalesProviderProjectionIntegrityError) return errorResponse(500, "contract_integrity_failed", error.message);
    if (error instanceof SalesResearchError) return errorResponse(error.httpStatus, error.code, error.message, error.providerExecution);
    console.error("SALES-01 research failed", error instanceof Error ? error.name : "unknown_error");
    return errorResponse(500, "sales_research_failed", "SALES research could not be completed. No data or downstream state was created.");
  }
}
