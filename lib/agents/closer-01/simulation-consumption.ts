import type { Firestore } from "firebase-admin/firestore";
import { revenueSha256, revenueStableId } from "../revenue-01/canonical";

export const CLOSER_SIMULATION_CONSUMPTION_RECEIPT_SCHEMA = "closer-01-simulation-consumption-receipt-v1" as const;
export const CLOSER_SIMULATION_CONSUMPTION_PATH = "crm/closerSimulationConsumption/receipts" as const;

export class CloserSimulationConsumptionError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.name = "CloserSimulationConsumptionError"; this.code = code; }
}

export type CloserSimulationConsumptionBinding = { authorityId: string; authoritySha256: string; founderUid: string; accountId: string; pursuitId: string; expiresAt: string };
export type CloserSimulationConsumptionReceiptV1 = { schemaVersion: typeof CLOSER_SIMULATION_CONSUMPTION_RECEIPT_SCHEMA; receiptId: string; authorityId: string; authoritySha256: string; founderUid: string; accountId: string; pursuitId: string; consumedAt: string; authorityExpiresAt: string; state: "consumed_before_generation" };
export interface CloserSimulationConsumptionCoordinator { consumeOnce<T>(binding: CloserSimulationConsumptionBinding, operation: () => Promise<T>): Promise<T> }

function validateBinding(binding: CloserSimulationConsumptionBinding, now: string): void {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(binding.authorityId) || !/^[a-f0-9]{64}$/.test(binding.authoritySha256) || !/^[A-Za-z0-9_-]{1,128}$/.test(binding.founderUid) || !/^[A-Za-z0-9_-]{1,128}$/.test(binding.accountId) || !/^[A-Za-z0-9_-]{1,128}$/.test(binding.pursuitId)) throw new CloserSimulationConsumptionError("consumption_binding_invalid", "Simulation consumption binding is malformed.");
  const expires = Date.parse(binding.expiresAt), current = Date.parse(now);
  if (!Number.isFinite(expires) || !Number.isFinite(current) || current > expires) throw new CloserSimulationConsumptionError("authority_expired", "Expired simulation authority cannot be consumed.");
}

export function simulationConsumptionReceiptId(binding: CloserSimulationConsumptionBinding): string { return revenueStableId("closersimconsume", { authorityId: binding.authorityId, authoritySha256: binding.authoritySha256 }); }
function receipt(binding: CloserSimulationConsumptionBinding, consumedAt: string): CloserSimulationConsumptionReceiptV1 { validateBinding(binding, consumedAt); return { schemaVersion: CLOSER_SIMULATION_CONSUMPTION_RECEIPT_SCHEMA, receiptId: simulationConsumptionReceiptId(binding), authorityId: binding.authorityId, authoritySha256: binding.authoritySha256, founderUid: binding.founderUid, accountId: binding.accountId, pursuitId: binding.pursuitId, consumedAt, authorityExpiresAt: binding.expiresAt, state: "consumed_before_generation" }; }

export class FirestoreAtomicSimulationConsumptionCoordinator implements CloserSimulationConsumptionCoordinator {
  private readonly db: Firestore;
  private readonly now: () => string;
  constructor(db: Firestore, now: () => string = () => new Date().toISOString()) { this.db = db; this.now = now; }
  async consumeOnce<T>(binding: CloserSimulationConsumptionBinding, operation: () => Promise<T>): Promise<T> {
    const consumedAt = this.now(), value = receipt(binding, consumedAt), ref = this.db.doc(`${CLOSER_SIMULATION_CONSUMPTION_PATH}/${value.receiptId}`);
    try { await this.db.runTransaction(async transaction => { const existing = await transaction.get(ref); if (existing.exists) throw new CloserSimulationConsumptionError("authority_consumed", "This Founder Simulation Authority has already been consumed."); transaction.create(ref, value); }); }
    catch (error) { if (error instanceof CloserSimulationConsumptionError) throw error; throw new CloserSimulationConsumptionError("consumption_outcome_uncertain", "The durable one-use transaction did not return a certain committed outcome. Simulation remains blocked."); }
    return operation();
  }
}

export type SharedInMemorySimulationReceiptStore = { receipts: Map<string, CloserSimulationConsumptionReceiptV1>; locked: Set<string>; failMode?: "unavailable" | "uncertain" };
export function createSharedInMemorySimulationReceiptStore(): SharedInMemorySimulationReceiptStore { return { receipts: new Map(), locked: new Set() }; }
export class InMemoryAtomicSimulationConsumptionCoordinator implements CloserSimulationConsumptionCoordinator {
  private readonly store: SharedInMemorySimulationReceiptStore;
  private readonly now: () => string;
  constructor(store = createSharedInMemorySimulationReceiptStore(), now: () => string = () => new Date().toISOString()) { this.store = store; this.now = now; }
  async consumeOnce<T>(binding: CloserSimulationConsumptionBinding, operation: () => Promise<T>): Promise<T> {
    const consumedAt = this.now(), value = receipt(binding, consumedAt), key = value.receiptId;
    if (this.store.failMode === "unavailable") throw new CloserSimulationConsumptionError("consumption_store_unavailable", "The durable consumption store is unavailable.");
    if (this.store.failMode === "uncertain") throw new CloserSimulationConsumptionError("consumption_outcome_uncertain", "The durable transaction outcome is uncertain. Simulation remains blocked.");
    if (this.store.receipts.has(key) || this.store.locked.has(key)) throw new CloserSimulationConsumptionError("authority_consumed", "This Founder Simulation Authority has already been consumed.");
    this.store.locked.add(key); try { this.store.receipts.set(key, value); } finally { this.store.locked.delete(key); }
    return operation();
  }
  isConsumed(binding: CloserSimulationConsumptionBinding): boolean { return this.store.receipts.has(simulationConsumptionReceiptId(binding)); }
  getReceipt(binding: CloserSimulationConsumptionBinding): CloserSimulationConsumptionReceiptV1 | undefined { return this.store.receipts.get(simulationConsumptionReceiptId(binding)); }
  deleteExpiredReceiptForTest(binding: CloserSimulationConsumptionBinding, at: string): void { if (Date.parse(at) <= Date.parse(binding.expiresAt)) throw new CloserSimulationConsumptionError("receipt_not_expired", "A consumption receipt cannot be cleaned up before authority expiry."); this.store.receipts.delete(simulationConsumptionReceiptId(binding)); }
}

export function assertConsumptionBindingMatchesAuthority(binding: CloserSimulationConsumptionBinding, expected: CloserSimulationConsumptionBinding): void { if (revenueSha256(binding) !== revenueSha256(expected)) throw new CloserSimulationConsumptionError("consumption_scope_mismatch", "Simulation consumption does not match the server-verified Founder/workspace authority scope."); }
