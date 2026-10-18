import { crmSha256, crmStableId } from "./canonical";
import type { CrmStoredRecord } from "./types";

export const CRM_SUPPRESSION_CHECK_SCHEMA = "crm-authoritative-suppression-check-v1" as const;
export type CrmSuppressionCheckResult = "suppression_found" | "no_applicable_suppression_found" | "not_checked_or_unavailable" | "conflicting";
export type CrmSuppressionCheckV1 = {
  schemaVersion: typeof CRM_SUPPRESSION_CHECK_SCHEMA;
  checkId: string;
  checkSha256: string;
  accountId: string;
  recipient: { type: "crm_contact" | "company_route"; id: string; channel: string };
  checkedAt: string;
  checkedRecordPaths: string[];
  checkedRevisionBindings: Array<{ recordPath: string; revision: number }>;
  result: CrmSuppressionCheckResult;
  consentInferred: false;
  sendingAuthorized: false;
};

export function verifySuppressionCheck(check: CrmSuppressionCheckV1): boolean {
  const { checkId, checkSha256, ...body } = check;
  return check.schemaVersion === CRM_SUPPRESSION_CHECK_SCHEMA && crmStableId("suppressioncheck", body) === checkId && crmSha256(body) === checkSha256;
}

const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const path = (record: CrmStoredRecord) => `crm/${record.entityType === "salesPursuit" ? "salesPursuits" : `${record.entityType}s`}/records/${record.id}`;
const state = (record: CrmStoredRecord) => String(object(record.data).dnc && object(object(record.data).dnc).status || object(record.data).dnc || "unknown");

export function buildAuthoritativeSuppressionCheck(input: { accountId: string; recipient: { type: "crm_contact" | "company_route"; id: string; channel: string }; records: CrmStoredRecord[]; checkedAt: string }): CrmSuppressionCheckV1 {
  const account = input.records.find(record => record.entityType === "account" && record.id === input.accountId);
  const contact = input.recipient.type === "crm_contact" ? input.records.find(record => record.entityType === "contact" && record.id === input.recipient.id && object(record.data).accountId === input.accountId) : null;
  const routeEvidence = input.recipient.type === "company_route" ? input.records.filter(record => record.entityType === "contact" && object(record.data).accountId === input.accountId) : [];
  const scoped = [account, contact, ...routeEvidence].filter((record): record is CrmStoredRecord => Boolean(record));
  const statuses = input.recipient.type === "company_route" ? (account ? [state(account)] : []) : [account,contact].filter((record):record is CrmStoredRecord=>Boolean(record)).map(state);
  const result: CrmSuppressionCheckResult = !account || (input.recipient.type === "crm_contact" && !contact) || (input.recipient.type === "company_route" && !routeEvidence.length) ? "not_checked_or_unavailable" : statuses.includes("active") ? "suppression_found" : statuses.includes("conflicting") ? "conflicting" : statuses.length>0&&statuses.every(item => item === "inactive") ? "no_applicable_suppression_found" : "not_checked_or_unavailable";
  const body = { schemaVersion: CRM_SUPPRESSION_CHECK_SCHEMA, accountId: input.accountId, recipient: input.recipient, checkedAt: input.checkedAt, checkedRecordPaths: scoped.map(path).sort(), checkedRevisionBindings: scoped.map(record => ({ recordPath: path(record), revision: record.revision })).sort((a,b)=>a.recordPath.localeCompare(b.recordPath)), result, consentInferred: false as const, sendingAuthorized: false as const };
  return { ...body, checkId: crmStableId("suppressioncheck", body), checkSha256: crmSha256(body) };
}
