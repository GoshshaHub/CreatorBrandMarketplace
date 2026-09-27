import assert from "node:assert/strict";
import test from "node:test";
import { CRM_READ_DEFAULT_LIMIT, CRM_READ_MAX_LIMIT } from "../../lib/agents/crm-01/read-types.ts";
import { decodeReadCursor, encodeReadCursor, normalizeReadFilters, parseReadLimit } from "../../lib/agents/crm-01/read-validation.ts";

test("read limits default to 25 and are capped at 100", () => {
  assert.equal(parseReadLimit(null), CRM_READ_DEFAULT_LIMIT);
  assert.equal(parseReadLimit("100"), CRM_READ_MAX_LIMIT);
  assert.throws(() => parseReadLimit("0"), /between 1 and 100/);
  assert.throws(() => parseReadLimit("101"), /between 1 and 100/);
  assert.throws(() => parseReadLimit("1.5"), /positive integer/);
});

test("opaque cursor binds resource and exact normalized filters", () => {
  const filters = normalizeReadFilters({ search: " Buff ", dnc: "blocked", empty: "" });
  const encoded = encodeReadCursor("accounts", filters, "2026-09-26T01:00:00.000Z", "acct-1");
  assert.doesNotMatch(encoded, /acct-1|Buff/);
  assert.equal(decodeReadCursor(encoded, "accounts", filters)?.id, "acct-1");
  assert.throws(() => decodeReadCursor(encoded, "accounts", { search: "Other", dnc: "blocked" }), (error) => error.code === "cursor_filter_mismatch");
  assert.throws(() => decodeReadCursor(encoded, "pursuits", filters), (error) => error.code === "invalid_cursor");
});

test("tampered cursors fail closed", () => {
  const encoded = encodeReadCursor("accounts", {}, "2026-09-26T01:00:00.000Z", "acct-1");
  assert.throws(() => decodeReadCursor(`${encoded}x`, "accounts", {}), (error) => error.code === "invalid_cursor");
});
