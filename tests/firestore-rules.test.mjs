import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

const projectId = process.env.GCLOUD_PROJECT || "demo-goshsha";
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const firestoreOrigin = firestoreHost.startsWith("http") ? firestoreHost : `http://${firestoreHost}`;

function authenticatedEmulatorToken() {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({
    aud: projectId,
    auth_time: now,
    exp: now + 3600,
    firebase: { sign_in_provider: "password" },
    iat: now,
    iss: `https://securetoken.google.com/${projectId}`,
    sub: "ordinary-user",
    user_id: "ordinary-user",
  })}.`;
}

function documentUrl(path) {
  return `${firestoreOrigin}/v1/projects/${projectId}/databases/(default)/documents/${path}`;
}

async function request(path, method, authenticated = false) {
  const headers = authenticated ? { Authorization: `Bearer ${authenticatedEmulatorToken()}` } : {};
  if (method === "PATCH") headers["Content-Type"] = "application/json";
  return fetch(documentUrl(path), {
    method,
    headers,
    body: method === "PATCH" ? JSON.stringify({ fields: { test: { booleanValue: true } } }) : undefined,
  });
}

async function expectReadAllowed(path, authenticated = false) {
  const response = await request(path, "GET", authenticated);
  assert.notEqual(response.status, 403, `expected read access for ${path}`);
}

async function expectReadDenied(path, authenticated = false) {
  const response = await request(path, "GET", authenticated);
  assert.equal(response.status, 403, `expected read denial for ${path}`);
}

async function expectWriteAllowed(path, authenticated = false) {
  const response = await request(path, "PATCH", authenticated);
  assert.equal(response.status, 200, `expected write access for ${path}: ${await response.text()}`);
}

async function expectWriteDenied(path, authenticated = false) {
  const response = await request(path, "PATCH", authenticated);
  assert.equal(response.status, 403, `expected write denial for ${path}`);
}

async function cleanup(path, authenticated = false) {
  await request(path, "DELETE", authenticated);
}

test("CRM namespace denies reads and writes for unauthenticated and authenticated clients", async () => {
  const path = `crm/rules-test-${randomUUID()}`;
  await expectReadDenied(path);
  await expectWriteDenied(path);
  await expectReadDenied(path, true);
  await expectWriteDenied(path, true);
});

test("broad fallback retains public reads and authenticated-only writes", async () => {
  const path = `rulesRegression/${randomUUID()}`;
  await expectReadAllowed(path);
  await expectWriteDenied(path);
  await expectWriteAllowed(path, true);
  await expectReadAllowed(path, true);
  await cleanup(path, true);
});

for (const collectionName of ["Metric", "Feed"]) {
  test(`${collectionName} remains publicly readable and writable`, async () => {
    const path = `${collectionName}/${randomUUID()}`;
    await expectWriteAllowed(path);
    await expectReadAllowed(path);
    await cleanup(path);
  });
}

test("masters retains public reads and unauthenticated writes", async () => {
  const path = `masters/${randomUUID()}`;
  await expectWriteAllowed(path);
  await expectReadAllowed(path);
  await cleanup(path);
});

test("campaigns retains public reads and authenticated-only writes", async () => {
  const path = `campaigns/${randomUUID()}`;
  await expectReadAllowed(path);
  await expectWriteDenied(path);
  await expectWriteAllowed(path, true);
  await expectReadAllowed(path, true);
  await cleanup(path, true);
});
