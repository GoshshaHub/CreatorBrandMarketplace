import type { Firestore } from "firebase-admin/firestore";

import { APPROVED_SALES_CONTRACT_SHA256, LEGACY_SALES_V1_2_CONTRACT_SHA256, LEGACY_SALES_V1_3_CONTRACT_SHA256 } from "../sales-01/contract";
import { APPROVED_COMMERCIAL_POSITIONING_SHA256 } from "../commercial-positioning";
import type { CrmSalesIngestionV1 } from "../sales-01/crm-export";
import type { SalesPlaybookV1 } from "../sales-01/research-types";
import { crmSha256, crmStableId } from "./canonical";

export const SALES_PLAYBOOK_ARTIFACT_SCHEMA = "sales-playbook-artifact-v2" as const;
export const SALES_PLAYBOOK_ARTIFACT_VERSION = "v2" as const;
export const SALES_PLAYBOOK_ARTIFACT_CANONICALIZATION = "sales-playbook-artifact-canonical-json-v2" as const;
export const SALES_PLAYBOOK_ARTIFACT_CONTRACT = { schemaVersion: SALES_PLAYBOOK_ARTIFACT_SCHEMA, version: SALES_PLAYBOOK_ARTIFACT_VERSION, canonicalizationVersion: SALES_PLAYBOOK_ARTIFACT_CANONICALIZATION, semanticOwner: "SALES-01", persistenceCustodian: "CRM-01", payloadImmutable: true, currentnessSource: "pursuit-scoped-reference", readinessSeparated: true, executionAuthority: false } as const;
export const SALES_PLAYBOOK_ARTIFACT_CONTRACT_SHA256 = crmSha256(SALES_PLAYBOOK_ARTIFACT_CONTRACT);
export const APPROVED_SALES_PLAYBOOK_ARTIFACT_CONTRACT_SHA256 = "d26341a6dca6b585c04a90dd151da4ae28400c3e63f138fa67fe5cfed2137164" as const;
export const LEGACY_SALES_PLAYBOOK_ARTIFACT_CONTRACT_SHA256 = "eec8788ebe8e263fbc3eda94dc2071f7988563543f9300fe162521b2b766aacf" as const;

export type SalesPlaybookArtifactV1 = { schemaVersion: "sales-playbook-artifact-v1"|typeof SALES_PLAYBOOK_ARTIFACT_SCHEMA; version: "v1"|typeof SALES_PLAYBOOK_ARTIFACT_VERSION; canonicalizationVersion: "sales-playbook-artifact-canonical-json-v1"|typeof SALES_PLAYBOOK_ARTIFACT_CANONICALIZATION; contractSha256: string; artifactId: string; artifactSha256: string; acceptedSalesArtifactSha256: string; playbookSchemaVersion: "sales-playbook-v1"|"sales-playbook-v1.1"|"sales-playbook-v1.2"; accountId: string; pursuitId: string; salesContract: { version: "V1.2"|"V1.3"|"V1.4"; sha256: string }; salesProviderProjection: { version: string; sha256: string }; growthSource: { envelopeId: string; envelopeSha256: string; candidateSha256: string; version: "growth-sales-handoff-v1"|"growth-sales-handoff-v1.1" }; crmIngestion: { schemaVersion: "crm-sales-ingestion-v1"; artifactSha256: string }; createdAt: string; acceptedPlaybook: SalesPlaybookV1|any; provenance: { evidencePreserved: true; unknownsPreserved: true; classificationsPreserved: true }; authority: { communication: false; closer: false; externalAction: false }; revisionLineage?: { sourceArtifactId:string;sourceArtifactSha256:string;commercialFeedbackRequestId:string;commercialFeedbackRequestSha256:string;salesFindingId:string;salesFindingSha256:string;revenueFindingId:string;revenueFindingSha256:string;founderDispositionId:string;founderDispositionSha256:string;supportedChangeId:string;supportedChangeSha256:string;approvedByUid:string } };
export type SalesPlaybookCurrentReferenceV1 = { schemaVersion: "sales-playbook-current-reference-v1"; accountId: string; pursuitId: string; revision: number; currentArtifactId: string; currentArtifactSha256: string; supersessionHistory: Array<{ supersededArtifactId: string; supersededByArtifactId: string; at: string }>; updatedAt: string };
export type SalesPlaybookInfrastructureOperation = { kind: "create_immutable_artifact" | "set_current_reference"; path: string; expectedRevision: number | null; value: SalesPlaybookArtifactV1 | SalesPlaybookCurrentReferenceV1 };
export type CurrentSalesPlaybookProjectionV1 = { artifactId: string; artifactSha256: string; playbookVersion: "sales-playbook-v1"|"sales-playbook-v1.1"|"sales-playbook-v1.2"; growthSourceVersion: "growth-sales-handoff-v1"|"growth-sales-handoff-v1.1"; superseded: false; accountId: string; pursuitId: string; pursuitDecision: SalesPlaybookV1["salesPursuitDecision"]; contacts: SalesPlaybookV1["contacts"]; bestFirstContactId: string | null; positioning: string; approvedClaims: SalesPlaybookV1["claims"]; platformClaims: SalesPlaybookV1["positioningFoundation"]["approvedPlatformClaims"]|[]; positioningArtifact: {version:"v1";sha256:string}|null; mechanicsQualifications:string[]; audienceObjection:SalesPlaybookV1["positioningFoundation"]["audienceObjection"]|null; prohibitedClaims:readonly string[]; offerContext: SalesPlaybookV1["opportunityStrategy"]["selectedEntryOffer"]; objections: SalesPlaybookV1["objections"]; escalationBoundaries: string[]; recommendedChannel: string; rights: SalesPlaybookV1["rights"]; readiness: SalesPlaybookV1["readiness"]|null; inheritedUnknowns: SalesPlaybookV1["inheritedUnknowns"]; evidence: SalesPlaybookV1["evidence"] };

export class SalesPlaybookArtifactError extends Error { code: string; constructor(code: string, message: string) { super(message); this.name = "SalesPlaybookArtifactError"; this.code = code; } }

export const salesPlaybookArtifactPath = (artifactId: string) => `crm/sourceArtifacts/salesPlaybooks/${artifactId}`;
export const salesPlaybookReferencePath = (pursuitId: string) => `crm/sourceArtifactReferences/salesPursuits/${pursuitId}`;

export function buildSalesPlaybookRevisionArtifact(params:{source:SalesPlaybookArtifactV1;acceptedPlaybook:any;lineage:NonNullable<SalesPlaybookArtifactV1["revisionLineage"]>;createdAt:string}):SalesPlaybookArtifactV1{
  verifySalesPlaybookArtifact(params.source);
  if(params.source.salesContract.version!=="V1.4"||params.source.acceptedPlaybook.schemaVersion!=="sales-playbook-v1.2")throw new SalesPlaybookArtifactError("playbook_revision_source_legacy","Only the current SALES V1.4 Playbook may be revised by this workflow.");
  if(params.lineage.sourceArtifactId!==params.source.artifactId||params.lineage.sourceArtifactSha256!==params.source.artifactSha256)throw new SalesPlaybookArtifactError("playbook_revision_lineage_invalid","The revision lineage does not match the current immutable source artifact.");
  const body={schemaVersion:params.source.schemaVersion,version:params.source.version,canonicalizationVersion:params.source.canonicalizationVersion,contractSha256:params.source.contractSha256,acceptedSalesArtifactSha256:params.source.acceptedSalesArtifactSha256,playbookSchemaVersion:params.source.playbookSchemaVersion,accountId:params.source.accountId,pursuitId:params.source.pursuitId,salesContract:params.source.salesContract,salesProviderProjection:params.source.salesProviderProjection,growthSource:params.source.growthSource,crmIngestion:params.source.crmIngestion,createdAt:params.createdAt,acceptedPlaybook:params.acceptedPlaybook,provenance:params.source.provenance,authority:params.source.authority,revisionLineage:params.lineage};
  return{...body,artifactId:crmStableId("salespb",body),artifactSha256:crmSha256(body)};
}

export function buildSalesPlaybookArtifact(params: { exportArtifact: CrmSalesIngestionV1; accountId: string; pursuitId: string }): SalesPlaybookArtifactV1 {
  if (SALES_PLAYBOOK_ARTIFACT_CONTRACT_SHA256 !== APPROVED_SALES_PLAYBOOK_ARTIFACT_CONTRACT_SHA256) throw new SalesPlaybookArtifactError("artifact_contract_drift", "The Sales Playbook artifact contract failed its approved integrity check.");
  const source = params.exportArtifact.source;
  if (source.salesContract.version !== "V1.4" || source.salesContract.sha256 !== APPROVED_SALES_CONTRACT_SHA256 || source.acceptedSalesPlaybook.schemaVersion !== "sales-playbook-v1.2" || source.acceptedSalesPlaybook.positioningFoundation?.sha256 !== APPROVED_COMMERCIAL_POSITIONING_SHA256) throw new SalesPlaybookArtifactError("sales_contract_mismatch", "The accepted Playbook is not bound to the frozen SALES V1.4 contract and positioning artifact.");
  const body = { schemaVersion: SALES_PLAYBOOK_ARTIFACT_SCHEMA, version: SALES_PLAYBOOK_ARTIFACT_VERSION, canonicalizationVersion: SALES_PLAYBOOK_ARTIFACT_CANONICALIZATION, contractSha256: SALES_PLAYBOOK_ARTIFACT_CONTRACT_SHA256, acceptedSalesArtifactSha256: params.exportArtifact.artifactSha256, playbookSchemaVersion: source.acceptedSalesPlaybook.schemaVersion, accountId: params.accountId, pursuitId: params.pursuitId, salesContract: { version: source.salesContract.version, sha256: source.salesContract.sha256 }, salesProviderProjection: { version: source.salesProviderProjection.version, sha256: source.salesProviderProjection.sha256 }, growthSource: { envelopeId: source.phase1AEnvelope.envelope.id, envelopeSha256: source.phase1AEnvelope.envelope.payloadSha256, candidateSha256: source.phase1AEnvelope.candidate.candidateSha256, version: source.phase1AEnvelope.schemaVersion }, crmIngestion: { schemaVersion: params.exportArtifact.schemaVersion, artifactSha256: params.exportArtifact.artifactSha256 }, createdAt: source.acceptedSalesPlaybook.createdAt, acceptedPlaybook: source.acceptedSalesPlaybook, provenance: { evidencePreserved: true as const, unknownsPreserved: true as const, classificationsPreserved: true as const }, authority: { communication: false as const, closer: false as const, externalAction: false as const } };
  const artifactSha256 = crmSha256(body), artifactId = crmStableId("salespb", body);
  return { ...body, artifactId, artifactSha256 };
}

export function verifySalesPlaybookArtifact(value: SalesPlaybookArtifactV1): void {
  const currentContract=value.schemaVersion===SALES_PLAYBOOK_ARTIFACT_SCHEMA&&value.version===SALES_PLAYBOOK_ARTIFACT_VERSION&&value.canonicalizationVersion===SALES_PLAYBOOK_ARTIFACT_CANONICALIZATION&&value.contractSha256===SALES_PLAYBOOK_ARTIFACT_CONTRACT_SHA256;
  const legacyContract=value.schemaVersion==="sales-playbook-artifact-v1"&&value.version==="v1"&&value.canonicalizationVersion==="sales-playbook-artifact-canonical-json-v1"&&value.contractSha256===LEGACY_SALES_PLAYBOOK_ARTIFACT_CONTRACT_SHA256;
  if (!currentContract&&!legacyContract) throw new SalesPlaybookArtifactError("artifact_contract_mismatch", "The Sales Playbook artifact contract identity is invalid.");
  const { artifactId, artifactSha256, ...body } = value;
  if (crmSha256(body) !== artifactSha256 || crmStableId("salespb", body) !== artifactId) throw new SalesPlaybookArtifactError("artifact_integrity_failed", "The Sales Playbook artifact identity or payload hash is invalid.");
  const current=currentContract&&value.salesContract.version==="V1.4"&&value.salesContract.sha256===APPROVED_SALES_CONTRACT_SHA256&&value.acceptedPlaybook.schemaVersion==="sales-playbook-v1.2"&&value.acceptedPlaybook.positioningFoundation?.sha256===APPROVED_COMMERCIAL_POSITIONING_SHA256;
  const historicalV13=legacyContract&&value.salesContract.version==="V1.3"&&value.salesContract.sha256===LEGACY_SALES_V1_3_CONTRACT_SHA256&&value.acceptedPlaybook.schemaVersion==="sales-playbook-v1.1"&&value.acceptedPlaybook.positioningFoundation?.sha256===APPROVED_COMMERCIAL_POSITIONING_SHA256;
  const historicalV12=legacyContract&&value.salesContract.version==="V1.2"&&value.salesContract.sha256===LEGACY_SALES_V1_2_CONTRACT_SHA256&&value.acceptedPlaybook.schemaVersion==="sales-playbook-v1"&&!value.acceptedPlaybook.positioningFoundation;
  if(!current&&!historicalV13&&!historicalV12)throw new SalesPlaybookArtifactError("source_identity_mismatch", "The Sales Playbook artifact source identity is invalid or mixes historical and current semantics.");
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
  return { artifactId: artifact.artifactId, artifactSha256: artifact.artifactSha256, playbookVersion: p.schemaVersion, growthSourceVersion: artifact.growthSource.version, superseded: false, accountId: artifact.accountId, pursuitId: artifact.pursuitId, pursuitDecision: p.salesPursuitDecision, contacts: p.contacts, bestFirstContactId: p.contactSelection.bestFirstContactId, positioning: p.positioningFoundation?.opportunitySpecificPositioning??p.opportunityStrategy.goshshaWedge, approvedClaims: p.claims.filter((claim:any) => outreachClaimIds.has(claim.id) && claim.classification !== "prohibited_unsupported"), platformClaims:p.positioningFoundation?.approvedPlatformClaims??[],positioningArtifact:p.positioningFoundation?{version:p.positioningFoundation.version,sha256:p.positioningFoundation.sha256}:null,mechanicsQualifications:p.positioningFoundation?.mechanicsQualifications??[],audienceObjection:p.positioningFoundation?.audienceObjection??null,prohibitedClaims:p.positioningFoundation?.prohibitedClaims??[], offerContext: p.opportunityStrategy.selectedEntryOffer, objections: p.objections, escalationBoundaries: ["Return to SALES-01 for material strategy, positioning, offer, claim, recipient, or objection changes.", "Founder approval remains required for external communication.", "Asset selection, rights clearance, upload, publication, activation, fulfillment, and payment execution remain outside prospecting authority."], recommendedChannel: p.outreach.recommendedChannel, rights: p.rights, readiness:p.readiness??null, inheritedUnknowns: p.inheritedUnknowns, evidence: p.evidence };
}

export async function resolveCurrentSalesPlaybook(db: Firestore, accountId: string, pursuitId: string): Promise<CurrentSalesPlaybookProjectionV1> {
  const state=await resolveCurrentSalesPlaybookState(db,accountId,pursuitId);return projectCurrentSalesPlaybook({artifact:state.artifact,reference:state.reference,accountId,pursuitId});
}

export async function resolveCurrentSalesPlaybookState(db: Firestore, accountId: string, pursuitId: string): Promise<{artifact:SalesPlaybookArtifactV1;reference:SalesPlaybookCurrentReferenceV1}> {
  const referenceSnap = await db.doc(salesPlaybookReferencePath(pursuitId)).get();
  if (!referenceSnap.exists) throw new SalesPlaybookArtifactError("current_playbook_missing", "No current authoritative Sales Playbook exists for this Pursuit.");
  const reference = referenceSnap.data() as SalesPlaybookCurrentReferenceV1;
  const artifactSnap = await db.doc(salesPlaybookArtifactPath(reference.currentArtifactId)).get();
  if (!artifactSnap.exists) throw new SalesPlaybookArtifactError("playbook_artifact_missing", "The referenced Sales Playbook artifact is missing.");
  const artifact=artifactSnap.data() as SalesPlaybookArtifactV1;projectCurrentSalesPlaybook({ artifact, reference, accountId, pursuitId });return{artifact,reference};
}
