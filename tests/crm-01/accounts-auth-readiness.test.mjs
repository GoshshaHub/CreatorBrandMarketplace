import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const accountsPage = new URL("../../app/admin/crm-01/accounts/page.tsx", import.meta.url);

test("Accounts waits for delayed Firebase session restoration before reading currentUser", async () => {
  const source = await readFile(accountsPage, "utf8");
  const readiness = source.indexOf("await auth.authStateReady();");
  const currentUser = source.indexOf("const user = auth.currentUser;");
  const token = source.indexOf("await user.getIdToken()");

  assert.notEqual(readiness, -1);
  assert.ok(readiness < currentUser, "authentication readiness must resolve before currentUser is read");
  assert.ok(currentUser < token, "the resolved authenticated user must supply the bearer token");
});

test("Accounts fails closed after authentication resolves without a user", async () => {
  const source = await readFile(accountsPage, "utf8");
  const readiness = source.indexOf("await auth.authStateReady();");
  const unauthenticated = source.indexOf('if (!user) throw new Error("Admin session unavailable.");');
  const request = source.indexOf('fetch(`/api/admin/agents/crm-01/accounts?${query}`');

  assert.ok(readiness < unauthenticated, "unauthenticated state must be evaluated only after readiness resolves");
  assert.ok(unauthenticated < request, "an unauthenticated state must fail before the Admin API request");
  assert.match(source, /Authorization: `Bearer \$\{await user\.getIdToken\(\)\}`/);
  assert.doesNotMatch(source, /retry|setTimeout|firebase\/firestore|localStorage|sessionStorage/i);
});
