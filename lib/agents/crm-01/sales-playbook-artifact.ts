import type { Firestore } from "firebase-admin/firestore";

import { APPROVED_SALES_CONTRACT_SHA256 } from "../sales-01/contract";
import type { CrmSalesIngestionV1 } from "../sales-01/crm-export";
import type { SalesPlaybookV1 } from "../sales-01/research-types";
import { crmSha256, crmStableId } from "./canonical";

export const SALES_PLAYBOOK_ARTIFACT_SCHEMA = "sales-playbook-artifact-v1" as const;
export const SALES_PLAYBOOK_ARTIFACT_VERSION = "v1" as const;
export const SALES_PLAYBOOK_ARTIFACT_CANONICALIZATION = "sales-playbook-artifact-canonical-json-v1" as const;
export const SALES_PLAYBOOK_ARTIFACT_CONTRACT = { schemaVersion: SALES_PLAYBOOK_ARTIFACT_SCHEMA, version: SALES_PLAYBOOK_ARTIFACT_VERSION, canonicalizationVersion: SALES_PLAYBOOK_ARTIFACT_CANONICALIZATION, semanticOwner: "SALES-01", persistenceCustodian: "CRM-01", payloadImmutable: true, currentnessSource: "pursuit-scoped-reference", executionAuthority: false } as const;
export const SALES_PLAYBOOK_ARTIFACT_CONTRACT_SHA256 = crmSha256(SALES_PLAYBOOK_ARTIFACT_CONTRACT);
export const APPROVED_SALES_PLAYBOOK_ARTIFACT_CONTRACT_SHA256 = "eec8788ebe8e263fbc3eda94dc2071f7988563543f9300fe162521b2b766aacf" as const;

export type SalesPlaybookArtifactV1 = { schemaVersion: typeof SALES_PLAYBOOK_ARTIFACT_SCHEMA; version: typeof SALES_PLAYBOOK_ARTIFACT_VERSION; canonicalizationVersion: typeof SALES_PLAYBOOK_ARTIFACT_CANONICALIZATION; contractSha256: string; artifactId: string; artifactSha256: string; acceptedSalesArtifactSha256: string; playbookSchemaVersion: "sales-playbook-v1"; accountId: string; pursuitId: string; salesContract: { version: "V1.2"; sha256: string }; salesProviderProjection: { version: string; sha256: string }; growthSource: { envelopeId: string; envelopeSha256: string; candidateSha256: string; version: "growth-sales-handoff-v1" }; crmIngestion: { schemaVersion: "crm-sales-ingestion-v1"; artifactSha256: string }; createdAt: string; acceptedPlaybook: SalesPlaybookV1; provenance: { evidencePreserved: true; unknownsPreserved: true; classificationsPreserved: true }; authority: { communication: false; closer: false; externalAction: false } };
export type SalesPlaybookCurrentReferenceV1 = { schemaVersion: "sales-playbook-current-reference-v1"; accountId: string; pursuitId: string; revision: number; currentArtifactId: string; currentArtifactSha256: string; supersessionHistory: Array<{ supersededArtifactId: string; supersededByArtifactId: string; at: string }>; updatedAt: string };
export type SalesPlaybookInfrastructureOperation = { kind: "create_immutable_artifact" | "set_current_reference"; path: string; expectedRevision: number | null; value: SalesPlaybookArtifactV1 | SalesPlaybookCurrentReferenceV1 };
export type CurrentSalesPlaybookProjectionV1 = { artifactId: string; artifactSha256: string; playbookVersion: "sales-playbook-v1"; growthSourceVersion: "growth-sales-handoff-v1"; superseded: false; accountId: string; pursuitId: string; pursuitDecision: SalesPlaybookV1["salesPursuitDecision"]; contacts: SalesPlaybookV1["contacts"]; bestFirstContactId: string | null; positioning: string; approvedClaims: SalesPlaybookV1["claims"]; offerContext: SalesPlaybookV1["opportunityStrategy"]["selectedEntryOffer"]; objections: SalesPlaybookV1["objections"]; escalationBoundaries: string[]; recommendedChannel: string; rights: SalesPlaybookV1["rights"]; inheritedUnknowns: SalesPlaybookV1["inheritedUnknowns"]; evidence: SalesPlaybookV1["evidence"] };

export class SalesPlaybookArtifactError extends Error { code: string; constructor(code: string, message: string) { super(message); this.name = "SalesPlaybookArtifactError"; this.code = code; } }

export const salesPlaybookArtifactPath = (artifactId: string) => `crm/sourceArtifacts/salesPlaybooks/${artifactId}`;
export const salesPlaybookReferencePath = (pursuitId: string) => `crm/sourceArtifactReferences/salesPursuits/${pursuitId}`;

export function buildSalesPlaybookArtifact(params: { exportArtifact: CrmSalesIngestionV1; accountId: string; pursuitId: string }): SalesPlaybookArtifactV1 {
  if (SALES_PLAYBOOK_ARTIFACT_CONTRACT_SHA256 !== APPROVED_SALES_PLAYBOOK_ARTIFACT_CONTRACT_SHA256) throw new SalesPlaybookArtifactError("artifact_contract_drift", "The Sales Playbook artifact contract failed its approved integrity check.");
  const source = params.exportArtifact.source;
  if (source.salesContract.version !== "V1.2" || source.salesContract.sha256 !== APPROVED_SALES_CONTRACT_SHA256) throw new SalesPlaybookArtifactError("sales_contract_mismatch", "The accepted Playbook is not bound to the frozen SALES contract.");
  const body = { schemaVersion: SALES_PLAYBOOK_ARTIFACT_SCHEMA, version: SALES_PLAYBOOK_ARTIFACT_VERSION, canonicalizationVersion: SALES_PLAYBOOK_ARTIFACT_CANONICALIZATION, contractSha256: SALES_PLAYBOOK_ARTIFACT_CONTRACT_SHA256, acceptedSalesArtifactSha256: params.exportArtifact.artifactSha256, playbookSchemaVersion: source.acceptedSalesPlaybook.schemaVersion, accountId: params.accountId, pursuitId: params.pursuitId, salesContract: { version: source.salesContract.version, sha256: source.salesContract.sha256 }, salesProviderProjection: { version: source.salesProviderProjection.version, sha256: source.salesProviderProjection.sha256 }, growthSource: { envelopeId: source.phase1AEnvelope.envelope.id, envelopeSha256: source.phase1AEnvelope.envelope.payloadSha256, candidateSha256: source.phase1AEnvelope.candidate.candidateSha256, version: source.phase1AEnvelope.schemaVersion }, crmIngestion: { schemaVersion: params.exportArtifact.schemaVersion, artifactSha256: params.exportArtifact.artifactSha256 }, createdAt: source.acceptedSalesPlaybook.createdAt, acceptedPlaybook: source.acceptedSalesPlaybook, provenance: { evidencePreserved: true as const, unknownsPreserved: true as const, classificationsPreserved: true as const }, authority: { communication: false as const, closer: false as const, externalAction: false as const } };
  const artifactSha256 = crmSha256(body), artifactId = crmStableId("salespb", body);
  return { ...body, artifactId, artifactSha256 };
}

export function verifySalesPlaybookArtifact(value: SalesPlaybookArtifactV1): void {
  if (value.schemaVersion !== SALES_PLAYBOOK_ARTIFACT_SCHEMA || value.version !== SALES_PLAYBOOK_ARTIFACT_VERSION || value.canonicalizationVersion !== SALES_PLAYBOOK_ARTIFACT_CANONICALIZATION || value.contractSha256 !== SALES_PLAYBOOK_ARTIFACT_CONTRACT_SHA256) throw new SalesPlaybookArtifactError("artifact_contract_mismatch", "The Sales Playbook artifact contract identity is invalid.");
  const { artifactId, artifactSha256, ...body } = value;
  if (crmSha256(body) !== artifactSha256 || crmStableId("salespb", body) !== artifactId) throw new SalesPlaybookArtifactError("artifact_integrity_failed", "The Sales Playbook artifact identity or payload hash is invalid.");
  if (value.salesContract.sha256 !== APPROVED_SALES_CONTRACT_SHA256 || value.acceptedPlaybook.schemaVersion !== "sales-playbook-v1") throw new SalesPlaybookArtifactError("source_identity_mismatch", "The Sales Playbook artifact source identity is invalid.");
}

export function verifySalesPlaybookCurrentReference(value: SalesPlaybookCurrentReferenceV1): void {
  if (value.schemaVersion !== "sales-playbook-current-reference-v1" || !Number.isInteger(value.revision) || value.revision < 1 || !value.accountId || !value.pursuitId || !value.currentArtifactId || !/^[a-f0-9]{64}$/.test(value.currentArtifactSha256) || Number.isNaN(Date.parse(value.updatedAt)) || !Array.isArray(value.supersessionHistory)) throw new SalesPlaybookArtifactError("current_reference_invalid", "The current Sales Playbook reference is malformed or ambiguous.");
  const superseded = new Set<string>();
  for (const entry of value.supersessionHistory) {
    if (!entry.supersededArtifactId || !entry.supersededByArtifactId || Number.isNaN(Date.parse(entry.at)) || entry.supersededArtifactId === entry.supersededByArtifactId || superseded.has(entry.supersededArtifactId)) throw new SalesPlaybookArtifactError("current_reference_ambiguous", "The Sales Playbook supersession history is ambiguous.");
    superseded.add(entry.supersededArtifactId);
  }
  if (superseded.has(value.currentArtifactId)) throw new SalesPlaybookArtifactError("current_reference_ambiguous", "The current Sales Playbook is also marked superseded.");
}

export function buildPlaybookInfrastructureOperations(params: { artifact: SalesPlaybookArtifactV1; priorReference: SalesPlaybookCurrentReferenceV1 | null }): SalesPlaybookInfrastructureOperation[] {
  const prior = params.priorReference;
  if (prior) verifySalesPlaybookCurrentReference(prior);
  if (prior && (prior.accountId !== params.artifact.accountId || prior.pursuitId !== params.artifact.pursuitId)) throw new SalesPlaybookArtifactError("reference_scope_mismatch", "The current Playbook reference is outside the accepted Account/Pursuit scope.");
  if (prior?.currentArtifactId === params.artifact.artifactId) return [];
  const history = prior ? [...prior.supersessionHistory, { supersededArtifactId: prior.currentArtifactId, supersededByArtifactId: params.artifact.artifactId, at: params.artifact.createdAt }] : [];
  const reference: SalesPlaybookCurrentReferenceV1 = { schemaVersion: "sales-playbook-current-reference-v1", accountId: params.artifact.accountId, pursuitId: params.artifact.pursuitId, revision: (prior?.revision ?? 0) + 1, currentArtifactId: params.artifact.artifactId, currentArtifactSha256: params.artifact.artifactSha256, supersessionHistory: history, updatedAt: params.artifact.createdAt };
  return [{ kind: "create_immutable_artifact", path: salesPlaybookArtifactPath(params.artifact.artifactId), expectedRevision: null, value: params.artifact }, { kind: "set_current_reference", path: salesPlaybookReferencePath(params.artifact.pursuitId), expectedRevision: prior?.revision ?? null, value: reference }];
}

export function projectCurrentSalesPlaybook(params: { artifact: SalesPlaybookArtifactV1; reference: SalesPlaybookCurrentReferenceV1; accountId: string; pursuitId: string }): CurrentSalesPlaybookProjectionV1 {
  verifySalesPlaybookArtifact(params.artifact);
  const { artifact, reference } = params;
  verifySalesPlaybookCurrentReference(reference);
  if (artifact.accountId !== params.accountId || artifact.pursuitId !== params.pursuitId || reference.accountId !== params.accountId || reference.pursuitId !== params.pursuitId) throw new SalesPlaybookArtifactError("artifact_scope_mismatch", "The current Sales Playbook is not bound to the requested Account/Pursuit.");
  if (reference.currentArtifactId !== artifact.artifactId || reference.currentArtifactSha256 !== artifact.artifactSha256) throw new SalesPlaybookArtifactError("artifact_not_current", "The Sales Playbook artifact is not the authoritative current artifact.");
  const p = artifact.acceptedPlaybook;
  const outreachClaimIds = new Set(p.outreach.claimIds);
  return { artifactId: artifact.artifactId, artifactSha256: artifact.artifactSha256, playbookVersion: p.schemaVersion, growthSourceVersion: artifact.growthSource.version, superseded: false, accountId: artifact.accountId, pursuitId: artifact.pursuitId, pursuitDecision: p.salesPursuitDecision, contacts: p.contacts, bestFirstContactId: p.contactSelection.bestFirstContactId, positioning: p.opportunityStrategy.goshshaWedge, approvedClaims: p.claims.filter((claim) => outreachClaimIds.has(claim.id) && claim.classification !== "prohibited_unsupported"), offerContext: p.opportunityStrategy.selectedEntryOffer, objections: p.objections, escalationBoundaries: ["Return to SALES-01 for material strategy, positioning, offer, claim, recipient, or objection changes.", "Founder approval remains required for external communication."], recommendedChannel: p.outreach.recommendedChannel, rights: p.rights, inheritedUnknowns: p.inheritedUnknowns, evidence: p.evidence };
}

export async function resolveCurrentSalesPlaybook(db: Firestore, accountId: string, pursuitId: string): Promise<CurrentSalesPlaybookProjectionV1> {
  const referenceSnap = await db.doc(salesPlaybookReferencePath(pursuitId)).get();
  if (!referenceSnap.exists) throw new SalesPlaybookArtifactError("current_playbook_missing", "No current authoritative Sales Playbook exists for this Pursuit.");
  const reference = referenceSnap.data() as SalesPlaybookCurrentReferenceV1;
  const artifactSnap = await db.doc(salesPlaybookArtifactPath(reference.currentArtifactId)).get();
  if (!artifactSnap.exists) throw new SalesPlaybookArtifactError("playbook_artifact_missing", "The referenced Sales Playbook artifact is missing.");
  return projectCurrentSalesPlaybook({ artifact: artifactSnap.data() as SalesPlaybookArtifactV1, reference, accountId, pursuitId });
}
