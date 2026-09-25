import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  APPROVED_SALES_CONTRACT_SHA256,
  loadSalesContractMetadata,
  SalesContractIntegrityError,
  verifySalesContractContents,
} from "../../lib/agents/sales-01/contract.ts";

test("SALES V1.1 contract is pinned and contains the approved claims discipline", async () => {
  const metadata = await loadSalesContractMetadata(new Date("2026-09-24T12:00:00.000Z"));
  const contract = await readFile("agents/sales-01/AGENT.md", "utf8");
  assert.equal(metadata.version, "V1.1");
  assert.equal(metadata.sha256, APPROVED_SALES_CONTRACT_SHA256);
  assert.match(contract, /must not independently originate, verify, endorse, or adopt as Goshsha claims any medical, therapeutic/);
  assert.match(contract, /Creator testimonials, reviews, popularity, retail presence, Creator activity, sponsorship, or Brand use do not establish product efficacy, safety, or regulatory compliance/);
  assert.match(contract, /Free First IRL Campaign:\*\* \$0; one product; one Brand-owned or properly licensed uploaded video; 30 days; and the first 250 qualified views/);
  assert.match(contract, /IRL Retail Media:\*\* \$99 per activation; one video; one product; 90 days; and the first 1,000 qualified views/);
  assert.match(contract, /14-day free trial with card, then \$75\/month/);
});

test("empty or one-byte-mutated SALES contracts fail closed", async () => {
  const contents = await readFile("agents/sales-01/AGENT.md");
  assert.throws(() => verifySalesContractContents(new Uint8Array()), SalesContractIntegrityError);
  const changed = Buffer.from(contents);
  changed[0] = changed[0] === 35 ? 36 : 35;
  assert.throws(() => verifySalesContractContents(changed), SalesContractIntegrityError);
});
