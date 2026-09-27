import { APPROVED_SALES_CONTRACT_SHA256 } from "../sales-01/contract";
import { APPROVED_SALES_PROVIDER_INTELLIGENCE_SHA256, SALES_PROVIDER_INTELLIGENCE_VERSION } from "../sales-01/provider-intelligence-contract";
import { verifyCrmSalesIngestionExport, type CrmSalesIngestionV1 } from "../sales-01/crm-export";
import { verifySalesEnvelopeIntegrity } from "../sales-01/validation";

export const MAX_CRM_INGESTION_BYTES = 1_500_000;

export class CrmValidationError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.name = "CrmValidationError"; this.code = code; }
}

function assert(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new CrmValidationError(code, message);
}

export function validateCrmSalesExport(value: unknown): CrmSalesIngestionV1 {
  assert(value && typeof value === "object", "invalid_export", "A CRM SALES export is required.");
  const artifact = value as CrmSalesIngestionV1;
  assert(artifact.schemaVersion === "crm-sales-ingestion-v1", "invalid_export", "Unsupported CRM export version.");
  assert(artifact.canonicalizationVersion === "crm-sales-canonical-json-v1", "invalid_export", "Unsupported canonicalization version.");
  assert(verifyCrmSalesIngestionExport(artifact), "artifact_integrity_failed", "The CRM export hash does not match its contents.");
  assert(artifact.authority?.crmWriteAuthorized === false && artifact.authority.persistenceAuthorized === false && artifact.authority.downstreamInvocationAuthorized === false && artifact.authority.externalActionAuthorized === false, "authority_expansion", "The SALES export must remain nonauthorizing.");
  assert(artifact.source.salesContract?.version === "V1.1" && artifact.source.salesContract.sha256 === APPROVED_SALES_CONTRACT_SHA256, "sales_contract_mismatch", "The SALES contract identity is not approved.");
  assert(artifact.source.salesProviderProjection?.version === SALES_PROVIDER_INTELLIGENCE_VERSION && artifact.source.salesProviderProjection.sha256 === APPROVED_SALES_PROVIDER_INTELLIGENCE_SHA256, "sales_projection_mismatch", "The SALES provider projection identity is not approved.");
  assert(verifySalesEnvelopeIntegrity(artifact.source.phase1AEnvelope), "growth_envelope_integrity_failed", "The immutable GROWTH/SALES envelope failed integrity validation.");
  assert(artifact.source.acceptedSalesPlaybook?.schemaVersion === "sales-playbook-v1", "invalid_playbook", "An accepted Sales Playbook is required.");
  assert(artifact.source.acceptedSalesPlaybook.crmReadyPacket?.schemaVersion === "sales-crm-ready-v1", "invalid_crm_packet", "A CRM-ready packet is required.");
  assert(JSON.stringify(artifact.source.acceptedSalesPlaybook.crmReadyPacket) === JSON.stringify(artifact.source.salesCrmReadyPacket), "crm_packet_mismatch", "The nested CRM-ready packet does not match the accepted playbook.");
  assert(artifact.source.providerExecution?.outcome === "accepted", "provider_result_not_accepted", "Only a deterministically accepted SALES result may be ingested.");
  return artifact;
}
