import assert from "node:assert/strict";
import test from "node:test";

import { authorizeGrowthAdmin, GrowthAdminAuthError } from "../../lib/agents/growth-01/admin-auth.ts";

const request = (token) => new Request("https://irl.goshsha.com/api/admin/agents/growth-01/run", {
  method: "POST",
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});

test("missing or invalid bearer tokens are rejected", async () => {
  const dependencies = { verifyIdToken: async () => { throw new Error("invalid"); }, loadUser: async () => ({ exists: true, isAdmin: true }) };
  await assert.rejects(() => authorizeGrowthAdmin(request(), dependencies), (error) => error instanceof GrowthAdminAuthError && error.status === 401);
  await assert.rejects(() => authorizeGrowthAdmin(request("bad"), dependencies), (error) => error instanceof GrowthAdminAuthError && error.status === 401);
});

test("server-side users/{uid}.isAdmin controls access and verified UID is returned", async () => {
  const verifyIdToken = async () => ({ uid: "verified-founder-uid" });
  await assert.rejects(
    () => authorizeGrowthAdmin(request("valid"), { verifyIdToken, loadUser: async () => ({ exists: true, isAdmin: false }) }),
    (error) => error instanceof GrowthAdminAuthError && error.status === 403
  );
  const result = await authorizeGrowthAdmin(request("valid"), {
    verifyIdToken,
    loadUser: async (uid) => ({ exists: uid === "verified-founder-uid", isAdmin: true }),
  });
  assert.deepEqual(result, { uid: "verified-founder-uid" });
});
