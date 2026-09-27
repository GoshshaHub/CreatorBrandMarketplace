import { authorizeCrmRead, crmReadErrorResponse, crmReadResponse } from "../../../../../../../lib/agents/crm-01/read-route";
import { getCrmAccountDetail } from "../../../../../../../lib/agents/crm-01/read-service";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ accountId: string }> }) { try { const { db } = await authorizeCrmRead(request); const { accountId } = await context.params; if (!/^[A-Za-z0-9_-]{1,128}$/.test(accountId)) return crmReadResponse({ code: "invalid_account_id", error: "Invalid CRM Account ID." }, 400); return crmReadResponse(await getCrmAccountDetail(db, accountId, new Date().toISOString())); } catch (error) { return crmReadErrorResponse(error); } }
