import { authorizeCrmRead, crmReadErrorResponse, crmReadResponse } from "../../../../../../lib/agents/crm-01/read-route";
import { buildAuthoritativeSuppressionCheck } from "../../../../../../lib/agents/crm-01/suppression-check";
import type { CrmStoredRecord } from "../../../../../../lib/agents/crm-01/types";
import { companyRouteRecipientId } from "../../../../../../lib/agents/crm-01/conversation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const id = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const channel = (value: unknown): value is string => typeof value === "string" && ["email","linkedin","sms","phone","meeting","other"].includes(value);

export async function POST(request: Request) {
  try {
    const { db } = await authorizeCrmRead(request);
    const body = await request.json() as Record<string, unknown>;
    if (!body || Object.keys(body).some(key => !["accountId","recipientType","recipientId","channel","routeType","routeValue","evidenceIds"].includes(key)) || !id(body.accountId) || !channel(body.channel) || !["crm_contact","company_route"].includes(String(body.recipientType))) return crmReadResponse({ code: "invalid_suppression_scope", error: "Exact Account, recipient type/identity, and channel are required." }, 400);
    const accountSnapshot = await db.doc(`crm/accounts/records/${body.accountId}`).get();
    let contactSnapshots: FirebaseFirestore.DocumentSnapshot[] = [];
    let recipientId = "";
    if(body.recipientType==="crm_contact"){if(!id(body.recipientId))return crmReadResponse({code:"invalid_suppression_scope",error:"A valid Contact identity is required."},400);recipientId=body.recipientId;const contact=await db.doc(`crm/contacts/records/${recipientId}`).get();if(contact.exists)contactSnapshots=[contact as FirebaseFirestore.QueryDocumentSnapshot];}
    else {
      const evidenceIds = Array.isArray(body.evidenceIds) ? body.evidenceIds.filter(id) : [];
      if (body.routeType !== "general_company" || typeof body.routeValue !== "string" || !/^https?:\/\//.test(body.routeValue) || !evidenceIds.length) return crmReadResponse({ code: "invalid_suppression_scope", error: "An evidenced HTTP(S) general-company route is required." }, 400);
      recipientId = companyRouteRecipientId({ accountId: body.accountId, channel: body.channel, routeType: "general_company", value: body.routeValue, evidenceIds });
      const matches = await db.collection("crm/contacts/records").where("data.accountId", "==", body.accountId).limit(100).get();
      contactSnapshots = matches.docs.filter(snapshot => {
        const data = (snapshot.data() as CrmStoredRecord).data as Record<string, unknown>;
        const candidate = data.contactRoute as Record<string, unknown> | undefined;
        const candidateEvidenceIds = Array.isArray(candidate?.evidenceIds) ? candidate.evidenceIds.filter(id) : [];
        return candidate?.type === "general_company" && candidate.value === body.routeValue && evidenceIds.every(item => candidateEvidenceIds.includes(item));
      });
      if (!contactSnapshots.length) return crmReadResponse({ code: "route_evidence_unavailable", error: "The company route is not evidenced by current canonical Account Contacts." }, 422);
    }
    const records = [accountSnapshot, ...contactSnapshots].filter(snapshot => snapshot?.exists).map(snapshot => snapshot!.data() as CrmStoredRecord);
    const check = buildAuthoritativeSuppressionCheck({ accountId: body.accountId, recipient: { type: body.recipientType as "crm_contact"|"company_route", id: recipientId, channel: body.channel }, records, checkedAt: new Date().toISOString() });
    return crmReadResponse({ check, effect: { consentEstablished: false, sendingAuthorized: false, crmMutationAuthorized: false }, cache: "no-store" });
  } catch (error) { return crmReadErrorResponse(error); }
}
