import assert from "node:assert/strict";
import test from "node:test";
import { issueFounderSimulationAuthorityProof, verifyFounderSimulationAuthorityProof } from "../../lib/agents/closer-01/simulation-authority-proof.ts";

const SECRET = "test-only-founder-authority-signing-secret-0123456789";
const NOW = "2026-09-28T12:05:00.000Z";
const authority = { authorityId: "authority-one", authoritySha256: "a".repeat(64), approvedByUid: "founder", approvedAt: "2026-09-28T12:00:00.000Z", expiresAt: "2026-09-28T12:15:00.000Z", binding: { accountId: "account", pursuitId: "pursuit" } };

test("server-issued HMAC proof authenticates exact authority Founder workspace and expiry", () => { const proof = issueFounderSimulationAuthorityProof({ authority, issuedAt: NOW, signingSecret: SECRET, issuanceNonce: "server-nonce-one" }); assert.doesNotThrow(() => verifyFounderSimulationAuthorityProof({ authority, proof, authenticatedUid: "founder", now: NOW, signingSecret: SECRET })); });

test("client cannot fabricate modified PREPARED authority by recomputing its plain SHA", () => {
  const proof = issueFounderSimulationAuthorityProof({ authority, issuedAt: NOW, signingSecret: SECRET, issuanceNonce: "server-nonce-one" });
  for (const forged of [{ ...authority, authoritySha256: "b".repeat(64) }, { ...authority, approvedByUid: "attacker" }, { ...authority, expiresAt: "2099-01-01T00:00:00.000Z" }, { ...authority, binding: { ...authority.binding, accountId: "other" } }]) assert.throws(() => verifyFounderSimulationAuthorityProof({ authority: forged, proof, authenticatedUid: "founder", now: NOW, signingSecret: SECRET }), error => error.code === "authority_issuance_invalid");
  const forgedProof = { ...proof, founderUid: "attacker", signature: "c".repeat(64) }; assert.throws(() => verifyFounderSimulationAuthorityProof({ authority, proof: forgedProof, authenticatedUid: "founder", now: NOW, signingSecret: SECRET }), error => error.code === "authority_issuance_invalid");
});

test("wrong secret and missing or short server secret fail closed", () => { const proof = issueFounderSimulationAuthorityProof({ authority, issuedAt: NOW, signingSecret: SECRET, issuanceNonce: "server-nonce-one" }); assert.throws(() => verifyFounderSimulationAuthorityProof({ authority, proof, authenticatedUid: "founder", now: NOW, signingSecret: "different-test-secret-that-is-at-least-thirty-two-bytes" }), error => error.code === "authority_issuance_invalid"); assert.throws(() => issueFounderSimulationAuthorityProof({ authority, issuedAt: NOW, signingSecret: "short" }), error => error.code === "authority_signing_unavailable"); });

test("fresh explicit approval issuance gets a distinct server-controlled proof", () => { const first = issueFounderSimulationAuthorityProof({ authority, issuedAt: NOW, signingSecret: SECRET, issuanceNonce: "server-nonce-one" }), second = issueFounderSimulationAuthorityProof({ authority: { ...authority, authorityId: "authority-two", authoritySha256: "d".repeat(64), approvedAt: "2026-09-28T12:06:00.000Z", expiresAt: "2026-09-28T12:21:00.000Z" }, issuedAt: "2026-09-28T12:06:00.000Z", signingSecret: SECRET, issuanceNonce: "server-nonce-two" }); assert.notEqual(first.proofId, second.proofId); assert.notEqual(first.issuanceNonce, second.issuanceNonce); });
