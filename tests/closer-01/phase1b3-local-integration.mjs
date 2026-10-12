import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import test from "node:test";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { buildFounderSimulationAuthority, buildFounderSimulationAuthorityPreview, verifyFounderSimulationAuthorityPreview } from "../../lib/agents/closer-01/simulation-authority.ts";
import { issueFounderSimulationAuthorityProof, verifyFounderSimulationAuthorityProof } from "../../lib/agents/closer-01/simulation-authority-proof.ts";
import { FirestoreAtomicSimulationConsumptionCoordinator } from "../../lib/agents/closer-01/simulation-consumption.ts";
import { DeterministicFixtureSimulationGenerator } from "../../lib/agents/closer-01/simulation-generator.ts";
import { executeFounderReviewedSimulation } from "../../lib/agents/closer-01/simulation.ts";
import { COMMERCIAL_OFFER_CATALOG_SHA256 } from "../../lib/agents/crm-01/commercial-offers.ts";

const projectId = process.env.GCLOUD_PROJECT;
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const signingSecret = process.env.CLOSER_LOCAL_TEST_SIGNING_SECRET;
if (!projectId?.startsWith("demo-") || !emulatorHost || !/^(?:127\.0\.0\.1|localhost):\d+$/.test(emulatorHost) || !signingSecret || Buffer.byteLength(signingSecret) < 32) throw new Error("SAFE_SETUP_REQUIRED: explicit demo-* project, loopback Firestore emulator, and ephemeral 32-byte signing secret are required.");

const RESPONSE = "That's a fair question. We're still early, so I wouldn't position Goshsha as an audience-buy like a major social platform. The value is different: your products already have shoppers encountering them in the real world, and Goshsha gives you a new channel to engage those shoppers with content you've already created when they scan the product. So you're not buying access to our audience—you're making your own physical products interactive. And because the interaction happens through Goshsha, we can measure the supported engagement signals around that experience.";
const QUALIFICATION = "Today the shopper does need the Goshsha app and needs to scan the product, so I wouldn't claim every shopper at the shelf becomes a Goshsha user. That's why the initial activation should be positioned as a practical way to prove the behavior rather than as guaranteed audience delivery.";
const SHA = "a".repeat(64);

function reconstruct(statement, revision = "revision-1") {
  const packetSha256 = Buffer.from(revision).toString("hex").padEnd(64, "0").slice(0, 64);
  const packet = { completeness: "valid", readiness: "ready_to_simulate", packetId: `packet-${revision}`, packetSha256, binding: { accountId: "acct", pursuitId: "pursuit", conversationThreadId: "conversation", crmRevisionSetSha256: revision }, sourceContracts: { growth: { version: "V1", sha256: SHA }, sales: { version: "V1.3", sha256: SHA }, crm: { version: "V1.1", sha256: SHA }, revenue: { version: "V1.1", sha256: SHA }, closer: { version: "V1", sha256: SHA } }, sales: { artifactSha256: "playbook-sha", playbookId: "playbook", positioning: "Goshsha makes physical products interactive through app-based product scanning.", positioningArtifact: { version: "v1", sha256: "positioning-sha" }, approvedClaims: [{ id: "claim", statement: "A shopper can scan a recognizable physical product in the Goshsha app.", classification: "goshsha_capability" }], mechanicsQualifications: ["The shopper uses the Goshsha iOS app and scans a recognizable physical product."], audienceObjection: { objection: "How many users does Goshsha have?", response: RESPONSE, deeperQualification: QUALIFICATION }, prohibitedClaims: ["guaranteed_1000_views"], objections: [], escalationBoundaries: ["Return unsupported objections to SALES."], bestFirstContactId: "contact" }, crm: { participants: [{ contactId: "contact", title: "CMO" }], interactions: [{ interactionId: `interaction-${revision}`, orderKey: `2026|${revision}`, type: "inbound_received", occurredAt: "2026-09-28T12:00:00.000Z", exactAttributedStatement: statement }] }, revenue: { approvedPackageId: "package", approvedPackageSha256: "package-sha", objectiveId: "objective", objectiveFamily: "complete_proof_milestone" } };
  const snapshot = { snapshotIdentity: { accountId: "acct", pursuitId: "pursuit" }, revisionBinding: { revisionSetSha256: revision }, pursuit: { selectedEntryOfferId: "free-first-irl-campaign", canonicalConversation: { conversationId: "conversation", revision: 2, participants: [{ type: "crm_contact", id: "contact" }] } }, stakeholders: [{ contactId: "contact", buyingAuthority: "unknown", buyingAuthorityEvidenceIds: [] }], relationshipSafety: { accountDnc: { evaluation: "allowed" }, contactDnc: [{ contactId: "contact", evaluation: "allowed" }], effectiveExecutionState: "eligible_for_separate_authorization" }, offerCatalog: { version: "goshsha-commercial-offers-v1", sha256: COMMERCIAL_OFFER_CATALOG_SHA256, offers: [{ id: "free-first-irl-campaign", priceUsd: 0, revenueEligible: false }] } };
  const detail = { account: { dnc: { evaluation: "allowed" } }, contacts: [{ id: "contact", accountId: "acct", freshness: "current", conflictingEvidenceIds: [], warnings: [], dnc: { scope: "contact", evaluation: "allowed" } }] };
  const playbook = { artifactId: "playbook", artifactSha256: "playbook-sha", superseded: false, bestFirstContactId: "contact", positioningArtifact: { version: "v1", sha256: "positioning-sha" } };
  const approvedPackage = { packageId: "package", packageSha256: "package-sha", binding: { accountId: "acct", pursuitId: "pursuit", crmRevisionSetSha256: revision }, identities: { freshRecommendationId: "objective", recommendationSchemaVersion: "revenue-01-recommendation-v1" }, selectedRecommendation: { family: "complete_proof_milestone", objective: "Complete proof" } };
  return { packet, snapshot, detail, playbook, approvedPackage };
}

const app = initializeApp({ projectId }, `closer-local-review-${randomUUID()}`), db = getFirestore(app);
let clock = "2026-09-28T12:00:00.000Z", current = reconstruct("How many users does Goshsha have?");
const coordinator = new FirestoreAtomicSimulationConsumptionCoordinator(db, () => clock), generator = new DeterministicFixtureSimulationGenerator();
const authorityInput = selection => ({ ...current, recipientContactId: selection.recipientContactId, simulationChannelContext: selection.channel, simulationAction: selection.action, approvedByUid: "founder", approvedAt: clock });
async function body(request) { const chunks = []; for await (const chunk of request) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
function reply(response, status, value) { response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); response.end(JSON.stringify(value)); }

const server = createServer(async (request, response) => {
  try {
    const input = await body(request);
    if (request.url === "/api/admin/agents/closer-01/simulation-authority") {
      const proposed = buildFounderSimulationAuthority(authorityInput(input.selection)), preview = buildFounderSimulationAuthorityPreview(proposed);
      if (input.mode === "preview") return reply(response, 200, { authorityPreview: preview, exactFounderApprovalRequired: true });
      verifyFounderSimulationAuthorityPreview({ preview, reconstructedAuthority: proposed, expectedPreviewId: input.previewId, expectedPreviewSha256: input.previewSha256, explicitFounderApproval: input.explicitFounderApproval, now: clock });
      const authority = buildFounderSimulationAuthority(authorityInput(input.selection));
      const authorityProof = issueFounderSimulationAuthorityProof({ authority, issuedAt: clock, signingSecret });
      return reply(response, 200, { authority, authorityProof });
    }
    if (request.url === "/api/admin/agents/closer-01/simulate") {
      verifyFounderSimulationAuthorityProof({ authority: input.authority, proof: input.authorityProof, authenticatedUid: "founder", now: clock, signingSecret });
      const result = await executeFounderReviewedSimulation({ authority: input.authority, currentPacket: current.packet, now: clock, explicitSimulationRequest: input.explicitSimulationRequest, coordinator, generator });
      return reply(response, 200, { result });
    }
    return reply(response, 404, { error: "not_found" });
  } catch (error) { return reply(response, 409, { code: error.code ?? "local_review_failed", error: error.message }); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const post = async (path, value) => { const response = await fetch(`http://127.0.0.1:${port}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) }); return { status: response.status, value: await response.json() }; };
const selection = { recipientContactId: "contact", channel: "email", action: "simulate_response_to_latest_inbound" };
async function approve() { const preview = await post("/api/admin/agents/closer-01/simulation-authority", { mode: "preview", selection }); assert.equal(preview.status, 200); const approved = await post("/api/admin/agents/closer-01/simulation-authority", { mode: "approve", selection, previewId: preview.value.authorityPreview.previewId, previewSha256: preview.value.authorityPreview.previewSha256, explicitFounderApproval: true }); assert.equal(approved.status, 200); return { preview: preview.value.authorityPreview, ...approved.value }; }
const simulate = approval => post("/api/admin/agents/closer-01/simulate", { authority: approval.authority, authorityProof: approval.authorityProof, explicitSimulationRequest: true });

test("existing Founder UI and local HTTP routes expose the exact three-step workflow", async () => { const ui = await readFile("app/admin/revenue-01/page.tsx", "utf8"); for (const marker of ["previewSimulationAuthority", "approveSimulationAuthority", "requestOneSimulation", "/api/admin/agents/closer-01/simulation-authority", "/api/admin/agents/closer-01/simulate", "Explicitly Request One Unsent Draft"]) assert.ok(ui.includes(marker)); });
test("covered audience objection completes exact preview approval durable consumption replay rejection and fresh approval", async () => { const approval = await approve(); assert.equal(approval.preview.proposedAuthority.selection.recipientContactId, "contact"); assert.equal(approval.preview.proposedAuthority.selection.simulationChannelContext, "email"); assert.equal(approval.preview.proposedAuthority.selection.simulationAction, "simulate_response_to_latest_inbound"); const response = await simulate(approval); assert.equal(response.status, 200); assert.equal(response.value.result.status, "SIMULATED_FOR_FOUNDER_REVIEW"); assert.equal(response.value.result.pair.message, `${RESPONSE} ${QUALIFICATION}`); assert.equal(response.value.result.observationPreview.interpretation.playbookCoverage, "covered"); assert.ok(Object.values(response.value.result.safety).every(value => value === false)); const replay = await simulate(approval); assert.equal(replay.status, 409); assert.equal(replay.value.code, "authority_consumed"); clock = "2026-09-28T12:00:30.000Z"; const fresh = await approve(); assert.notEqual(fresh.authority.authorityId, approval.authority.authorityId); const freshResponse = await simulate(fresh); assert.equal(freshResponse.status, 200); });
test("changed authoritative context rejects before generation", async () => { clock = "2026-09-28T12:01:00.000Z"; const approval = await approve(); current = reconstruct("A newly received statement changes the conversation.", "revision-2"); const response = await simulate(approval); assert.equal(response.status, 409); assert.match(response.value.error, /packet changed/i); });
test("unsupported custom implementation ROI guarantee and discount produces review-required without message", async () => { current = reconstruct("Give us a custom implementation, guaranteed ROI, and a discount.", "revision-4"); clock = "2026-09-28T12:03:00.000Z"; const approval = await approve(); const response = await simulate(approval); assert.equal(response.status, 200); assert.equal(response.value.result.status, "REVIEW_REQUIRED_NO_SIMULATION"); assert.equal(response.value.result.pair, null); assert.deepEqual(response.value.result.observationPreview.requiredReview, { sales: true, revenue: true, founder: true, reasons: ["Unsupported objection requires CRM evidence preservation, SALES review, REVENUE reevaluation when commercially material, and exact Founder continuation approval."] }); });
test.after(async () => { await new Promise(resolve => server.close(resolve)); await deleteApp(app); });
