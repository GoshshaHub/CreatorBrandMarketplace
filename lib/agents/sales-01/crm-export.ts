import { canonicalJson, sha256Canonical } from "./canonical";
import type { SalesResearchResult } from "./research-types";
import type { GrowthSalesHandoffEnvelopeV1 } from "./types";

export const CRM_SALES_INGESTION_VERSION = "crm-sales-ingestion-v1" as const;
export const CRM_SALES_CANONICALIZATION_VERSION = "crm-sales-canonical-json-v1" as const;

export type CrmSalesIngestionV1 = {
  schemaVersion: typeof CRM_SALES_INGESTION_VERSION;
  canonicalizationVersion: typeof CRM_SALES_CANONICALIZATION_VERSION;
  source: {
    phase1AEnvelope: GrowthSalesHandoffEnvelopeV1;
    acceptedSalesPlaybook: SalesResearchResult["proposal"]["playbook"];
    salesCrmReadyPacket: SalesResearchResult["proposal"]["playbook"]["crmReadyPacket"];
    salesContract: SalesResearchResult["contract"];
    salesProviderProjection: SalesResearchResult["providerProjection"];
    providerExecution: SalesResearchResult["proposal"]["execution"];
  };
  authority: {
    crmWriteAuthorized: false;
    persistenceAuthorized: false;
    downstreamInvocationAuthorized: false;
    externalActionAuthorized: false;
  };
  artifactSha256: string;
};

type ExportBody = Omit<CrmSalesIngestionV1, "artifactSha256">;

export function buildCrmSalesIngestionExport(result: SalesResearchResult): CrmSalesIngestionV1 {
  if (result.outcome !== "accepted") throw new Error("Only an accepted SALES result may be exported for CRM.");
  const body: ExportBody = {
    schemaVersion: CRM_SALES_INGESTION_VERSION,
    canonicalizationVersion: CRM_SALES_CANONICALIZATION_VERSION,
    source: {
      phase1AEnvelope: result.envelope,
      acceptedSalesPlaybook: result.proposal.playbook,
      salesCrmReadyPacket: result.proposal.playbook.crmReadyPacket,
      salesContract: result.contract,
      salesProviderProjection: result.providerProjection,
      providerExecution: result.proposal.execution,
    },
    authority: {
      crmWriteAuthorized: false,
      persistenceAuthorized: false,
      downstreamInvocationAuthorized: false,
      externalActionAuthorized: false,
    },
  };
  return Object.freeze({ ...body, artifactSha256: sha256Canonical(body) });
}

export function verifyCrmSalesIngestionExport(value: CrmSalesIngestionV1): boolean {
  const { artifactSha256, ...body } = value;
  return canonicalJson(body).length > 0 && sha256Canonical(body) === artifactSha256;
}
