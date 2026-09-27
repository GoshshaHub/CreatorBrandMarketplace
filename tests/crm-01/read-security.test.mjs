import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeFiles = ["dashboard", "accounts", "attention", "pursuits"].map((name) => `app/api/admin/agents/crm-01/${name}/route.ts`).concat("app/api/admin/agents/crm-01/accounts/[accountId]/route.ts");
const uiFiles = ["app/admin/crm-01/page.tsx", "app/admin/crm-01/accounts/page.tsx", "app/admin/crm-01/accounts/[accountId]/page.tsx", "app/admin/crm-01/import/page.tsx"];

test("all Founder Control Room routes require server Admin auth and no-store", async () => {
  for (const file of routeFiles) {
    const source = await readFile(file, "utf8");
    assert.match(source, /authorizeCrmRead\(request\)/, file);
    assert.match(source, /crmReadResponse|crmReadErrorResponse/, file);
  }
  const shared = await readFile("lib/agents/crm-01/read-route.ts", "utf8");
  assert.match(shared, /authorizeCrmAdmin/);
  assert.match(shared, /isAdmin/);
  assert.match(shared, /no-store/);
  assert.match(shared, /loadCrmContractMetadata/);
});

test("read-only UI uses Admin APIs and has no direct Firestore, browser persistence or export", async () => {
  const source = (await Promise.all(uiFiles.map((file) => readFile(file, "utf8")))).join("\n");
  assert.doesNotMatch(source, /firebase\/firestore|collection\(|getFirestore|localStorage|sessionStorage|\.csv|download=/i);
  assert.match(source, /\/api\/admin\/agents\/crm-01/);
  assert.doesNotMatch(source, /openai|revenue-01|closer-01|sendgrid|mailgun|scheduler/i);
});

test("Phase 1B.1 API surface is GET-only and contains no canonical mutation", async () => {
  const source = (await Promise.all(routeFiles.map((file) => readFile(file, "utf8")))).join("\n");
  assert.match(source, /export async function GET/);
  assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)|runTransaction|\.set\(|\.update\(|\.delete\(/);
  const repository = await readFile("lib/agents/crm-01/read-repository.ts", "utf8");
  assert.doesNotMatch(repository, /runTransaction|\.set\(|\.update\(|\.delete\(/);
  assert.match(repository, /CRM_READ_MAX_LIMIT/);
  assert.match(repository, /\.limit\(/);
});
