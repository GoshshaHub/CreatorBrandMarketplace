import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../../../lib/firebase-admin";
import { authorizeCrmAdmin, CrmAdminAuthError } from "../../../../../../lib/agents/crm-01/admin-auth";
import { CrmContractIntegrityError, loadCrmContractMetadata } from "../../../../../../lib/agents/crm-01/contract";
import { commitCrmIngestion } from "../../../../../../lib/agents/crm-01/firestore";
import { CrmIngestionError } from "../../../../../../lib/agents/crm-01/ingestion";
import type { CrmIngestRequest } from "../../../../../../lib/agents/crm-01/types";
import { CrmValidationError, MAX_CRM_INGESTION_BYTES, validateCrmSalesExport } from "../../../../../../lib/agents/crm-01/validation";
export const runtime = "nodejs";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  try {
    const admin = await authorizeCrmAdmin(request, { verifyIdToken: (token) => adminAuth.verifyIdToken(token), loadUser: async (uid) => { const snap = await adminDb.collection("users").doc(uid).get(); return { exists: snap.exists, isAdmin: snap.data()?.isAdmin === true }; } });
    const raw = await request.text(); if (Buffer.byteLength(raw) > MAX_CRM_INGESTION_BYTES) return reply({ code: "request_too_large" }, 413);
    const input = JSON.parse(raw) as CrmIngestRequest; const artifact = validateCrmSalesExport(input.export); const contract = await loadCrmContractMetadata();
    const receipt = await commitCrmIngestion({ db: adminDb, artifact, submittedPlan: input.plan, approval: input.approval, uid: admin.uid, crmContractSha256: contract.sha256, at: input.approval.approvedAt });
    return reply({ receipt, crmWriteCompleted: true, outreachAuthorized: false, downstreamInvoked: false, externalAction: false });
  } catch (error) {
    if (error instanceof CrmAdminAuthError) return reply({ code: "authorization_failed", error: error.message }, error.status);
    if (error instanceof CrmValidationError) return reply({ code: error.code, error: error.message }, 422);
    if (error instanceof CrmIngestionError) return reply({ code: error.code, error: error.message }, error.code === "revision_conflict" ? 409 : 422);
    if (error instanceof CrmContractIntegrityError) return reply({ code: "contract_integrity_failed", error: error.message }, 500);
    if (error instanceof SyntaxError) return reply({ code: "invalid_json", error: "Valid JSON is required." }, 400);
    console.error("CRM ingestion failed", error instanceof Error ? error.name : "unknown_error"); return reply({ code: "crm_ingestion_failed", error: "CRM ingestion failed atomically." }, 500);
  }
}
