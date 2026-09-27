import { createHash } from "crypto";

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).sort().reduce<Record<string, unknown>>((out, key) => {
      const item = (value as Record<string, unknown>)[key];
      if (item !== undefined) out[key] = normalize(item);
      return out;
    }, {});
  }
  return value;
}

export function crmCanonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function crmSha256(value: unknown): string {
  return createHash("sha256").update(crmCanonicalJson(value)).digest("hex");
}

export function crmStableId(prefix: string, value: unknown): string {
  return `${prefix}_${crmSha256(value).slice(0, 24)}`;
}
