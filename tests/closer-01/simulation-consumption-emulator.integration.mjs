import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  CLOSER_SIMULATION_CONSUMPTION_PATH,
  FirestoreAtomicSimulationConsumptionCoordinator,
  simulationConsumptionReceiptId,
} from "../../lib/agents/closer-01/simulation-consumption.ts";

const projectId = process.env.GCLOUD_PROJECT;
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
if (!projectId?.startsWith("demo-") || !emulatorHost || /googleapis\.com|firebaseio\.com/i.test(emulatorHost)) throw new Error("SAFE_SETUP_REQUIRED: use an explicit demo-* project and FIRESTORE_EMULATOR_HOST; production connectivity is forbidden.");

const app = initializeApp({ projectId }, `closer-consumption-${randomUUID()}`), db = getFirestore(app), at = "2026-09-28T12:05:00.000Z";
const binding = { authorityId: `authority-${randomUUID()}`, authoritySha256: "a".repeat(64), founderUid: "founder", accountId: "account", pursuitId: "pursuit", expiresAt: "2026-09-28T12:15:00.000Z" };
try {
  const first = new FirestoreAtomicSimulationConsumptionCoordinator(db, () => at), second = new FirestoreAtomicSimulationConsumptionCoordinator(db, () => at); let generated = 0;
  const operation = async () => { generated += 1; await new Promise(resolve => setTimeout(resolve, 20)); return "generated"; };
  const race = await Promise.allSettled([first.consumeOnce(binding, operation), second.consumeOnce(binding, operation)]);
  assert.equal(race.filter(x => x.status === "fulfilled").length, 1); assert.equal(race.filter(x => x.status === "rejected" && x.reason.code === "authority_consumed").length, 1); assert.equal(generated, 1);
  await assert.rejects(first.consumeOnce(binding, operation), error => error.code === "authority_consumed");
  const failedBinding = { ...binding, authorityId: `authority-${randomUUID()}`, authoritySha256: "b".repeat(64) };
  await assert.rejects(first.consumeOnce(failedBinding, async () => { throw new Error("fixture generation failed"); }), /fixture generation failed/);
  await assert.rejects(second.consumeOnce(failedBinding, async () => "must not run"), error => error.code === "authority_consumed");

  const expiringBinding = {
    ...binding,
    authorityId: `authority-${randomUUID()}`,
    authoritySha256: "c".repeat(64),
    expiresAt: "2026-09-28T12:06:00.000Z",
  };
  await first.consumeOnce(expiringBinding, async () => "generated before expiry");
  await db.doc(`${CLOSER_SIMULATION_CONSUMPTION_PATH}/${simulationConsumptionReceiptId(expiringBinding)}`).delete();
  const afterExpiry = new FirestoreAtomicSimulationConsumptionCoordinator(db, () => "2026-09-28T12:07:00.000Z");
  let generatedAfterCleanup = 0;
  await assert.rejects(
    afterExpiry.consumeOnce(expiringBinding, async () => { generatedAfterCleanup += 1; return "must not run"; }),
    error => error.code === "authority_expired",
  );
  assert.equal(generatedAfterCleanup, 0);
  process.stdout.write("FIRESTORE_EMULATOR_ATOMIC_CONSUMPTION_PASS\n");
} finally { await deleteApp(app); }
