import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const path = "app/admin/revenue-01/page.tsx";
test("UI separates PREPARED authority from the explicit preparation request", async () => { const s = await readFile(path, "utf8"); for (const text of ["PREPARED is a prerequisite, not approval of any resulting draft", "Explicitly Request One Unsent Draft", "explicitSimulationRequest:true", "/api/admin/agents/closer-01/simulate"]) assert.ok(s.includes(text)); });
test("UI labels output as an unsent nonpersistent draft while disclosing the durable receipt", async () => { const s = await readFile(path, "utf8"); for (const text of ["Unsent Draft for Founder Review — Not Approved for Sending", "Proposed next action", "Unsent draft message", "Observation preview", "CRM record created: No · Draft persisted: No · Consumption receipt durable: Yes · Sent: No · External action: No"]) assert.ok(s.includes(text)); });
test("UI discloses default-disabled production preparation and separate consumption", async () => { const s = await readFile(path, "utf8"); assert.ok(s.includes("The production preparation gate remains disabled by default. A separate request consumes this authority before any provider call.")); });
