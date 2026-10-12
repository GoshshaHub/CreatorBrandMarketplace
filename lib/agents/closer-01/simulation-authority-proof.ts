import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { revenueCanonicalJson, revenueStableId } from "../revenue-01/canonical";
import type { CloserSimulationAuthorityV1 } from "./simulation-authority";
import { CloserSimulationAuthorityError } from "./simulation-authority";

export const CLOSER_SIMULATION_AUTHORITY_PROOF_SCHEMA = "closer-01-founder-simulation-authority-proof-v1" as const;
export type CloserSimulationAuthorityProofV1 = { schemaVersion: typeof CLOSER_SIMULATION_AUTHORITY_PROOF_SCHEMA; proofId: string; issuanceNonce: string; authorityId: string; authoritySha256: string; founderUid: string; accountId: string; pursuitId: string; issuedAt: string; expiresAt: string; signature: string };

function secret(value: string | undefined): string { if (!value || Buffer.byteLength(value, "utf8") < 32) throw new CloserSimulationAuthorityError("authority_signing_unavailable", "The server authority-signing secret is unavailable or too short."); return value; }
function unsigned(authority: CloserSimulationAuthorityV1, issuanceNonce: string, issuedAt: string) { return { schemaVersion: CLOSER_SIMULATION_AUTHORITY_PROOF_SCHEMA, issuanceNonce, authorityId: authority.authorityId, authoritySha256: authority.authoritySha256, founderUid: authority.approvedByUid, accountId: authority.binding.accountId, pursuitId: authority.binding.pursuitId, issuedAt, expiresAt: authority.expiresAt }; }
function signature(body: ReturnType<typeof unsigned>, signingSecret: string): string { return createHmac("sha256", secret(signingSecret)).update(revenueCanonicalJson(body)).digest("hex"); }

export function issueFounderSimulationAuthorityProof(params: { authority: CloserSimulationAuthorityV1; issuedAt: string; signingSecret: string; issuanceNonce?: string }): CloserSimulationAuthorityProofV1 { const nonce = params.issuanceNonce ?? randomUUID(), body = unsigned(params.authority, nonce, params.issuedAt), sig = signature(body, params.signingSecret); return { ...body, proofId: revenueStableId("closersimauthproof", { body, signature: sig }), signature: sig }; }

export function verifyFounderSimulationAuthorityProof(params: { authority: CloserSimulationAuthorityV1; proof: CloserSimulationAuthorityProofV1; authenticatedUid: string; now: string; signingSecret: string }): void {
  const expectedBody = unsigned(params.authority, params.proof.issuanceNonce, params.proof.issuedAt), expected = signature(expectedBody, params.signingSecret), actual = params.proof.signature;
  if (params.proof.schemaVersion !== CLOSER_SIMULATION_AUTHORITY_PROOF_SCHEMA || params.proof.authorityId !== params.authority.authorityId || params.proof.authoritySha256 !== params.authority.authoritySha256 || params.proof.founderUid !== params.authenticatedUid || params.authority.approvedByUid !== params.authenticatedUid || params.proof.accountId !== params.authority.binding.accountId || params.proof.pursuitId !== params.authority.binding.pursuitId || params.proof.expiresAt !== params.authority.expiresAt || !/^[a-f0-9]{64}$/.test(actual) || !timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex")) || params.proof.proofId !== revenueStableId("closersimauthproof", { body: expectedBody, signature: expected })) throw new CloserSimulationAuthorityError("authority_issuance_invalid", "The prepared authority lacks valid server-issued Founder approval proof.");
  if (Date.parse(params.now) > Date.parse(params.proof.expiresAt)) throw new CloserSimulationAuthorityError("authority_expired", "The server-issued Founder approval proof expired.");
}
