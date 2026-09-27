import { crmCanonicalJson, crmSha256 } from "./canonical";
import { CRM_READ_DEFAULT_LIMIT, CRM_READ_MAX_LIMIT } from "./read-types";

export class CrmReadValidationError extends Error {
  code: "invalid_query" | "invalid_cursor" | "cursor_filter_mismatch";
  constructor(code: CrmReadValidationError["code"], message: string) { super(message); this.name = "CrmReadValidationError"; this.code = code; }
}
export type CrmReadCursor = { version: "crm-read-cursor-v1"; resource: string; filterHash: string; updatedAt: string; id: string; checksum: string };

export function parseReadLimit(value: string | null): number {
  if (value === null || value === "") return CRM_READ_DEFAULT_LIMIT;
  if (!/^\d+$/.test(value)) throw new CrmReadValidationError("invalid_query", "The page limit must be a positive integer.");
  const limit = Number(value);
  if (limit < 1 || limit > CRM_READ_MAX_LIMIT) throw new CrmReadValidationError("invalid_query", `The page limit must be between 1 and ${CRM_READ_MAX_LIMIT}.`);
  return limit;
}

export function normalizeReadFilters(input: Record<string, string | null | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(input).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1]!.trim() !== "").map(([key, value]) => [key, value.trim()]));
}

function cursorBody(value: Omit<CrmReadCursor, "checksum">) { return value; }

export function encodeReadCursor(resource: string, filters: Record<string, string>, updatedAt: string, id: string): string {
  const body = { version: "crm-read-cursor-v1" as const, resource, filterHash: crmSha256(filters), updatedAt, id };
  return Buffer.from(crmCanonicalJson({ ...body, checksum: crmSha256(cursorBody(body)) }), "utf8").toString("base64url");
}

export function decodeReadCursor(value: string | null, resource: string, filters: Record<string, string>): CrmReadCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as CrmReadCursor;
    const body = { version: parsed.version, resource: parsed.resource, filterHash: parsed.filterHash, updatedAt: parsed.updatedAt, id: parsed.id };
    if (parsed.version !== "crm-read-cursor-v1" || !parsed.id || !parsed.updatedAt || parsed.resource !== resource || parsed.checksum !== crmSha256(body)) throw new Error("invalid");
    if (parsed.filterHash !== crmSha256(filters)) throw new CrmReadValidationError("cursor_filter_mismatch", "The cursor cannot be reused with different filters.");
    return parsed;
  } catch (error) {
    if (error instanceof CrmReadValidationError) throw error;
    throw new CrmReadValidationError("invalid_cursor", "The CRM pagination cursor is invalid.");
  }
}
