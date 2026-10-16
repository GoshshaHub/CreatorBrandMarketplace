import { createHash } from "crypto";

import {
  APPROVED_GROWTH_PROVIDER_PROJECTION_SHA256,
  GROWTH_PROVIDER_RESEARCH_PROJECTION_VERSION,
  PAIRED_FROZEN_GROWTH_CONTRACT_SHA256,
} from "../growth-01/provider-research-contract";
import type { GrowthSalesExportV1, GrowthSourceCompatibility } from "./types";
import { canonicalJson, sha256Canonical } from "./canonical";

export const SALES_GROWTH_INTAKE_POLICY_VERSION = "sales-01-growth-handoff-intake-policy-v1" as const;
export const SALES_GROWTH_INTAKE_POLICY_BODY = `Current GROWTH V1.1 exports must pass current validation and, when provider research is present, use the paired growth-01-provider-research-v2.2 projection; the existing provider-free deterministic export path remains supported. The one preserved historical Cymbiotika GROWTH V1 export may be admitted only when its complete canonical content and exact V1 contract plus growth-01-provider-research-v2.1 identity match the reviewed allowlist. Its raw-file SHA is retained only as the identity of the separately reviewed source file; it is not represented as a server-computed hash of submitted HTTP bytes. No archived historical validator is claimed to run. Historical score, band, deductions, caps, evidence, provenance, and identities remain unchanged, while current SALES prospecting eligibility and safety checks are rerun. Eligibility requires an originally valid run, a qualified SALES-01 handoff, and an unchanged score of at least 65. Ordinary historical rights uncertainty and its preserved deduction do not independently disqualify prospecting. Newly issued envelopes use growth-sales-handoff-v1.1 with required compatibility metadata; historical growth-sales-handoff-v1 envelopes remain readable only without compatibility metadata and cannot acquire compatibility authority. No compatibility result grants persistence, communication, downstream execution, or current GROWTH status.`;
export const SALES_GROWTH_INTAKE_POLICY_SHA256 = createHash("sha256").update(SALES_GROWTH_INTAKE_POLICY_BODY).digest("hex");
export const APPROVED_SALES_GROWTH_INTAKE_POLICY_SHA256 = "61a110b2680a8436ac1836ed6040c30e1ba1861aaf4c385a828a15196f8aa9c8" as const;

export const LEGACY_GROWTH_V1_CONTRACT_SHA256 = "618b895eb97479db83edc668a32bc4db93a222429b27e2a8f6cbadc2bbb7e860" as const;
export const LEGACY_GROWTH_PROVIDER_PROJECTION_VERSION = "growth-01-provider-research-v2.1" as const;
export const LEGACY_GROWTH_PROVIDER_PROJECTION_SHA256 = "97fc50693bfb4b99c10642042512d91b27885525ebc373c29ff06990b79d0280" as const;
export const PRESERVED_CYMBIOTIKA_GROWTH_HANDOFF_SHA256 = "8cbbc88796d080e1201ff915c13a8a131128ee739a718241f8a330edc709d611" as const;
export const PRESERVED_CYMBIOTIKA_GROWTH_HANDOFF_CANONICAL_SHA256 = "c1e8602d3e9ca1d1f72172320c15d1b77e29d4fbfccea2b8f3c392776bfe0c0d" as const;
export const CURRENT_SALES_PROSPECTING_SCORE_THRESHOLD = 65 as const;

export function meetsCurrentSalesProspectingScore(score: number): boolean {
  return Number.isFinite(score) && score >= CURRENT_SALES_PROSPECTING_SCORE_THRESHOLD;
}

export class GrowthHandoffCompatibilityError extends Error {
  code: "intake_policy_drift" | "source_identity_mismatch" | "historical_artifact_mismatch";
  constructor(code: "intake_policy_drift" | "source_identity_mismatch" | "historical_artifact_mismatch", message: string) {
    super(message);
    this.name = "GrowthHandoffCompatibilityError";
    this.code = code;
  }
}

function currentPair(exported: GrowthSalesExportV1): boolean {
  const contract = exported.validatedRun?.contract;
  const projection = exported.providerProjection;
  const projectionValid = projection === null || (projection?.version === GROWTH_PROVIDER_RESEARCH_PROJECTION_VERSION
    && projection.sha256 === APPROVED_GROWTH_PROVIDER_PROJECTION_SHA256
    && projection.pairedFrozenContractVersion === "V1.1"
    && projection.pairedFrozenContractSha256 === PAIRED_FROZEN_GROWTH_CONTRACT_SHA256);
  return contract?.name === "GROWTH-01"
    && contract.version === "V1.1"
    && contract.path === "agents/growth-01/AGENT.md"
    && contract.sha256 === PAIRED_FROZEN_GROWTH_CONTRACT_SHA256
    && projectionValid;
}

function historicalPair(exported: GrowthSalesExportV1): boolean {
  const contract = exported.validatedRun?.contract;
  // Historical artifacts are decoded before this compatibility boundary. Treat
  // their identity fields as data here rather than widening the current-only
  // TypeScript literals used by newly produced GROWTH exports.
  const historicalContract = contract as undefined | {
    name?: string;
    version?: string;
    path?: string;
    sha256?: string;
  };
  const projection = exported.providerProjection as null | {
    version?: string;
    sha256?: string;
    pairedFrozenContractVersion?: string;
    pairedFrozenContractSha256?: string;
  };
  return historicalContract?.name === "GROWTH-01"
    && historicalContract.version === "V1"
    && historicalContract.path === "agents/growth-01/AGENT.md"
    && historicalContract.sha256 === LEGACY_GROWTH_V1_CONTRACT_SHA256
    && projection?.version === LEGACY_GROWTH_PROVIDER_PROJECTION_VERSION
    && projection.sha256 === LEGACY_GROWTH_PROVIDER_PROJECTION_SHA256
    && projection.pairedFrozenContractVersion === "V1"
    && projection.pairedFrozenContractSha256 === LEGACY_GROWTH_V1_CONTRACT_SHA256;
}

export function classifyGrowthHandoff(exported: GrowthSalesExportV1): GrowthSourceCompatibility {
  if (SALES_GROWTH_INTAKE_POLICY_SHA256 !== APPROVED_SALES_GROWTH_INTAKE_POLICY_SHA256) {
    throw new GrowthHandoffCompatibilityError("intake_policy_drift", "The SALES GROWTH handoff intake policy failed its integrity check.");
  }
  const canonicalSha256 = sha256Canonical(exported);
  if (currentPair(exported)) {
    return {
      policyVersion: SALES_GROWTH_INTAKE_POLICY_VERSION,
      policySha256: SALES_GROWTH_INTAKE_POLICY_SHA256,
      sourceKind: "current",
      reviewedSourceFileIdentitySha256: null,
      submittedCanonicalSha256: canonicalSha256,
      historicalSemanticsPreserved: false,
      currentProspectingEligibilityEvaluated: true,
    };
  }
  if (!historicalPair(exported)) {
    throw new GrowthHandoffCompatibilityError("source_identity_mismatch", "The GROWTH contract and provider projection are not an exact supported pair.");
  }
  if (canonicalSha256 !== PRESERVED_CYMBIOTIKA_GROWTH_HANDOFF_CANONICAL_SHA256) {
    throw new GrowthHandoffCompatibilityError("historical_artifact_mismatch", "The historical GROWTH export does not match the exact preserved allowlisted artifact.");
  }
  return {
    policyVersion: SALES_GROWTH_INTAKE_POLICY_VERSION,
    policySha256: SALES_GROWTH_INTAKE_POLICY_SHA256,
    sourceKind: "historical_allowlisted",
    reviewedSourceFileIdentitySha256: PRESERVED_CYMBIOTIKA_GROWTH_HANDOFF_SHA256,
    submittedCanonicalSha256: canonicalSha256,
    historicalSemanticsPreserved: true,
    currentProspectingEligibilityEvaluated: true,
  };
}

export function verifyGrowthSourceCompatibility(value: GrowthSourceCompatibility): boolean {
  const base = value.policyVersion === SALES_GROWTH_INTAKE_POLICY_VERSION
    && value.policySha256 === APPROVED_SALES_GROWTH_INTAKE_POLICY_SHA256
    && /^[a-f0-9]{64}$/.test(value.submittedCanonicalSha256)
    && value.currentProspectingEligibilityEvaluated === true
    && canonicalJson(value).length > 0;
  if (!base) return false;
  if (value.sourceKind === "current") return value.reviewedSourceFileIdentitySha256 === null && value.historicalSemanticsPreserved === false;
  return value.sourceKind === "historical_allowlisted"
    && value.reviewedSourceFileIdentitySha256 === PRESERVED_CYMBIOTIKA_GROWTH_HANDOFF_SHA256
    && value.submittedCanonicalSha256 === PRESERVED_CYMBIOTIKA_GROWTH_HANDOFF_CANONICAL_SHA256
    && value.historicalSemanticsPreserved === true;
}
