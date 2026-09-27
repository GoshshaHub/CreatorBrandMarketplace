import { authorizeCrmRead, crmReadErrorResponse, crmReadResponse } from "../../../../../../lib/agents/crm-01/read-route";
import { getAttentionPage } from "../../../../../../lib/agents/crm-01/read-service";
import { normalizeReadFilters, parseReadLimit } from "../../../../../../lib/agents/crm-01/read-validation";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(request: Request) { try { const { db } = await authorizeCrmRead(request); const url = new URL(request.url); const filters = normalizeReadFilters({ attentionStatus: url.searchParams.get("status") }); return crmReadResponse(await getAttentionPage({ db, limit: parseReadLimit(url.searchParams.get("limit")), filters, cursor: url.searchParams.get("cursor"), now: new Date().toISOString() })); } catch (error) { return crmReadErrorResponse(error); } }
