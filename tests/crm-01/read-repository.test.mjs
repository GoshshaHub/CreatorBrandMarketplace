import assert from "node:assert/strict";
import test from "node:test";
import { readCrmRecordPage } from "../../lib/agents/crm-01/read-repository.ts";
import { decodeReadCursor } from "../../lib/agents/crm-01/read-validation.ts";

function document(index, displayName = `Brand ${index}`) {
  const value = { id: `acct-${index}`, entityType: "account", revision: 1, createdAt: "2026-09-26T00:00:00.000Z", updatedAt: `2026-09-26T00:${String(60 - index).padStart(2, "0")}:00.000Z`, data: { displayName, dnc: "unknown", dncEvaluation: "review_required" }, provenance: [], history: [] };
  return { id: value.id, data: () => value };
}
function database(documents) {
  const query = { orderBy() { return this; }, limit() { return this; }, startAfter() { return this; }, async get() { return { docs: documents, size: documents.length }; } };
  return { collection() { return query; } };
}

test("filtered pagination cursor advances from the last returned record without skipping matches", async () => {
  const documents = Array.from({ length: 30 }, (_, index) => document(index + 1));
  const page = await readCrmRecordPage({ db: database(documents), collection: "accounts", resource: "accounts", limit: 25, filters: {}, cursorValue: null });
  assert.equal(page.records.length, 25);
  assert.equal(decodeReadCursor(page.nextCursor, "accounts", {})?.id, "acct-25");
});

test("server-side filters are bounded and DNC uses canonical evaluation", async () => {
  const documents = [document(1, "Alpha"), document(2, "Beta")];
  const page = await readCrmRecordPage({ db: database(documents), collection: "accounts", resource: "accounts", limit: 25, filters: { search: "alp", dnc: "review_required" }, cursorValue: null });
  assert.deepEqual(page.records.map((item) => item.id), ["acct-1"]);
  assert.equal(page.nextCursor, null);
});
