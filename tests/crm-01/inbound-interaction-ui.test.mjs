import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const panel = new URL("../../app/admin/crm-01/accounts/[accountId]/InboundInteractionPanel.tsx", import.meta.url);

test("Founder inbound UI binds explicit evidence and defaults authenticity to unknown", async () => {
  const source = await readFile(panel, "utf8");
  for (const token of ["inbound_received", "exactStatement", "future_brand_statement", "senderParticipantKey", "recipientParticipantKeys", "Factual channel", "Evidence authenticity", 'useState<"authentic"|"synthetic"|"unknown">("unknown")']) assert.ok(source.includes(token), token);
  assert.doesNotMatch(source, /useState<[^>]*>\("authentic"\)/);
});

test("Founder inbound UI preserves exact preview then approval and commit", async () => {
  const source = await readFile(panel, "utf8");
  for (const token of ["/mutations/preview", "/mutations/commit", "packetSha256", "mutationPlanSha256", "Approve this exact attributed inbound Interaction", "execution is authorized"]) assert.ok(source.includes(token), token);
});
