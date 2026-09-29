import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../../../lib/firebase-admin";
import { authorizeCrmAdmin, CrmAdminAuthError } from "../../../../../../lib/agents/crm-01/admin-auth";
import { CrmContractIntegrityError, loadCrmContractMetadata } from "../../../../../../lib/agents/crm-01/contract";
import { loadCrmSnapshot } from "../../../../../../lib/agents/crm-01/firestore";
import { buildCrmIngestionPlan } from "../../../../../../lib/agents/crm-01/planner";
import type { CrmPreviewRequest } from "../../../../../../lib/agents/crm-01/types";
import { CrmValidationError, MAX_CRM_INGESTION_BYTES, validateCrmSalesExport } from "../../../../../../lib/agents/crm-01/validation";
export const runtime = "nodejs";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  try {
    await authorizeCrmAdmin(request, { verifyIdToken: (token) => adminAuth.verifyIdToken(token), loadUser: async (uid) => { const snap = await adminDb.collection("users").doc(uid).get(); return { exists: snap.exists, isAdmin: snap.data()?.isAdmin === true }; } });
    const raw = await request.text(); if (Buffer.byteLength(raw) > MAX_CRM_INGESTION_BYTES) return reply({ code: "request_too_large" }, 413);
    const input = JSON.parse(raw) as CrmPreviewRequest; const artifact = validateCrmSalesExport(input.export); const contract = await loadCrmContractMetadata();
    const at = artifact.source.acceptedSalesPlaybook.createdAt;
    const first = buildCrmIngestionPlan({ artifact, snapshot: await loadCrmSnapshot(adminDb, artifact), mappings: input.mappings, crmContractSha256: contract.sha256, at });
    const snapshot = await loadCrmSnapshot(adminDb, artifact, [...first.creates, ...first.updates, ...first.infrastructureOperations].map((op) => op.path));
    const plan = buildCrmIngestionPlan({ artifact, snapshot, mappings: input.mappings, crmContractSha256: contract.sha256, at });
    return reply({ contract, plan, persisted: false, externalAction: false });
  } catch (error) {
    if (error instanceof CrmAdminAuthError) return reply({ code: "authorization_failed", error: error.message }, error.status);
    if (error instanceof CrmValidationError) return reply({ code: error.code, error: error.message }, 422);
    if (error instanceof CrmContractIntegrityError) return reply({ code: "contract_integrity_failed", error: error.message }, 500);
    if (error instanceof SyntaxError) return reply({ code: "invalid_json", error: "Valid JSON is required." }, 400);
    console.error("CRM preview failed", error instanceof Error ? error.name : "unknown_error"); return reply({ code: "crm_preview_failed", error: "CRM preview failed without persistence." }, 500);
  }
}
