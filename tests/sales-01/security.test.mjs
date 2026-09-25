import assert from "node:assert/strict";
import test from "node:test";

import { authorizeSalesAdmin, SalesAdminAuthError } from "../../lib/agents/sales-01/admin-auth.ts";

const request = (token) => new Request("https://irl.goshsha.com/api/admin/agents/sales-01/intake", {
  method: "POST",
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});

test("SALES intake rejects missing and invalid bearer tokens", async () => {
  const dependencies = { verifyIdToken: async () => { throw new Error("invalid"); }, loadUser: async () => ({ exists: true, isAdmin: true }) };
  await assert.rejects(() => authorizeSalesAdmin(request(), dependencies), (error) => error instanceof SalesAdminAuthError && error.status === 401);
  await assert.rejects(() => authorizeSalesAdmin(request("bad"), dependencies), (error) => error instanceof SalesAdminAuthError && error.status === 401);
});

test("server-side users/{uid}.isAdmin controls SALES access", async () => {
  const verifyIdToken = async () => ({ uid: "verified-founder" });
  await assert.rejects(
    () => authorizeSalesAdmin(request("valid"), { verifyIdToken, loadUser: async () => ({ exists: true, isAdmin: false }) }),
    (error) => error instanceof SalesAdminAuthError && error.status === 403
  );
  assert.deepEqual(await authorizeSalesAdmin(request("valid"), {
    verifyIdToken,
    loadUser: async (uid) => ({ exists: uid === "verified-founder", isAdmin: true }),
  }), { uid: "verified-founder" });
});
