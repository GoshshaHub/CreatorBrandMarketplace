import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "../../../../../../lib/firebase-admin";
import { authorizeSalesAdmin, SalesAdminAuthError } from "../../../../../../lib/agents/sales-01/admin-auth";
import { loadSalesContractMetadata, SalesContractIntegrityError } from "../../../../../../lib/agents/sales-01/contract";
import { buildSalesIntakeSummary } from "../../../../../../lib/agents/sales-01/summary";
import type { SalesIntakeRequest } from "../../../../../../lib/agents/sales-01/types";
import { MAX_SALES_INTAKE_BYTES, validateSalesIntake } from "../../../../../../lib/agents/sales-01/validation";

export const runtime = "nodejs";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: message, code, persisted: false, downstreamInvoked: false, externalAction: false }, { status });
}

export async function POST(request: Request) {
  try {
    const declaredLength = Number(request.headers.get("content-length") || "0");
    if (declaredLength > MAX_SALES_INTAKE_BYTES) return errorResponse(413, "request_too_large", "SALES intake exceeds the approved size limit.");
    const authorized = await authorizeSalesAdmin(request, {
      verifyIdToken: (token) => adminAuth.verifyIdToken(token),
      loadUser: async (uid) => {
        const snapshot = await adminDb.collection("users").doc(uid).get();
        return { exists: snapshot.exists, isAdmin: snapshot.data()?.isAdmin === true };
      },
    });
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_SALES_INTAKE_BYTES) return errorResponse(413, "request_too_large", "SALES intake exceeds the approved size limit.");
    let input: SalesIntakeRequest;
    try {
      input = JSON.parse(rawBody) as SalesIntakeRequest;
    } catch {
      return errorResponse(400, "invalid_json", "SALES intake must be valid JSON.");
    }
    const salesContract = await loadSalesContractMetadata();
    const result = validateSalesIntake({ input, approvedByUid: authorized.uid, approvedAt: new Date().toISOString(), salesContract });
    result.summaryMarkdown = buildSalesIntakeSummary(result.envelope, result.findings);
    return NextResponse.json(result, {
      status: result.status === "valid" ? 200 : 422,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof SalesAdminAuthError) return errorResponse(error.status, "authorization_failed", error.message);
    if (error instanceof SalesContractIntegrityError) return errorResponse(500, "contract_integrity_failed", error.message);
    console.error("SALES-01 Phase 1A intake failed", error instanceof Error ? error.name : "unknown_error");
    return errorResponse(500, "sales_intake_failed", "SALES intake could not be completed. No workspace or downstream state was created.");
  }
}
