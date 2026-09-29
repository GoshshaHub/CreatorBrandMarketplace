import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../../../lib/firebase-admin";
import { authorizeCrmAdmin } from "../../../../../../lib/agents/crm-01/admin-auth";
import { loadCrmContractMetadata } from "../../../../../../lib/agents/crm-01/contract";
import { CrmRevenueSnapshotError } from "../../../../../../lib/agents/crm-01/revenue-snapshot";
import { getCrmRevenueSnapshot } from "../../../../../../lib/agents/crm-01/revenue-snapshot-service";
import { crmReadErrorResponse } from "../../../../../../lib/agents/crm-01/read-route";
import { COMMERCIAL_GOAL_SHA256 } from "../../../../../../lib/agents/revenue-01/commercial-goals";
import { loadRevenueContractMetadata, RevenueContractIntegrityError } from "../../../../../../lib/agents/revenue-01/contract";
import { createDeterministicRevenueRecommendation } from "../../../../../../lib/agents/revenue-01/service";
import type { RevenueRunContext } from "../../../../../../lib/agents/revenue-01/types";
import { normalizeRevenueRunContext, RevenueValidationError } from "../../../../../../lib/agents/revenue-01/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_REQUEST_BYTES = 2_048;
const APPROVED_GOAL_SHA256 = "692a00c032d7ac1fea441b7d1bdf695fe2d6125e7a47bcd704fde0d17bb446d6";
const noStoreHeaders = { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" } as const;
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: noStoreHeaders });
const identifier = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

function parseRequest(value: unknown): { accountId: string; pursuitId: string; runContext: RevenueRunContext } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RevenueValidationError("invalid_request", "Request must be an object.");
  const body = value as Record<string, unknown>;
  if (!exactKeys(body, ["accountId", "pursuitId", "runContext"]) || !identifier(body.accountId) || !identifier(body.pursuitId) || !body.runContext || typeof body.runContext !== "object" || Array.isArray(body.runContext)) throw new RevenueValidationError("invalid_request", "Valid Account, Pursuit and Founder run context are required.");
  const raw = body.runContext as Record<string, unknown>;
  if (!exactKeys(raw, ["reportingMonth", "founderSuppliedCollectedBaseline", "baselineEvidenceClassification"])) throw new RevenueValidationError("invalid_run_context", "Founder run context contains unsupported fields.");
  return { accountId: body.accountId, pursuitId: body.pursuitId, runContext: normalizeRevenueRunContext(raw as RevenueRunContext) };
}

export async function POST(request: Request) {
  try {
    const length = Number(request.headers.get("content-length") || "0");
    if (length > MAX_REQUEST_BYTES) return response({ code: "request_too_large", error: "REVENUE request exceeds the approved size limit." }, 413);
    const admin = await authorizeCrmAdmin(request, { verifyIdToken: (token) => adminAuth.verifyIdToken(token), loadUser: async (uid) => { const user = await adminDb.collection("users").doc(uid).get(); return { exists: user.exists, isAdmin: user.data()?.isAdmin === true }; } });
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_REQUEST_BYTES) return response({ code: "request_too_large", error: "REVENUE request exceeds the approved size limit." }, 413);
    let decoded: unknown;
    try { decoded = JSON.parse(raw); } catch { return response({ code: "invalid_json", error: "REVENUE request must be valid JSON." }, 400); }
    const input = parseRequest(decoded);
    const now = new Date();
    await loadRevenueContractMetadata(now);
    if (COMMERCIAL_GOAL_SHA256 !== APPROVED_GOAL_SHA256) throw new RevenueValidationError("commercial_goal_mismatch", "Commercial goal integrity check failed.");
    const crmContract = await loadCrmContractMetadata(now);
    const snapshotResult = await getCrmRevenueSnapshot({ db: adminDb, accountId: input.accountId, pursuitId: input.pursuitId, generatedAt: now.toISOString(), generatedByUid: admin.uid, crmContractVersion: crmContract.version, crmContractSha256: crmContract.sha256 });
    if (snapshotResult.snapshot.snapshotIdentity.accountId !== input.accountId || snapshotResult.snapshot.snapshotIdentity.pursuitId !== input.pursuitId) throw new RevenueValidationError("scope_mismatch", "Fresh CRM snapshot scope does not match the requested Account and Pursuit.");
    const recommendation = await createDeterministicRevenueRecommendation({ snapshot: snapshotResult.snapshot, runContext: input.runContext, now });
    return response({ outcome: "proposed", snapshot: snapshotResult.snapshot, recommendation, persisted: false });
  } catch (error) {
    if (error instanceof RevenueValidationError) return response({ code: error.code, error: error.message }, 422);
    if (error instanceof RevenueContractIntegrityError) return response({ code: "contract_integrity_failed", error: error.message }, 500);
    if (error instanceof CrmRevenueSnapshotError) return response({ code: error.code, error: error.message }, error.code === "required_record_missing" ? 404 : 422);
    return crmReadErrorResponse(error);
  }
}
