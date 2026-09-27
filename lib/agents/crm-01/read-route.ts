import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../firebase-admin";
import { authorizeCrmAdmin, CrmAdminAuthError } from "./admin-auth";
import { CrmContractIntegrityError, loadCrmContractMetadata } from "./contract";
import { CrmReadNotFoundError } from "./read-service";
import { CrmReadValidationError } from "./read-validation";

export const crmNoStoreHeaders = { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" } as const;
export const crmReadResponse = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: crmNoStoreHeaders });

export async function authorizeCrmRead(request: Request) {
  const admin = await authorizeCrmAdmin(request, { verifyIdToken: (token) => adminAuth.verifyIdToken(token), loadUser: async (uid) => { const snapshot = await adminDb.collection("users").doc(uid).get(); return { exists: snapshot.exists, isAdmin: snapshot.data()?.isAdmin === true }; } });
  const contract = await loadCrmContractMetadata();
  return { admin, contract, db: adminDb };
}
export function crmReadErrorResponse(error: unknown) {
  if (error instanceof CrmAdminAuthError) return crmReadResponse({ code: "authorization_failed", error: error.message }, error.status);
  if (error instanceof CrmReadValidationError) return crmReadResponse({ code: error.code, error: error.message }, 400);
  if (error instanceof CrmReadNotFoundError) return crmReadResponse({ code: "not_found", error: error.message }, 404);
  if (error instanceof CrmContractIntegrityError) return crmReadResponse({ code: "contract_integrity_failed", error: error.message }, 500);
  console.error("CRM read failed", error instanceof Error ? error.name : "unknown_error");
  return crmReadResponse({ code: "crm_read_failed", error: "CRM data could not be read safely." }, 500);
}
