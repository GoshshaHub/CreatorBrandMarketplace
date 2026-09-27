import { authorizeCrmRead, crmReadErrorResponse, crmReadResponse } from "../../../../../../lib/agents/crm-01/read-route";
import { getCrmDashboard } from "../../../../../../lib/agents/crm-01/read-service";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(request: Request) { try { const { db } = await authorizeCrmRead(request); return crmReadResponse(await getCrmDashboard(db, new Date().toISOString())); } catch (error) { return crmReadErrorResponse(error); } }
