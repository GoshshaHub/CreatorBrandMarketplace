import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "../../../../../../lib/firebase-admin";
import { authorizeGrowthAdmin, GrowthAdminAuthError } from "../../../../../../lib/agents/growth-01/admin-auth";
import { loadGrowthContractMetadata } from "../../../../../../lib/agents/growth-01/contract";
import { OpenAIResponsesWebResearchProvider } from "../../../../../../lib/agents/growth-01/providers/openai-responses-web";
import { calculateSpendingAuthority } from "../../../../../../lib/agents/growth-01/research-provider";
import { loadGrowthResearchContract } from "../../../../../../lib/agents/growth-01/research-prompt";
import { GrowthResearchError, MAX_RESEARCH_REQUEST_BYTES, PROVIDER_TIMEOUT_MS, MAX_WEB_SEARCH_CALLS, validateGrowthResearchRequest } from "../../../../../../lib/agents/growth-01/research-schema";
import type { GrowthResearchRequest, GrowthResearchResult } from "../../../../../../lib/agents/growth-01/research-types";

export const runtime = "nodejs";
export const maxDuration = 180;

const providerFailureCodes = new Set(["provider_not_configured", "provider_rate_limited", "provider_request_failed", "provider_incomplete", "provider_timeout", "provider_failure_ambiguous"]);

function errorResponse(status: number, code: string, message: string, providerExecution: GrowthResearchError["providerExecution"] = null) {
  return NextResponse.json({
    error: message,
    code,
    outcome: providerExecution?.outcome || (providerFailureCodes.has(code) ? "provider_failed" : null),
    providerExecution,
    persisted: false,
    downstreamInvoked: false,
    automaticRetry: false,
  }, { status });
}

export async function POST(request: Request) {
  try {
    const declaredLength = Number(request.headers.get("content-length") || "0");
    if (declaredLength > MAX_RESEARCH_REQUEST_BYTES) return errorResponse(413, "request_too_large", "Research request exceeds the approved size limit.");
    const authorized = await authorizeGrowthAdmin(request, {
      verifyIdToken: (token) => adminAuth.verifyIdToken(token),
      loadUser: async (uid) => {
        const snapshot = await adminDb.collection("users").doc(uid).get();
        return { exists: snapshot.exists, isAdmin: snapshot.data()?.isAdmin === true };
      },
    });
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_RESEARCH_REQUEST_BYTES) return errorResponse(413, "request_too_large", "Research request exceeds the approved size limit.");
    let input: GrowthResearchRequest;
    try {
      input = JSON.parse(rawBody) as GrowthResearchRequest;
    } catch {
      return errorResponse(400, "invalid_json", "Research request must be valid JSON.");
    }
    const requestErrors = validateGrowthResearchRequest(input);
    if (requestErrors.length) return NextResponse.json({ error: "Research request is invalid.", code: "request_invalid", findings: requestErrors, persisted: false, downstreamInvoked: false, automaticRetry: false }, { status: 400 });
    const spendingAuthority = calculateSpendingAuthority(input.budgetAuthority);
    if (!spendingAuthority.fullProfileAuthorized) {
      return NextResponse.json({
        error: "The full research profile is not authorized by the lowest remaining $1 → $20 → $50 spending boundary.",
        code: "spending_authority_insufficient",
        spendingAuthority,
        cumulativeLimitsTechnicallyEnforced: false,
        persisted: false,
        downstreamInvoked: false,
        automaticRetry: false,
      }, { status: 409 });
    }

    const [contract, researchContract] = await Promise.all([loadGrowthContractMetadata(), loadGrowthResearchContract()]);
    if (contract.sha256 !== researchContract.sha256) throw new GrowthResearchError("contract_hash_mismatch", "Frozen contract changed while preparing research.", 500);
    const model = process.env.OPENAI_GROWTH_MODEL?.trim() || "gpt-5.6-terra";
    const provider = new OpenAIResponsesWebResearchProvider({ apiKey: process.env.OPENAI_API_KEY?.trim() || "", model });
    const controller = new AbortController();
    const proposal = await provider.research(input, {
      contractText: researchContract.text,
      contractSha256: contract.sha256,
      asOfDate: input.asOfDate,
      marketFocus: input.marketFocus,
      founderResearchFocus: input.founderResearchFocus?.trim() || "",
      maximumCandidates: input.maximumCandidates,
      maximumQualified: input.maximumQualified,
    }, controller.signal);

    const output: GrowthResearchResult = {
      outcome: "accepted",
      researchRun: {
        requestedByUid: authorized.uid,
        requestedAt: new Date().toISOString(),
        providerTimeoutMs: PROVIDER_TIMEOUT_MS,
        maximumWebSearchCalls: MAX_WEB_SEARCH_CALLS,
        maximumCandidates: input.maximumCandidates,
        maximumQualified: input.maximumQualified,
      },
      contract,
      spendingAuthority,
      proposal,
    };
    return NextResponse.json(output, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof GrowthAdminAuthError) return errorResponse(error.status, "authorization_failed", error.message);
    if (error instanceof GrowthResearchError) return errorResponse(error.httpStatus, error.code, error.message, error.providerExecution);
    console.error("GROWTH-01 live research failed", error instanceof Error ? error.name : "unknown_error");
    return errorResponse(500, "research_failed", "Live research could not be completed. No result was saved or sent downstream.");
  }
}
