import {
  APPROVED_GROWTH_PROVIDER_PROJECTION_SHA256,
  GROWTH_PROVIDER_RESEARCH_PROJECTION_VERSION,
  PAIRED_FROZEN_GROWTH_CONTRACT_SHA256,
} from "../growth-01/provider-research-contract";
import { scoreGrowthCandidate } from "../growth-01/scoring";
import type { GrowthCandidateInput, ScoredCandidate, ValidationFinding } from "../growth-01/types";
import { validateGrowthCandidate, validateGrowthRunRequest } from "../growth-01/validation";
import { canonicalJson, sha256Canonical } from "./canonical";
import { verifyGrowthContractIdentity } from "./contract";
import type {
  GrowthSalesHandoffEnvelopeV1,
  SalesContractMetadata,
  SalesIntakeFinding,
  SalesIntakeRequest,
  SalesIntakeResult,
} from "./types";

export const MAX_SALES_INTAKE_BYTES = 500_000;

const REGULATED_CLAIM = /\b(medical|therapeutic|treat(?:s|ment)?|prevent(?:s|ion)?|disease|health|efficacy|effective|safety|safe|dosage|dose|ingredient[- ]interaction|regulatory|fda)\b/i;
const RIGHTS_CLAIM = /\b(owns?|holds?|has|cleared|licensed|controls?|can reuse|rights? to)\b.*\b(content|video|creator|reuse|activation rights?)\b/i;
const CONDITIONAL_OR_UNKNOWN = /\b(unknown|unresolved|must later|would need|conditional|if|subject to|not verified|not confirmed)\b/i;

function finding(code: string, message: string, field?: string, candidateId?: string): SalesIntakeFinding {
  return { code, severity: "error", message, field, candidateId };
}

function candidateInput(candidate: ScoredCandidate): GrowthCandidateInput {
  const { computed: _computed, ...input } = candidate;
  return input;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function envelopeHashInput(envelope: GrowthSalesHandoffEnvelopeV1): GrowthSalesHandoffEnvelopeV1 {
  return {
    ...envelope,
    envelope: { ...envelope.envelope, payloadSha256: "" },
  };
}

export function verifySalesEnvelopeIntegrity(envelope: GrowthSalesHandoffEnvelopeV1): boolean {
  return envelope.candidate.candidateSha256 === sha256Canonical(envelope.candidate.completeCandidate)
    && envelope.envelope.payloadSha256 === sha256Canonical(envelopeHashInput(envelope));
}

export function validateSalesIntake(params: {
  input: SalesIntakeRequest;
  approvedByUid: string;
  approvedAt: string;
  salesContract: SalesContractMetadata;
}): SalesIntakeResult {
  const findings: SalesIntakeFinding[] = [];
  const supplied = params.input as SalesIntakeRequest | null;
  const exported = supplied?.export;
  const run = exported?.validatedRun;

  if (!exported || exported.exportVersion !== "growth-sales-export-v1") {
    findings.push(finding("export_version_invalid", "A complete growth-sales-export-v1 packet is required.", "export.exportVersion"));
  }
  if (!run || run.run?.status !== "valid") {
    findings.push(finding("growth_run_not_valid", "The source GROWTH-01 run must have passed Phase 1A validation.", "export.validatedRun.run.status"));
  }
  if (run?.run?.authority !== "founder_supervised_preview_only" || run?.run?.persistence !== false || run?.run?.externalCommunication !== false) {
    findings.push(finding("growth_authority_invalid", "The source must retain the supervised, nonpersistent, non-communicating GROWTH authority boundary.", "export.validatedRun.run"));
  }
  try {
    if (run?.contract?.sha256) {
      verifyGrowthContractIdentity(run.contract.sha256);
      if (run.contract.name !== "GROWTH-01" || run.contract.version !== "V1" || run.contract.path !== "agents/growth-01/AGENT.md") {
        findings.push(finding("growth_contract_metadata_invalid", "The supplied GROWTH contract metadata does not identify the approved frozen contract.", "export.validatedRun.contract"));
      }
    }
    else findings.push(finding("growth_contract_missing", "The frozen GROWTH-01 contract identity is required.", "export.validatedRun.contract"));
  } catch (error) {
    findings.push(finding("growth_contract_mismatch", error instanceof Error ? error.message : "The GROWTH-01 contract identity is invalid.", "export.validatedRun.contract.sha256"));
  }

  if (exported?.providerProjection) {
    const projection = exported.providerProjection;
    if (projection.version !== GROWTH_PROVIDER_RESEARCH_PROJECTION_VERSION
      || projection.sha256 !== APPROVED_GROWTH_PROVIDER_PROJECTION_SHA256
      || projection.pairedFrozenContractSha256 !== PAIRED_FROZEN_GROWTH_CONTRACT_SHA256) {
      findings.push(finding("provider_projection_mismatch", "The provider projection is not paired to the approved frozen GROWTH contract.", "export.providerProjection"));
    }
  }
  if (!exported?.authority?.exportOnly || exported.authority.founderApprovedForSales !== false
    || exported.authority.salesInvoked !== false || exported.authority.persisted !== false
    || exported.authority.downstreamInvoked !== false || exported.authority.externalAction !== false) {
    findings.push(finding("export_authority_invalid", "The source artifact must remain an export-only, nonpersistent, non-executing packet.", "export.authority"));
  }
  if (supplied?.founderApproval?.approved !== true || supplied.founderApproval.scope !== "sales_preparation_only") {
    findings.push(finding("founder_approval_missing", "Founder approval for this exact SALES preparation intake is required.", "founderApproval"));
  }

  const candidates = Array.isArray(run?.candidates) ? run.candidates : [];
  if (run && (run.run.candidateCount !== candidates.length
    || run.run.qualifiedCount !== candidates.filter((item) => item.selectionStatus === "qualified").length)) {
    findings.push(finding("growth_run_counts_mismatch", "The GROWTH run candidate or qualified count does not match its complete candidate collection.", "export.validatedRun.run"));
  }
  const candidateIndex = candidates.findIndex((item) => item?.id === supplied?.candidateId);
  const candidate = candidateIndex >= 0 ? candidates[candidateIndex] : null;
  if (!candidate) findings.push(finding("candidate_not_found", "The selected candidate is not present in the validated GROWTH run.", "candidateId", supplied?.candidateId));
  const context = exported?.candidateContexts?.find((item) => item?.candidateId === supplied?.candidateId);
  if (!context) findings.push(finding("candidate_context_missing", "The selected candidate requires explicit null/unknown and claims-boundary context.", "export.candidateContexts", supplied?.candidateId));

  if (run) {
    findings.push(...validateGrowthRunRequest({
      asOfDate: run.run.asOfDate,
      marketFocus: run.run.marketFocus,
      maximumQualified: Math.max(1, run.run.qualifiedCount),
      candidates: candidates.map(candidateInput),
    }));
    if (run.findings?.some((item) => item.severity === "error")) {
      findings.push(finding("growth_validation_errors_present", "The supplied GROWTH result contains validation errors.", "export.validatedRun.findings"));
    }
  }

  let rescored: ScoredCandidate | null = null;
  if (candidate) {
    const result = scoreGrowthCandidate(candidateInput(candidate));
    rescored = result.candidate;
    findings.push(...result.findings, ...validateGrowthCandidate(result.candidate).findings);
    if (canonicalJson(result.candidate.computed) !== canonicalJson(candidate.computed)
      || canonicalJson(result.candidate.scores) !== canonicalJson(candidate.scores)
      || canonicalJson(result.candidate.deductions || {}) !== canonicalJson(candidate.deductions || {})
      || canonicalJson(result.candidate.caps || []) !== canonicalJson(candidate.caps || [])) {
      findings.push(finding("growth_score_not_preserved", "Growth score, band, breakdown, deductions, or caps changed during SALES intake.", "candidate", candidate.id));
    }
    if (candidate.selectionStatus !== "qualified" || candidate.handoff !== "SALES-01") {
      findings.push(finding("candidate_not_sales_qualified", "Only a qualified GROWTH candidate recommended for SALES-01 may enter this workspace.", "candidate.selectionStatus", candidate.id));
    }
    if (candidate.freeFirst?.scoreContribution !== 0) {
      findings.push(finding("free_first_not_zero", "Free First must remain a $0 proof/acquisition step with zero score contribution.", "candidate.freeFirst.scoreContribution", candidate.id));
    }

    const evidenceIds = new Set<string>();
    for (const evidence of candidate.evidence || []) {
      if (evidenceIds.has(evidence.id)) findings.push(finding("duplicate_evidence_id", `Evidence ID ${evidence.id} is duplicated.`, "candidate.evidence", candidate.id));
      evidenceIds.add(evidence.id);
    }
    const claimIds = new Set(candidate.claims.map((claim) => claim.id));
    for (const claim of candidate.claims) {
      if (claim.material && claim.evidenceIds.length === 0) findings.push(finding("material_claim_unlinked", `Material claim ${claim.id} has no evidence.`, "candidate.claims", candidate.id));
      if (claim.evidenceIds.some((id) => !evidenceIds.has(id))) findings.push(finding("claim_reference_invalid", `Claim ${claim.id} references missing evidence.`, "candidate.claims", candidate.id));
    }

    if (context) {
      if (context.triggerDate.value !== null && context.triggerDate.provenance === "unknown") findings.push(finding("trigger_date_provenance_invalid", "An unknown trigger date cannot contain a value.", "candidateContext.triggerDate", candidate.id));
      if (context.physicalScanExperience.value !== null && context.physicalScanExperience.provenance === "unknown") findings.push(finding("scan_provenance_invalid", "An unknown physical-scan experience cannot contain a value.", "candidateContext.physicalScanExperience", candidate.id));
      const boundary = context.boundarySnapshot;
      if (boundary.retailerAuthorizationClaimed) findings.push(finding("retailer_authorization_invented", "Retail presence must not become retailer authorization or endorsement.", "candidateContext.boundarySnapshot.retailerAuthorizationClaimed", candidate.id));
      if (boundary.unsupportedCapabilityIntroduced) findings.push(finding("unsupported_capability_introduced", "Unsupported Goshsha capabilities cannot enter SALES intake.", "candidateContext.boundarySnapshot.unsupportedCapabilityIntroduced", candidate.id));

      if (boundary.rightsStatus === "explicitly_supported") {
        if (boundary.rightsEvidenceIds.length === 0 || boundary.rightsEvidenceIds.some((id) => !evidenceIds.has(id))) {
          findings.push(finding("rights_evidence_missing", "Explicit content-rights status requires existing evidence references.", "candidateContext.boundarySnapshot.rightsEvidenceIds", candidate.id));
        }
      } else if (boundary.rightsEvidenceIds.length > 0) {
        findings.push(finding("rights_state_inconsistent", "Unknown or not-applicable rights status cannot carry affirmative rights evidence.", "candidateContext.boundarySnapshot.rightsEvidenceIds", candidate.id));
      }
      const affirmativeRights = candidate.claims.filter((claim) => RIGHTS_CLAIM.test(claim.claim) && !CONDITIONAL_OR_UNKNOWN.test(claim.claim));
      if (affirmativeRights.length > 0 && boundary.rightsStatus !== "explicitly_supported") {
        findings.push(finding("affirmative_rights_not_preserved", "Affirmative rights claims require an explicitly supported rights state; Creator activity alone is insufficient.", "candidateContext.boundarySnapshot.rightsStatus", candidate.id));
      }

      const regulatedById = new Map(boundary.regulatedClaims.map((item) => [item.claimId, item]));
      for (const claim of candidate.claims.filter((item) => REGULATED_CLAIM.test(item.claim))) {
        const declaration = regulatedById.get(claim.id);
        if (!declaration) {
          findings.push(finding("regulated_claim_unclassified", `Regulated claim ${claim.id} must remain attributed, supported, hypothetical, unknown, or prohibited.`, "candidateContext.boundarySnapshot.regulatedClaims", candidate.id));
          continue;
        }
        if (!claimIds.has(declaration.claimId) || declaration.evidenceIds.some((id) => !evidenceIds.has(id))) {
          findings.push(finding("regulated_claim_reference_invalid", `Regulated claim ${claim.id} has invalid evidence linkage.`, "candidateContext.boundarySnapshot.regulatedClaims", candidate.id));
        }
        if (declaration.classification === "attributed_brand_claim" && (!declaration.attribution?.trim() || declaration.evidenceIds.length === 0)) {
          findings.push(finding("brand_claim_attribution_missing", `Attributed Brand claim ${claim.id} requires attribution and evidence.`, "candidateContext.boundarySnapshot.regulatedClaims", candidate.id));
        }
        if (declaration.classification === "authoritative_fact" && declaration.evidenceIds.length === 0) {
          findings.push(finding("authoritative_claim_evidence_missing", `Authoritative claim ${claim.id} requires exact supporting evidence.`, "candidateContext.boundarySnapshot.regulatedClaims", candidate.id));
        }
      }
    }
  }

  if (!candidate || !context || !rescored || findings.some((item) => item.severity === "error")) {
    return { status: "validation_failed", findings, envelope: null, summaryMarkdown: "# SALES-01 Intake\n\nValidation failed. No SALES workspace was created.\n" };
  }

  const candidateSha256 = sha256Canonical(candidate);
  const createdAt = params.approvedAt;
  const envelopeWithoutHash: GrowthSalesHandoffEnvelopeV1 = {
    schemaVersion: "growth-sales-handoff-v1",
    envelope: {
      id: `sales-intake-${candidateSha256.slice(0, 16)}`,
      createdAt,
      canonicalizationVersion: "growth-sales-canonical-json-v1",
      payloadSha256: "",
    },
    source: {
      growthRunId: run!.run.id,
      growthRunRequestedAt: run!.run.requestedAt,
      growthAsOfDate: run!.run.asOfDate,
      growthRunStatus: "valid",
      growthAuthority: "founder_supervised_preview_only",
      growthPersistence: false,
      growthExternalCommunication: false,
      growthContract: run!.contract,
      providerProjection: exported!.providerProjection,
    },
    candidate: {
      candidateId: candidate.id,
      candidateVersion: "growth-candidate-v1",
      candidateSha256,
      candidateIndex,
      completeCandidate: candidate,
    },
    qualification: {
      status: "valid",
      selectionStatus: "qualified",
      score: candidate.computed.finalScore,
      scoreBreakdown: candidate.scores,
      deductions: candidate.deductions || {},
      caps: candidate.caps || [],
      band: candidate.computed.band,
      confidence: candidate.confidence,
      founderStagePursuitFeasibility: candidate.founderStagePursuitFeasibility,
      validationFindings: run!.findings,
    },
    opportunity: {
      brand: candidate.brand,
      productOrEvent: candidate.productOrEvent,
      trigger: candidate.trigger,
      triggerDate: context.triggerDate,
      whyNow: candidate.whyNow,
      goshshaWedge: candidate.goshshaWedge,
      retailerAssessment: candidate.retailerAssessment,
      recommendedOffering: candidate.recommendedOffering,
      freeFirst: candidate.freeFirst,
      physicalScanExperience: context.physicalScanExperience,
      fastestRevenuePath: candidate.fastestRevenuePath,
      revenuePathRationale: candidate.revenuePathRationale,
      commercialHypothesis: candidate.commercialHypothesis,
      handoffRecommendation: candidate.handoff,
    },
    evidence: {
      items: candidate.evidence,
      materialClaims: candidate.claims,
      knownUnknowns: candidate.knownUnknowns,
    },
    boundarySnapshot: context.boundarySnapshot,
    founderApproval: {
      approved: true,
      approvedByUid: params.approvedByUid,
      approvedAt: createdAt,
      scope: "sales_preparation_only",
      candidateId: candidate.id,
      candidateSha256,
      externalActionAuthorized: false,
      persistenceAuthorized: false,
    },
    salesContract: params.salesContract,
    authority: {
      salesPreparationAuthorized: true,
      externalActionAuthorized: false,
      contactResearchPerformed: false,
      messageGenerated: false,
      crmWriteAuthorized: false,
      revenueInvocationAuthorized: false,
      closerInvocationAuthorized: false,
      persistence: false,
    },
  };
  const envelope = {
    ...envelopeWithoutHash,
    envelope: { ...envelopeWithoutHash.envelope, payloadSha256: sha256Canonical(envelopeWithoutHash) },
  };
  return { status: "valid", findings, envelope: deepFreeze(envelope), summaryMarkdown: "" };
}
