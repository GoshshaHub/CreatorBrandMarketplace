import test from "node:test";
import assert from "node:assert/strict";
import { assertCloserLocalDemoEnvironment } from "../../lib/agents/closer-01/local-demo-guard.ts";

function withDemoEnv(overrides, run) {
  const keys = [
    "NODE_ENV",
    "CLOSER_LOCAL_DEMO_ENABLED",
    "CLOSER_LOCAL_DEMO_GENERATOR",
    "CLOSER_SIMULATION_AUTHORITY_SIGNING_SECRET",
    "FIREBASE_PROJECT_ID",
    "GCLOUD_PROJECT",
    "FIREBASE_AUTH_EMULATOR_HOST",
    "FIRESTORE_EMULATOR_HOST",
    "CLOSER_LOCAL_DEMO_LOCAL_BUILD",
    "VERCEL",
    "VERCEL_ENV",
    "VERCEL_URL",
    "AWS_LAMBDA_FUNCTION_NAME",
    "K_SERVICE",
  ];
  const before = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    NODE_ENV: "test",
    CLOSER_LOCAL_DEMO_ENABLED: "true",
    CLOSER_LOCAL_DEMO_GENERATOR: "deterministic_fixture",
    CLOSER_SIMULATION_AUTHORITY_SIGNING_SECRET: "ephemeral-test-signing-secret-123456789",
    FIREBASE_PROJECT_ID: "demo-closer-application",
    GCLOUD_PROJECT: "demo-closer-application",
    FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9199",
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8188",
  }, overrides);
  try { run(); }
  finally {
    for (const key of keys) before[key] === undefined ? delete process.env[key] : process.env[key] = before[key];
  }
}

test("local demo accepts only explicit demo project and loopback emulators", async () => {
  withDemoEnv({}, () => {
    assert.deepEqual(assertCloserLocalDemoEnvironment(), {
      projectId: "demo-closer-application",
      authHost: "127.0.0.1:9199",
      firestoreHost: "127.0.0.1:8188",
      signingSecret: "ephemeral-test-signing-secret-123456789",
      generator: "deterministic_fixture",
    });
  });
  withDemoEnv({CLOSER_LOCAL_DEMO_GENERATOR:"mocked_responses"},()=>assert.equal(assertCloserLocalDemoEnvironment().generator,"mocked_responses"));
});

test("local demo fails before Firebase access for unsafe environments", async () => {
  withDemoEnv({ NODE_ENV: "production" }, () => assert.throws(assertCloserLocalDemoEnvironment, /local_demo_production_forbidden/));
  withDemoEnv({ NODE_ENV: "production", CLOSER_LOCAL_DEMO_LOCAL_BUILD: "true", VERCEL: "1", VERCEL_ENV: "production", VERCEL_URL: "deployment.example.vercel.app" }, () => assert.throws(assertCloserLocalDemoEnvironment, /local_demo_deployment_forbidden/));
  withDemoEnv({ CLOSER_LOCAL_DEMO_ENABLED: "false" }, () => assert.throws(assertCloserLocalDemoEnvironment, /local_demo_disabled/));
  withDemoEnv({ FIREBASE_PROJECT_ID: "goshsha-production", GCLOUD_PROJECT: "goshsha-production" }, () => assert.throws(assertCloserLocalDemoEnvironment, /local_demo_configuration_unsafe/));
  withDemoEnv({ FIREBASE_AUTH_EMULATOR_HOST: "firebase.example.com:9199" }, () => assert.throws(assertCloserLocalDemoEnvironment, /local_demo_configuration_unsafe/));
  withDemoEnv({ FIRESTORE_EMULATOR_HOST: "10.0.0.1:8188" }, () => assert.throws(assertCloserLocalDemoEnvironment, /local_demo_configuration_unsafe/));
});

test("application seam keeps production simulation disabled", async () => {
  const route = await import("node:fs/promises").then((fs) => fs.readFile("app/api/admin/agents/closer-01/local-demo/route.ts", "utf8"));
  const page = await import("node:fs/promises").then((fs) => fs.readFile("app/admin/revenue-01/closer-local-demo/page.tsx", "utf8"));
  assert.match(route, /authorizeCrmAdmin/);
  assert.match(route, /FirestoreAtomicSimulationConsumptionCoordinator/);
  assert.match(route, /DeterministicFixtureSimulationGenerator/);
  assert.match(route, /env\.generator==="mocked_responses"\?mockedProvider/);
  assert.match(route, /apiKey:"local-demo-placeholder"/);
  assert.doesNotMatch(route, /OPENAI_API_KEY/);
  assert.match(page, /Simulation output persisted: No/);
  assert.match(page, /Consumption receipt durable: Yes/);
  assert.match(page, /NEXT_PUBLIC_CLOSER_LOCAL_DEMO_ENABLED/);
  assert.match(page, /Local CLOSER simulation demo is unavailable/);
  assert.match(page, /Preview Observation Recording/);
  assert.match(page, /Exact attributed evidence/);
  assert.match(page, /Authentic Interaction created: No/);
});

test("shared Firebase initialization requires an actual loopback browser before emulator wiring", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile("lib/firebase.ts", "utf8"));
  assert.match(source, /typeof window!=="undefined"/);
  assert.match(source, /window\.location\.hostname/);
  assert.match(source, /localPage/);
  assert.ok(source.indexOf("if(!localPage") < source.indexOf("connectAuthEmulator(auth"));
});
