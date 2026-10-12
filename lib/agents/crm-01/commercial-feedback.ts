import { APPROVED_COMMERCIAL_POSITIONING_SHA256 } from "../commercial-positioning";
import { COMMERCIAL_OFFER_CATALOG_SHA256 } from "./commercial-offers";
import { revenueSha256, revenueStableId } from "../revenue-01/canonical";
import { verifyCanonicalPatternPacket } from "./canonical-objection-pattern";

export const COMMERCIAL_FEEDBACK_REQUEST_SCHEMA = "crm-commercial-feedback-review-request-v1" as const;
export const COMMERCIAL_FEEDBACK_FINDING_SCHEMA = "crm-commercial-feedback-specialist-finding-v1" as const;
export const COMMERCIAL_FEEDBACK_DISPOSITION_SCHEMA = "crm-commercial-feedback-founder-disposition-v1" as const;
export const COMMERCIAL_FEEDBACK_CHANGE_SCHEMA = "sales-playbook-supported-change-v1" as const;

export type SpecialistOwner = "sales" | "revenue";

type ContextBinding = {
  accountId: string;
  pursuitId: string;
  crmRevisionSetSha256: string;
  salesPlaybookArtifactId: string;
  salesPlaybookArtifactSha256: string;
  revenueRecommendationId: string;
  revenueRecommendationSha256: string;
  revenueApprovedPackageId: string;
  revenueApprovedPackageSha256: string;
  revenueApprovedPackageState: "verified_session_package";
};

const verifyHash = (value: string, field: string) => {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error(`${field}_invalid`);
};

export function buildCommercialFeedbackRequest(params: {
  packet: any;
  contexts: ContextBinding[];
  owners: SpecialistOwner[];
  requestedByUid: string;
}) {
  verifyCanonicalPatternPacket(params.packet);
  const owners = [...new Set(params.owners)].sort() as SpecialistOwner[];
  if (!owners.length || owners.some((owner) => owner !== "sales" && owner !== "revenue")) throw new Error("commercial_feedback_owner_invalid");
  const contexts = [...params.contexts].sort((a, b) => `${a.accountId}|${a.pursuitId}`.localeCompare(`${b.accountId}|${b.pursuitId}`));
  if (!contexts.length) throw new Error("commercial_feedback_context_missing");
  for (const context of contexts) {
    for (const [field, value] of Object.entries(context)) if (field.endsWith("Sha256")) verifyHash(String(value), field);
    if (!params.packet.sourceEvidence.some((source: any) => source.accountId === context.accountId && source.pursuitId === context.pursuitId)) throw new Error("commercial_feedback_context_scope_mismatch");
  }
  const body = {
    schemaVersion: COMMERCIAL_FEEDBACK_REQUEST_SCHEMA,
    packetId: params.packet.packetId,
    packetSha256: params.packet.packetSha256,
    assessmentBindings: params.packet.assessmentBindings,
    sourceEvidence: params.packet.sourceEvidence,
    population: params.packet.population,
    categoryId: params.packet.categoryId,
    contexts,
    owners,
    identities: {
      commercialPositioningSha256: APPROVED_COMMERCIAL_POSITIONING_SHA256,
      offerCatalogSha256: COMMERCIAL_OFFER_CATALOG_SHA256,
    },
    requestedByUid: params.requestedByUid,
    explicitFounderRequestRequired: true as const,
    authority: { invokeSpecialists: false as const, applyChanges: false as const, continueCloser: false as const, externalAction: false as const },
  };
  return { ...body, requestId: revenueStableId("commercialfeedbackrequest", body), requestSha256: revenueSha256(body) };
}

export function verifyCommercialFeedbackRequest(value: any) {
  const { requestId, requestSha256, ...body } = value;
  if (body.schemaVersion !== COMMERCIAL_FEEDBACK_REQUEST_SCHEMA || revenueStableId("commercialfeedbackrequest", body) !== requestId || revenueSha256(body) !== requestSha256) throw new Error("commercial_feedback_request_integrity_failed");
}

export function buildCommercialFeedbackFinding(params: {
  owner: SpecialistOwner;
  request: ReturnType<typeof buildCommercialFeedbackRequest>;
  adapter: string;
  analysis: { conclusion: string; reasons: string[]; proposedChanges: string[]; missingEvidenceRequirements: string[]; limitations: string[] };
  reviewedByUid: string;
}) {
  verifyCommercialFeedbackRequest(params.request);
  if (!params.request.owners.includes(params.owner)) throw new Error("commercial_feedback_owner_not_requested");
  if (!params.analysis.conclusion || !params.analysis.reasons.length) throw new Error("commercial_feedback_analysis_invalid");
  const body = {
    schemaVersion: COMMERCIAL_FEEDBACK_FINDING_SCHEMA,
    owner: params.owner,
    adapter: params.adapter,
    requestId: params.request.requestId,
    requestSha256: params.request.requestSha256,
    assessmentBindings: params.request.assessmentBindings,
    sourceEvidence: params.request.sourceEvidence,
    contextBindings: params.request.contexts,
    identities: params.request.identities,
    analysis: params.analysis,
    reviewedByUid: params.reviewedByUid,
    missingEvidenceSatisfied: params.analysis.missingEvidenceRequirements.length === 0,
    authority: { changesApplied: false as const, closerContinuation: false as const, externalAction: false as const },
  };
  return { ...body, findingId: revenueStableId(`${params.owner}commercialfeedback`, body), findingSha256: revenueSha256(body) };
}

export function verifyCommercialFeedbackFinding(value: any) {
  const { findingId, findingSha256, recordedAt: _recordedAt, replayed: _replayed, telemetry: _telemetry, ...body } = value;
  if (body.schemaVersion !== COMMERCIAL_FEEDBACK_FINDING_SCHEMA || revenueStableId(`${body.owner}commercialfeedback`, body) !== findingId || revenueSha256(body) !== findingSha256) throw new Error("commercial_feedback_finding_integrity_failed");
}

export function buildCommercialFeedbackDisposition(params: {
  request: ReturnType<typeof buildCommercialFeedbackRequest>;
  findings: any[];
  disposition: "accept_supported_change" | "keep_current" | "defer" | "reject";
  rationale: string;
  reviewerUid: string;
}) {
  verifyCommercialFeedbackRequest(params.request);
  if (!params.rationale.trim()) throw new Error("commercial_feedback_disposition_rationale_required");
  const findings = [...params.findings].sort((a, b) => String(a.owner).localeCompare(String(b.owner)));
  for (const finding of findings) {
    verifyCommercialFeedbackFinding(finding);
    if (finding.requestId !== params.request.requestId || finding.requestSha256 !== params.request.requestSha256) throw new Error("commercial_feedback_finding_scope_mismatch");
  }
  for (const owner of params.request.owners) if (!findings.some((finding) => finding.owner === owner)) throw new Error("commercial_feedback_findings_incomplete");
  const unresolved = findings.flatMap((finding) => finding.analysis.missingEvidenceRequirements.map((requirement: string) => ({ owner: finding.owner, requirement })));
  if (params.disposition === "accept_supported_change" && unresolved.length) throw new Error("commercial_feedback_missing_evidence_unresolved");
  const body = {
    schemaVersion: COMMERCIAL_FEEDBACK_DISPOSITION_SCHEMA,
    requestId: params.request.requestId,
    requestSha256: params.request.requestSha256,
    findingBindings: findings.map((finding) => ({ owner: finding.owner, findingId: finding.findingId, findingSha256: finding.findingSha256 })),
    disposition: params.disposition,
    rationale: params.rationale.trim(),
    reviewerUid: params.reviewerUid,
    unresolvedDependencies: unresolved,
    changesApplied: false as const,
    freshCloserContextRequired: true as const,
    closerContinuation: false as const,
    externalAction: false as const,
  };
  return { ...body, dispositionId: revenueStableId("commercialfeedbackdisposition", body), dispositionSha256: revenueSha256(body) };
}

export function verifyCommercialFeedbackDisposition(value: any) {
  const { dispositionId, dispositionSha256, recordedAt: _recordedAt, replayed: _replayed, ...body } = value;
  if (body.schemaVersion !== COMMERCIAL_FEEDBACK_DISPOSITION_SCHEMA || revenueStableId("commercialfeedbackdisposition", body) !== dispositionId || revenueSha256(body) !== dispositionSha256) throw new Error("commercial_feedback_disposition_integrity_failed");
}

export function buildSupportedPlaybookChange(params: {
  request: ReturnType<typeof buildCommercialFeedbackRequest>;
  salesFinding: any;
  revenueFinding: any;
  disposition: any;
  exactBefore: unknown;
  exactAfter: unknown;
  proposedByUid: string;
}) {
  verifyCommercialFeedbackRequest(params.request);
  verifyCommercialFeedbackFinding(params.salesFinding);
  verifyCommercialFeedbackFinding(params.revenueFinding);
  verifyCommercialFeedbackDisposition(params.disposition);
  if (params.disposition.disposition !== "accept_supported_change" || params.disposition.requestId !== params.request.requestId) throw new Error("commercial_feedback_change_not_approved");
  if (params.disposition.unresolvedDependencies.length) throw new Error("commercial_feedback_missing_evidence_unresolved");
  const body = {
    schemaVersion: COMMERCIAL_FEEDBACK_CHANGE_SCHEMA,
    semanticOwner: "SALES-01" as const,
    requestId: params.request.requestId,
    requestSha256: params.request.requestSha256,
    sourcePlaybooks: params.request.contexts.map((context) => ({ accountId: context.accountId, pursuitId: context.pursuitId, artifactId: context.salesPlaybookArtifactId, artifactSha256: context.salesPlaybookArtifactSha256 })),
    lineage: {
      salesFinding: { findingId: params.salesFinding.findingId, findingSha256: params.salesFinding.findingSha256 },
      revenueFinding: { findingId: params.revenueFinding.findingId, findingSha256: params.revenueFinding.findingSha256 },
      founderDisposition: { dispositionId: params.disposition.dispositionId, dispositionSha256: params.disposition.dispositionSha256 },
    },
    exactBefore: params.exactBefore,
    exactAfter: params.exactAfter,
    unchanged: params.request.identities,
    proposedByUid: params.proposedByUid,
    exactFounderApprovalRequired: true as const,
    authority: { apply: false as const, continueCloser: false as const, externalAction: false as const },
  };
  return { ...body, changeId: revenueStableId("supportedplaybookchange", body), changeSha256: revenueSha256(body) };
}

export function verifySupportedPlaybookChange(value:any){const{changeId,changeSha256,...body}=value;if(body.schemaVersion!==COMMERCIAL_FEEDBACK_CHANGE_SCHEMA||revenueStableId("supportedplaybookchange",body)!==changeId||revenueSha256(body)!==changeSha256)throw new Error("commercial_feedback_change_integrity_failed")}
