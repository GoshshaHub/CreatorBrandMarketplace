import { authorizeCrmRead, crmReadErrorResponse, crmReadResponse } from "../../../../../../lib/agents/crm-01/read-route";
import { CrmRevenueSnapshotError } from "../../../../../../lib/agents/crm-01/revenue-snapshot";
import { getCrmRevenueSnapshot } from "../../../../../../lib/agents/crm-01/revenue-snapshot-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { admin, contract, db } = await authorizeCrmRead(request);
    const url = new URL(request.url); const accountId = url.searchParams.get("accountId") ?? ""; const pursuitId = url.searchParams.get("pursuitId") ?? "";
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(accountId) || !/^[A-Za-z0-9_-]{1,128}$/.test(pursuitId)) return crmReadResponse({ code: "invalid_snapshot_scope", error: "Valid Account and Pursuit IDs are required." }, 400);
    return crmReadResponse(await getCrmRevenueSnapshot({ db, accountId, pursuitId, generatedAt: new Date().toISOString(), generatedByUid: admin.uid, crmContractVersion: contract.version, crmContractSha256: contract.sha256 }));
  } catch (error) {
    if (error instanceof CrmRevenueSnapshotError) return crmReadResponse({ code: error.code, error: error.message }, error.code === "required_record_missing" ? 404 : 422);
    return crmReadErrorResponse(error);
  }
}
