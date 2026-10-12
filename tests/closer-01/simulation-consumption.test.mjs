import assert from "node:assert/strict";
import test from "node:test";
import { CloserSimulationConsumptionError, CLOSER_SIMULATION_CONSUMPTION_PATH, CLOSER_SIMULATION_CONSUMPTION_RECEIPT_SCHEMA, createSharedInMemorySimulationReceiptStore, InMemoryAtomicSimulationConsumptionCoordinator, simulationConsumptionReceiptId } from "../../lib/agents/closer-01/simulation-consumption.ts";
import { readFile } from "node:fs/promises";

const NOW = "2026-09-28T12:05:00.000Z";
const base = { authorityId: "authority", authoritySha256: "a".repeat(64), founderUid: "founder", accountId: "account", pursuitId: "pursuit", expiresAt: "2026-09-28T12:15:00.000Z" };
const coordinator = (store, now = NOW) => new InMemoryAtomicSimulationConsumptionCoordinator(store, () => now);

test("receipt identity is authority-derived and receipt stores only minimal allowlisted fields", async () => {
  const store = createSharedInMemorySimulationReceiptStore(), c = coordinator(store); await c.consumeOnce(base, async () => "ok"); const value = c.getReceipt(base);
  assert.equal(CLOSER_SIMULATION_CONSUMPTION_PATH, "crm/closerSimulationConsumption/receipts");
  assert.deepEqual(Object.keys(value).sort(), ["accountId", "authorityExpiresAt", "authorityId", "authoritySha256", "consumedAt", "founderUid", "pursuitId", "receiptId", "schemaVersion", "state"]);
  assert.equal(value.schemaVersion, CLOSER_SIMULATION_CONSUMPTION_RECEIPT_SCHEMA); assert.equal(value.state, "consumed_before_generation");
  for (const forbidden of ["statement", "message", "packet", "credential", "claim", "offer"]) assert.equal(Object.hasOwn(value, forbidden), false);
});

test("two independent coordinator instances racing share one atomic outcome and only one reaches generation", async () => {
  const store = createSharedInMemorySimulationReceiptStore(), a = coordinator(store), b = coordinator(store); let generated = 0;
  const operation = async () => { generated += 1; await new Promise(resolve => setTimeout(resolve, 15)); return "generated"; };
  const results = await Promise.allSettled([a.consumeOnce(base, operation), b.consumeOnce(base, operation)]);
  assert.equal(results.filter(x => x.status === "fulfilled").length, 1); assert.equal(results.filter(x => x.status === "rejected" && x.reason.code === "authority_consumed").length, 1); assert.equal(generated, 1);
});

test("replay and altered Founder or workspace scope cannot create a fresh key for the same authority", async () => {
  const store = createSharedInMemorySimulationReceiptStore(), a = coordinator(store); await a.consumeOnce(base, async () => true);
  for (const changed of [{ ...base, founderUid: "otherFounder" }, { ...base, accountId: "otherAccount" }, { ...base, pursuitId: "otherPursuit" }]) { assert.equal(simulationConsumptionReceiptId(changed), simulationConsumptionReceiptId(base)); await assert.rejects(coordinator(store).consumeOnce(changed, async () => true), error => error instanceof CloserSimulationConsumptionError && error.code === "authority_consumed"); }
});

test("altered authority identity gets a different key but cannot pass upstream authority integrity", () => { assert.notEqual(simulationConsumptionReceiptId({ ...base, authoritySha256: "b".repeat(64) }), simulationConsumptionReceiptId(base)); });

test("expired authority fails independently of receipt existence and cleanup cannot restore it", async () => {
  const store = createSharedInMemorySimulationReceiptStore(), initial = coordinator(store); await initial.consumeOnce(base, async () => true); initial.deleteExpiredReceiptForTest(base, "2026-09-28T12:16:00.000Z"); assert.equal(store.receipts.size, 0);
  await assert.rejects(coordinator(store, "2026-09-28T12:16:00.000Z").consumeOnce(base, async () => true), error => error instanceof CloserSimulationConsumptionError && error.code === "authority_expired");
});

test("cleanup before expiry is refused", async () => { const store = createSharedInMemorySimulationReceiptStore(), c = coordinator(store); await c.consumeOnce(base, async () => true); assert.throws(() => c.deleteExpiredReceiptForTest(base, NOW), error => error.code === "receipt_not_expired"); });

test("store unavailable and uncertain transaction outcomes fail before generation", async () => {
  for (const mode of ["unavailable", "uncertain"]) { const store = createSharedInMemorySimulationReceiptStore(); store.failMode = mode; let generated = false; await assert.rejects(coordinator(store).consumeOnce(base, async () => { generated = true; }), error => error instanceof CloserSimulationConsumptionError && error.code === (mode === "unavailable" ? "consumption_store_unavailable" : "consumption_outcome_uncertain")); assert.equal(generated, false); }
});

test("generation failure leaves the durable receipt consumed", async () => { const store = createSharedInMemorySimulationReceiptStore(), c = coordinator(store); await assert.rejects(c.consumeOnce(base, async () => { throw new Error("generation failed"); }), /generation failed/); assert.equal(c.isConsumed(base), true); await assert.rejects(coordinator(store).consumeOnce(base, async () => true), error => error.code === "authority_consumed"); });

test("a new server-issued authority identity can be consumed after the prior authority is final", async () => { const store = createSharedInMemorySimulationReceiptStore(), oldAuthority = base, freshAuthority = { ...base, authorityId: "authority-fresh-approval", authoritySha256: "e".repeat(64), expiresAt: "2026-09-28T12:20:00.000Z" }; await coordinator(store).consumeOnce(oldAuthority, async () => true); await assert.rejects(coordinator(store).consumeOnce(oldAuthority, async () => true), error => error.code === "authority_consumed"); assert.equal(await coordinator(store).consumeOnce(freshAuthority, async () => "fresh-generated"), "fresh-generated"); assert.notEqual(simulationConsumptionReceiptId(oldAuthority), simulationConsumptionReceiptId(freshAuthority)); });

test("actual checked-in rules exclude crm from broad fallback and explicitly deny the receipt namespace", async () => { const rules = await readFile("firestore.rules", "utf8"); assert.match(rules, /topLevelCollection != "crm"/); assert.match(rules, /match \/crm\/\{document=\*\*\}/); assert.match(rules, /allow read, write: if false/); assert.ok(CLOSER_SIMULATION_CONSUMPTION_PATH.startsWith("crm/")); });
