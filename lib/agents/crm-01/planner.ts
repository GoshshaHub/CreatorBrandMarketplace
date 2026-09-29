import type { CrmSalesIngestionV1 } from "../sales-01/crm-export";
import { crmSha256, crmStableId } from "./canonical";
import { commercialOfferIdForSalesSelection } from "./commercial-offers";
import { buildPlaybookInfrastructureOperations, buildSalesPlaybookArtifact, salesPlaybookReferencePath } from "./sales-playbook-artifact";
import type { CrmDncEvaluation, CrmEntityType, CrmIngestionPlan, CrmPlanOperation, CrmSnapshot, CrmStage, CrmStoredRecord } from "./types";

const PATHS: Record<CrmEntityType, string> = { account: "accounts", contact: "contacts", growthOpportunity: "growthOpportunities", salesPursuit: "salesPursuits", interaction: "interactions", decision: "decisions", milestone: "milestones", attentionItem: "attentionItems" };

function httpUrl(value: string | null): URL | null { try { const url = value ? new URL(value) : null; return url && /^https?:$/.test(url.protocol) ? url : null; } catch { return null; } }
function normalizedName(value: string) { return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim(); }
function path(entityType: CrmEntityType, id: string) { return `crm/${PATHS[entityType]}/records/${id}`; }
function record(entityType: CrmEntityType, id: string, data: Record<string, unknown>, provenance: CrmStoredRecord["provenance"], artifactSha256: string, at: string, prior?: CrmStoredRecord): CrmStoredRecord {
  const revision = prior ? prior.revision + 1 : 1;
  return { id, entityType, revision, createdAt: prior?.createdAt ?? at, updatedAt: at, data, provenance: [...new Set([...(prior?.provenance ?? []), ...provenance])], history: [...(prior?.history ?? []), { revision, event: prior ? "sales_ingestion_updated" : "sales_ingestion_created", artifactSha256, at }] };
}

export function evaluateDnc(input: { account?: "active" | "inactive" | "unknown" | "conflicting"; contact?: "active" | "inactive" | "unknown" | "conflicting"; channel?: "suppressed" | "allowed" | "unknown" | "conflicting" }): CrmDncEvaluation {
  if (input.account === "active" || input.contact === "active" || input.channel === "suppressed") return "blocked";
  if ([input.account, input.contact, input.channel].some((v) => !v || v === "unknown" || v === "conflicting")) return "review_required";
  return "allowed";
}

export function isLegalPipelineTransition(from: string, to: string): boolean {
  const order = ["Growth Qualified", "Sales Prepared", "Founder Review", "Outreach Approved", "Contacted", "Engaged", "Free First Live", "Scan Verified", "Paid Customer", "Expansion/Recurring"];
  return order.indexOf(to) >= 0 && order.indexOf(from) >= 0 && order.indexOf(to) <= order.indexOf(from) + 1;
}

export function buildCrmIngestionPlan(params: { artifact: CrmSalesIngestionV1; snapshot: CrmSnapshot; mappings?: Record<string, string>; crmContractSha256: string; at: string }): CrmIngestionPlan {
  const { artifact, snapshot, crmContractSha256, at } = params;
  const mappings = { ...(params.mappings ?? {}) };
  const playbook = artifact.source.acceptedSalesPlaybook;
  const growth = artifact.source.phase1AEnvelope;
  const accountSource = `account:${playbook.crmReadyPacket.account}`;
  const officialRoute = playbook.contacts.map((c) => c.contactRoute).find((r) => r.type === "general_company" && httpUrl(r.value));
  const accountStrongKey = officialRoute?.value ? `account:domain:${httpUrl(officialRoute.value)!.hostname.toLowerCase().replace(/^www\./, "")}` : null;
  const mappedAccount = mappings[accountSource];
  const accountId = mappedAccount ?? (accountStrongKey && snapshot.identityKeys[accountStrongKey]) ?? crmStableId("acct", { artifact: artifact.artifactSha256, name: playbook.crmReadyPacket.account });
  const possibleMatches = !mappedAccount && !accountStrongKey ? snapshot.possibleAccountMatches.filter((m) => normalizedName(m.displayName) === normalizedName(playbook.crmReadyPacket.account)).map((m) => ({ sourceId: accountSource, candidateId: m.id, reason: "Similar Account name only; explicit Founder mapping required." })) : [];
  const matches = accountStrongKey && snapshot.identityKeys[accountStrongKey] ? [{ sourceId: accountSource, canonicalId: accountId, basis: "verified_apex_domain" }] : mappedAccount ? [{ sourceId: accountSource, canonicalId: accountId, basis: "founder_approved_mapping" }] : [];
  const operations: CrmPlanOperation[] = [];
  const add = (entityType: CrmEntityType, id: string, data: Record<string, unknown>, provenance: CrmStoredRecord["provenance"]) => {
    const p = path(entityType, id); const prior = snapshot.records[p];
    operations.push({ kind: prior ? "update" : "create", entityType, path: p, expectedRevision: prior?.revision ?? null, record: record(entityType, id, data, provenance, artifact.artifactSha256, at, prior) });
  };
  add("account", accountId, { displayName: playbook.crmReadyPacket.account, identityKeys: accountStrongKey ? [accountStrongKey] : [], dnc: "unknown", dncEvaluation: "review_required" }, ["sales_public_evidence", "unknown"]);
  const contactIds: string[] = [];
  for (const contact of playbook.contacts) {
    const sourceId = `contact:${contact.id}`;
    const route = contact.contactRoute.type === "public_professional_profile" || contact.contactRoute.type === "direct_public_business" ? httpUrl(contact.contactRoute.value) : null;
    const strongKey = route ? `contact:route:${route.toString()}` : null;
    const id = mappings[sourceId] ?? (strongKey && snapshot.identityKeys[strongKey]) ?? crmStableId("contact", { artifact: artifact.artifactSha256, sourceId });
    contactIds.push(id);
    if (strongKey && snapshot.identityKeys[strongKey]) matches.push({ sourceId, canonicalId: id, basis: "exact_verified_professional_route" });
    if (!strongKey && !mappings[sourceId]) possibleMatches.push(...snapshot.possibleContactMatches.filter((x) => x.accountId === accountId && normalizedName(x.name) === normalizedName(contact.name)).map((x) => ({ sourceId, candidateId: x.id, reason: "Name/company/role is not an automatic identity key." })));
    add("contact", id, { accountId, sourceContactId: contact.id, name: contact.name, currentTitle: contact.currentTitle, identityEvidenceIds: contact.identityEvidenceIds, currentRoleEvidenceIds: contact.currentRoleEvidenceIds, stakeholderFunction: contact.stakeholderFunction, problemOwnership: contact.problemOwnership, functionalRelevance: contact.functionalRelevance, functionalRelevanceClassification: contact.functionalRelevanceClassification, confidence: contact.confidence, freshness: contact.freshness, conflictingEvidenceIds: contact.conflictingEvidenceIds, strategicRoles: contact.strategicRoles, strategicRoleRationale: contact.strategicRoleRationale, recommendedAsBestFirstContact: playbook.contactSelection.bestFirstContactId === contact.id, buyingAuthority: contact.buyingAuthority, buyingAuthorityEvidenceIds: contact.buyingAuthorityEvidenceIds, contactRoute: contact.contactRoute, evidenceIds: contact.evidenceIds, identityKeys: strongKey ? [strongKey] : [], dnc: "unknown", dncEvaluation: "review_required" }, ["sales_public_evidence", "sales_strategic_inference", "unknown"]);
  }
  const opportunityId = crmStableId("growth", { candidateSha256: growth.candidate.candidateSha256, envelopeSha256: growth.envelope.payloadSha256 });
  const pursuitId = crmStableId("pursuit", { accountId, opportunityId });
  const decision = playbook.salesPursuitDecision;
  const stage: CrmStage = decision === "Pursue Now" ? "Founder Review" : "Sales Prepared";
  const disposition: CrmIngestionPlan["disposition"] = decision === "Pursue Now" ? "Active" : decision === "Do Not Pursue" ? "Not Pursued" : "Nurture / Revisit";
  add("growthOpportunity", opportunityId, { accountId, candidateSnapshot: growth.candidate, qualificationSnapshot: growth.qualification, evidenceSnapshot: growth.evidence, sourceEnvelopeId: growth.envelope.id, sourceEnvelopeSha256: growth.envelope.payloadSha256, immutable: true }, ["growth_derived_evidence"]);
  add("salesPursuit", pursuitId, { accountId, opportunityId, contactIds, stage, disposition, salesPursuitDecision: decision, rationale: playbook.salesPursuitRationale, selectedEntryOfferId: commercialOfferIdForSalesSelection(playbook.opportunityStrategy.selectedEntryOffer), selectedEntryOfferSourceValue: playbook.opportunityStrategy.selectedEntryOffer, contactSelection: playbook.contactSelection, unknowns: playbook.inheritedUnknowns, rights: playbook.rights, retailerIndependence: playbook.retailerIndependence, nextAction: playbook.crmReadyPacket.nextAction, buyingAuthority: "unknown", dncEvaluation: "review_required", salesSource: { acceptedSalesArtifactSha256: artifact.artifactSha256, playbookSchemaVersion: playbook.schemaVersion, salesContractVersion: artifact.source.salesContract.version, salesContractSha256: artifact.source.salesContract.sha256, providerProjectionVersion: artifact.source.salesProviderProjection.version, providerProjectionSha256: artifact.source.salesProviderProjection.sha256 } }, ["sales_strategic_inference", "unknown"]);
  add("interaction", crmStableId("interaction", { artifact: artifact.artifactSha256, kind: "draft" }), { accountId, pursuitId, type: "draft_prepared", status: "draft_not_sent", outreach: playbook.outreach, contacted: false }, ["sales_strategic_inference"]);
  add("decision", crmStableId("decision", { artifact: artifact.artifactSha256, kind: "ingestion" }), { accountId, pursuitId, type: "founder_crm_ingestion_approval", commercialDecision: decision, doesNotAuthorizeOutreach: true }, ["founder_provided_information", "system_generated_state"]);
  add("milestone", crmStableId("milestone", { artifact: artifact.artifactSha256 }), { accountId, pursuitId, freeFirst: { state: playbook.opportunityStrategy.selectedEntryOffer === "Free First" || playbook.opportunityStrategy.selectedEntryOffer === "Combined" ? "recommended" : "not_recommended", revenueUsd: 0, live: false }, product2: { state: "proposed_path", collectedRevenueUsd: null }, creatorNetwork: { state: "proposed_path", collectedRevenueUsd: null }, commercialTruth: { expectedRevenue: "unknown", committedRevenue: "unknown", collectedRevenue: "unknown", refundedOrReversed: "unknown" } }, ["sales_strategic_inference", "unknown"]);
  add("attentionItem", crmStableId("attention", { artifact: artifact.artifactSha256 }), { accountId, pursuitId, type: decision === "Pursue Now" ? "condition_alert" : "reminder", reason: decision === "Pursue Now" ? "Founder review is required; outreach is not approved." : "Relationship requires Founder review before any future action.", priority: decision === "Pursue Now" ? "high" : "normal", dueAt: null, owner: "Founder", status: "open", triggeringCondition: "sales_playbook_ingested_without_external_authority" }, ["system_generated_state"]);
  const playbookArtifact = buildSalesPlaybookArtifact({ exportArtifact: artifact, accountId, pursuitId });
  const referencePath = salesPlaybookReferencePath(pursuitId);
  const infrastructureOperations = buildPlaybookInfrastructureOperations({ artifact: playbookArtifact, priorReference: snapshot.sourceArtifactReferences?.[referencePath] ?? null });
  const creates = operations.filter((op) => op.kind === "create"); const updates = operations.filter((op) => op.kind === "update");
  const expectedRevisions = Object.fromEntries([...operations.map((op) => [op.path, op.expectedRevision] as const), ...infrastructureOperations.map((op) => [op.path, op.expectedRevision] as const)]);
  const body = { schemaVersion: "crm-ingestion-plan-v1" as const, artifactSha256: artifact.artifactSha256, crmContractSha256, mappings, creates, updates, infrastructureOperations, matches, possibleMatches, conflicts: [] as string[], expectedRevisions, stage, disposition, unknowns: playbook.inheritedUnknowns.map((x) => x.originalText), dncEvaluation: evaluateDnc({ account: "unknown", contact: "unknown", channel: "unknown" }) };
  return { ...body, planSha256: crmSha256(body) };
}
