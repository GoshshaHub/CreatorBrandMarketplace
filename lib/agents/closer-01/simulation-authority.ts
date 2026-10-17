import type { CrmAccountDetailReadModel } from "../crm-01/read-types";
import type { CrmRevenueSnapshotV1 } from "../crm-01/revenue-snapshot-types";
import type { CurrentSalesPlaybookProjectionV1 } from "../crm-01/sales-playbook-artifact";
import { getCommercialOfferCatalog } from "../crm-01/commercial-offers";
import { assertCloserLocalDemoEnvironment } from "./local-demo-guard";
import { revenueSha256, revenueStableId } from "../revenue-01/canonical";
import type { ApprovedActionPackageV1 } from "../revenue-01/approved-action";
import type { ConversationIntelligencePacketV1 } from "./types";

export const CLOSER_SIMULATION_AUTHORITY_SCHEMA = "closer-01-founder-simulation-authority-v1.2" as const;
export const CLOSER_SIMULATION_AUTHORITY_VERSION = "v1.2" as const;
export const CLOSER_SIMULATION_AUTHORITY_CANONICALIZATION = "closer-01-founder-simulation-authority-canonical-json-v1.2" as const;
export const CLOSER_SIMULATION_AUTHORITY_PREVIEW_SCHEMA = "closer-01-founder-simulation-authority-preview-v1" as const;
export const CLOSER_SIMULATION_AUTHORITY_PREVIEW_VERSION = "v1" as const;
export const CLOSER_SIMULATION_AUTHORITY_PREVIEW_CANONICALIZATION = "closer-01-founder-simulation-authority-preview-canonical-json-v1" as const;
export const CLOSER_SIMULATION_CHANNELS = ["email", "linkedin", "sms", "phone", "meeting", "other"] as const;
export const CLOSER_SIMULATION_ACTIONS = ["simulate_objective_aligned_outbound_turn", "simulate_response_to_latest_inbound"] as const;
export type CloserSimulationChannel = typeof CLOSER_SIMULATION_CHANNELS[number];
export type CloserSimulationAction = typeof CLOSER_SIMULATION_ACTIONS[number];

export const CLOSER_SIMULATION_AUTHORITY_CONTRACT = {
  schemaVersion: CLOSER_SIMULATION_AUTHORITY_SCHEMA,
  version: CLOSER_SIMULATION_AUTHORITY_VERSION,
  canonicalizationVersion: CLOSER_SIMULATION_AUTHORITY_CANONICALIZATION,
  state: "prepared_not_executable",
  authorityTier: "tier0_simulation",
  conceptualPermission: "prepare_one_unsent_turn_after_separate_request",
  simulationCountLimit: 1,
  turnCountLimit: 1,
  persistence: "session_only",
  simulationCapabilityEnabled: true,
  providerRequestLimit: 1,
  providerInvocationAuthorizedAfterSeparateRequest: true,
  executionAuthorized: false,
  sendingAuthorized: false,
  externalChannelUseAuthorized: false,
  exactPreviewApprovalRequired: true,
  commercialPositioningBindingRequired: true,
} as const;
export const CLOSER_SIMULATION_AUTHORITY_CONTRACT_SHA256 = revenueSha256(CLOSER_SIMULATION_AUTHORITY_CONTRACT);
export const APPROVED_CLOSER_SIMULATION_AUTHORITY_CONTRACT_SHA256 = "eb48544f608a64c9f17b7add1662095d6302c99c07a69a4d0f9b85f87aea6bdb" as const;

export class CloserSimulationAuthorityError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.name = "CloserSimulationAuthorityError"; this.code = code; }
}

export type CloserSimulationAuthorityV1 = {
  schemaVersion: typeof CLOSER_SIMULATION_AUTHORITY_SCHEMA;
  version: typeof CLOSER_SIMULATION_AUTHORITY_VERSION;
  canonicalizationVersion: typeof CLOSER_SIMULATION_AUTHORITY_CANONICALIZATION;
  contractSha256: string;
  authorityId: string;
  authoritySha256: string;
  state: "PREPARED";
  approvedByUid: string;
  approvedAt: string;
  effectiveAt: string;
  expiresAt: string;
  authorityTier: "tier0_simulation";
  permittedOperations: ["simulate_one_turn"];
  simulationCountLimit: 1;
  turnCountLimit: 1;
  binding: {
    accountId: string;
    pursuitId: string;
    closerPacketId: string;
    closerPacketSha256: string;
    approvedPackageId: string;
    approvedPackageSha256: string;
    revenueObjectiveId: string;
    revenueObjectiveVersion: string;
    revenueObjectiveFamily: string;
    selectedEconomicOutcome: string;
    salesPlaybookArtifactId: string;
    salesPlaybookArtifactSha256: string;
    commercialPositioningVersion: "v1";
    commercialPositioningSha256: string;
    crmRevisionSetSha256: string;
    conversationId: string;
    conversationRevision: number;
    latestInteraction: { state: "present"; interactionId: string; orderKey: string } | { state: "no_prior_interaction" };
    contracts: ConversationIntelligencePacketV1["sourceContracts"];
  };
  selection: { recipientContactId: string; simulationChannelContext: CloserSimulationChannel; simulationAction: CloserSimulationAction; objectiveCompatiblePurpose: string };
  recipientContext: { salesBestFirstContactId: string | null; selectedAsSalesBestFirstContact: boolean; buyingAuthority: "supported" | "unknown"; buyingAuthorityEvidenceIds: string[] };
  claimsEnvelope: { positioning: string; approvedClaims: ConversationIntelligencePacketV1["sales"]["approvedClaims"]; mechanicsQualifications: string[]; audienceObjection: NonNullable<ConversationIntelligencePacketV1["sales"]["audienceObjection"]>; prohibitedClaims: readonly string[]; objections: ConversationIntelligencePacketV1["sales"]["objections"]; escalationBoundaries: string[]; sha256: string };
  offerEnvelope: { selectedOfferId: string; offerCatalogVersion: string; offerCatalogSha256: string; selectedOffer: ReturnType<typeof getCommercialOfferCatalog>["offers"][number]; sha256: string };
  prohibited: ["sending","external_channel_use","crm_mutation","scheduling","payment_action","production_mutation","objective_activation","workforce_delivery","autonomous_continuation","discounts_or_concessions","nonstandard_entitlements","guarantees","unsupported_claims","legal_or_contractual_commitments","custom_engineering","retailer_commitments","rights_exceptions"];
  safety: { dncClear: true; externalChannelUseAuthorized: false; sendingAuthorized: false; crmMutationAuthorized: false; providerInvocationAuthorized: true; providerRequestLimit: 1; schedulingAuthorized: false; paymentActionAuthorized: false; externalActionAuthorized: false; simulationCapabilityEnabled: true; simulationExecutionAuthorized: false };
  lifecycle: { sessionOnly: true; persisted: false; consumed: false; supersession: "any_bound_material_change"; durableRevocation: false };
};

export type CloserSimulationAuthorityPreviewV1 = {
  schemaVersion: typeof CLOSER_SIMULATION_AUTHORITY_PREVIEW_SCHEMA;
  version: typeof CLOSER_SIMULATION_AUTHORITY_PREVIEW_VERSION;
  canonicalizationVersion: typeof CLOSER_SIMULATION_AUTHORITY_PREVIEW_CANONICALIZATION;
  previewId: string;
  previewSha256: string;
  previewedAt: string;
  expiresAt: string;
  status: "AWAITING_EXACT_FOUNDER_APPROVAL";
  proposedAuthority: CloserSimulationAuthorityV1;
  effectAuthority: { simulationCapabilityEnabled: true; providerInvocationAuthorizedAfterSeparateRequest: true; providerRequestLimit: 1; simulationExecutionAuthorized: false; sendingAuthorized: false; externalActionAuthorized: false };
};

const currentContact = (detail: CrmAccountDetailReadModel, contactId: string) => detail.contacts.find(item => item.id === contactId) ?? null;

export function buildFounderSimulationAuthority(params: {
  packet: ConversationIntelligencePacketV1;
  snapshot: CrmRevenueSnapshotV1;
  detail: CrmAccountDetailReadModel;
  playbook: CurrentSalesPlaybookProjectionV1;
  approvedPackage: ApprovedActionPackageV1;
  recipientContactId: string;
  simulationChannelContext: CloserSimulationChannel;
  simulationAction: CloserSimulationAction;
  approvedByUid: string;
  approvedAt: string;
}): CloserSimulationAuthorityV1 {
  if (CLOSER_SIMULATION_AUTHORITY_CONTRACT_SHA256 !== APPROVED_CLOSER_SIMULATION_AUTHORITY_CONTRACT_SHA256) throw new CloserSimulationAuthorityError("authority_contract_drift", "Founder Simulation Authority contract integrity failed.");
  const { packet, snapshot, detail, playbook, approvedPackage: approved } = params;
  if (packet.completeness !== "valid" || packet.readiness !== "ready_to_simulate") throw new CloserSimulationAuthorityError("packet_not_ready", "The authoritative CLOSER packet is not ready for a simulation-authority preview.");
  if (packet.binding.accountId !== snapshot.snapshotIdentity.accountId || packet.binding.pursuitId !== snapshot.snapshotIdentity.pursuitId || approved.binding.accountId !== packet.binding.accountId || approved.binding.pursuitId !== packet.binding.pursuitId) throw new CloserSimulationAuthorityError("scope_mismatch", "Account or Pursuit binding is inconsistent.");
  if (packet.binding.crmRevisionSetSha256 !== snapshot.revisionBinding.revisionSetSha256 || approved.binding.crmRevisionSetSha256 !== snapshot.revisionBinding.revisionSetSha256) throw new CloserSimulationAuthorityError("stale_crm_revision", "CRM revision binding changed.");
  if (packet.revenue.approvedPackageId !== approved.packageId || packet.revenue.approvedPackageSha256 !== approved.packageSha256 || packet.revenue.objectiveId !== approved.identities.freshRecommendationId || packet.revenue.objectiveFamily !== approved.selectedRecommendation.family) throw new CloserSimulationAuthorityError("revenue_binding_mismatch", "REVENUE package or objective binding is inconsistent.");
  if (packet.sales.artifactSha256 !== playbook.artifactSha256 || packet.sales.playbookId !== playbook.artifactId || playbook.superseded) throw new CloserSimulationAuthorityError("sales_playbook_mismatch", "The Sales Playbook is not the current bound artifact.");
  const conversation = snapshot.pursuit.canonicalConversation;
  if (!conversation || packet.binding.conversationThreadId !== conversation.conversationId) throw new CloserSimulationAuthorityError("conversation_binding_mismatch", "Canonical conversation identity is missing or changed.");
  const contact = currentContact(detail, params.recipientContactId), stakeholder = snapshot.stakeholders.find(item => item.contactId === params.recipientContactId);
  if (!contact) throw new CloserSimulationAuthorityError("recipient_missing", "The Founder-selected Contact does not exist.");
  if (contact.accountId !== packet.binding.accountId) throw new CloserSimulationAuthorityError("recipient_account_mismatch", "The Founder-selected Contact does not belong to the Account.");
  if (!conversation.participants.some(item => item.type === "crm_contact" && item.id === params.recipientContactId) || !packet.crm.participants.some(item => item.contactId === params.recipientContactId) || !stakeholder) throw new CloserSimulationAuthorityError("recipient_not_participant", "The Founder-selected Contact is not a current canonical conversation participant.");
  if (contact.conflictingEvidenceIds.length || contact.freshness !== "current" || contact.warnings.some(item => ["conflicting_state","unknown_state"].includes(item.code))) throw new CloserSimulationAuthorityError("recipient_identity_unresolved", "The Founder-selected Contact has conflicting, stale, or unresolved identity state.");
  if (detail.account.dnc.evaluation !== "allowed" || snapshot.relationshipSafety.accountDnc.evaluation !== "allowed") throw new CloserSimulationAuthorityError("account_dnc_blocked", "Account DNC is active or requires review.");
  if (contact.dnc.evaluation !== "allowed") throw new CloserSimulationAuthorityError(contact.dnc.scope === "channel" ? "channel_dnc_blocked" : "contact_dnc_blocked", "Selected Contact or channel DNC is active or requires review.");
  const snapshotContactDnc = snapshot.relationshipSafety.contactDnc.find(item => item.contactId === params.recipientContactId);
  if (!snapshotContactDnc || snapshotContactDnc.evaluation !== "allowed" || snapshot.relationshipSafety.effectiveExecutionState !== "eligible_for_separate_authorization") throw new CloserSimulationAuthorityError("dnc_not_clear", "Canonical DNC state is blocked, unknown, conflicting, or incomplete.");
  if (!CLOSER_SIMULATION_CHANNELS.includes(params.simulationChannelContext)) throw new CloserSimulationAuthorityError("channel_invalid", "Simulation channel context is unsupported.");
  if (!CLOSER_SIMULATION_ACTIONS.includes(params.simulationAction)) throw new CloserSimulationAuthorityError("action_invalid", "Simulation action is unsupported.");
  const interactions = packet.crm.interactions;
  const latest = interactions.at(-1) ?? null;
  if (params.simulationAction === "simulate_response_to_latest_inbound") {
    if (latest?.type !== "inbound_received") throw new CloserSimulationAuthorityError("action_context_mismatch", "A response simulation requires the latest canonical Interaction to be inbound.");
    if (latest.evidenceAuthenticity !== "authentic" || latest.authenticCommercialLearningEligible !== true) {
      if (latest.evidenceAuthenticity !== "synthetic") throw new CloserSimulationAuthorityError("interaction_authenticity_unverified", "A production reply draft requires an explicitly authentic current inbound Interaction; missing or unknown historical authenticity fails closed.");
      try { assertCloserLocalDemoEnvironment(); } catch { throw new CloserSimulationAuthorityError("interaction_authenticity_unverified", "Synthetic interactions may be consumed only by the explicitly guarded isolated local-demo context."); }
    }
  }
  if (!packet.sales.positioningArtifact || !packet.sales.audienceObjection || !packet.sales.mechanicsQualifications.length) throw new CloserSimulationAuthorityError("positioning_binding_missing", "Current commercial-positioning identity, mechanics, and audience objection are required.");
  if (playbook.positioningArtifact?.version !== packet.sales.positioningArtifact.version || playbook.positioningArtifact.sha256 !== packet.sales.positioningArtifact.sha256) throw new CloserSimulationAuthorityError("positioning_binding_mismatch", "The Sales Playbook commercial-positioning identity does not match the CLOSER packet.");
  const claimsBody = { positioning: packet.sales.positioning!, approvedClaims: packet.sales.approvedClaims, mechanicsQualifications: packet.sales.mechanicsQualifications, audienceObjection: packet.sales.audienceObjection, prohibitedClaims: packet.sales.prohibitedClaims, objections: packet.sales.objections, escalationBoundaries: packet.sales.escalationBoundaries };
  const selectedOfferId = snapshot.pursuit.selectedEntryOfferId;
  if (!selectedOfferId) throw new CloserSimulationAuthorityError("offer_missing", "A current selected standard offer is required.");
  const catalog = getCommercialOfferCatalog();
  if (snapshot.offerCatalog.version !== catalog.version || snapshot.offerCatalog.sha256 !== catalog.sha256) throw new CloserSimulationAuthorityError("offer_catalog_mismatch", "The CRM offer catalog binding is not current.");
  const selectedOffer = catalog.offers.find(item => item.id === selectedOfferId);
  if (!selectedOffer) throw new CloserSimulationAuthorityError("offer_missing", "The selected offer is not present in the server-controlled catalog.");
  const offerBody = { selectedOfferId, offerCatalogVersion: catalog.version, offerCatalogSha256: catalog.sha256, selectedOffer };
  const approvedAt = new Date(params.approvedAt);
  if (Number.isNaN(approvedAt.getTime())) throw new CloserSimulationAuthorityError("approval_time_invalid", "Server approval time is invalid.");
  const latestInteraction = latest ? { state: "present" as const, interactionId: latest.interactionId, orderKey: latest.orderKey ?? `${latest.occurredAt ?? "unknown"}|${latest.interactionId}` } : { state: "no_prior_interaction" as const };
  const purpose = params.simulationAction === "simulate_response_to_latest_inbound" ? `Prepare one hypothetical response to the latest inbound Interaction in support of: ${approved.selectedRecommendation.objective}` : `Prepare one hypothetical objective-aligned outbound turn in support of: ${approved.selectedRecommendation.objective}`;
  const body = {
    schemaVersion: CLOSER_SIMULATION_AUTHORITY_SCHEMA, version: CLOSER_SIMULATION_AUTHORITY_VERSION, canonicalizationVersion: CLOSER_SIMULATION_AUTHORITY_CANONICALIZATION, contractSha256: CLOSER_SIMULATION_AUTHORITY_CONTRACT_SHA256,
    state: "PREPARED" as const, approvedByUid: params.approvedByUid, approvedAt: approvedAt.toISOString(), effectiveAt: approvedAt.toISOString(), expiresAt: new Date(approvedAt.getTime() + 15 * 60_000).toISOString(), authorityTier: "tier0_simulation" as const, permittedOperations: ["simulate_one_turn"] as ["simulate_one_turn"], simulationCountLimit: 1 as const, turnCountLimit: 1 as const,
    binding: { accountId: packet.binding.accountId, pursuitId: packet.binding.pursuitId, closerPacketId: packet.packetId, closerPacketSha256: packet.packetSha256, approvedPackageId: approved.packageId, approvedPackageSha256: approved.packageSha256, revenueObjectiveId: approved.identities.freshRecommendationId, revenueObjectiveVersion: approved.identities.recommendationSchemaVersion, revenueObjectiveFamily: approved.selectedRecommendation.family, selectedEconomicOutcome: approved.selectedRecommendation.objective, salesPlaybookArtifactId: playbook.artifactId, salesPlaybookArtifactSha256: playbook.artifactSha256, commercialPositioningVersion: packet.sales.positioningArtifact.version, commercialPositioningSha256: packet.sales.positioningArtifact.sha256, crmRevisionSetSha256: snapshot.revisionBinding.revisionSetSha256, conversationId: conversation.conversationId, conversationRevision: conversation.revision, latestInteraction, contracts: packet.sourceContracts },
    selection: { recipientContactId: params.recipientContactId, simulationChannelContext: params.simulationChannelContext, simulationAction: params.simulationAction, objectiveCompatiblePurpose: purpose },
    recipientContext: { salesBestFirstContactId: playbook.bestFirstContactId, selectedAsSalesBestFirstContact: playbook.bestFirstContactId === params.recipientContactId, buyingAuthority: stakeholder.buyingAuthority, buyingAuthorityEvidenceIds: stakeholder.buyingAuthorityEvidenceIds },
    claimsEnvelope: { ...claimsBody, sha256: revenueSha256(claimsBody) }, offerEnvelope: { ...offerBody, sha256: revenueSha256(offerBody) },
    prohibited: ["sending","external_channel_use","crm_mutation","scheduling","payment_action","production_mutation","objective_activation","workforce_delivery","autonomous_continuation","discounts_or_concessions","nonstandard_entitlements","guarantees","unsupported_claims","legal_or_contractual_commitments","custom_engineering","retailer_commitments","rights_exceptions"] as CloserSimulationAuthorityV1["prohibited"],
    safety: { dncClear: true as const, externalChannelUseAuthorized: false as const, sendingAuthorized: false as const, crmMutationAuthorized: false as const, providerInvocationAuthorized: true as const, providerRequestLimit: 1 as const, schedulingAuthorized: false as const, paymentActionAuthorized: false as const, externalActionAuthorized: false as const, simulationCapabilityEnabled: true as const, simulationExecutionAuthorized: false as const },
    lifecycle: { sessionOnly: true as const, persisted: false as const, consumed: false as const, supersession: "any_bound_material_change" as const, durableRevocation: false as const },
  };
  return { ...body, authorityId: revenueStableId("closersimauth", body), authoritySha256: revenueSha256(body) };
}

export function buildFounderSimulationAuthorityPreview(proposedAuthority: CloserSimulationAuthorityV1): CloserSimulationAuthorityPreviewV1 {
  const body = { schemaVersion: CLOSER_SIMULATION_AUTHORITY_PREVIEW_SCHEMA, version: CLOSER_SIMULATION_AUTHORITY_PREVIEW_VERSION, canonicalizationVersion: CLOSER_SIMULATION_AUTHORITY_PREVIEW_CANONICALIZATION, previewedAt: proposedAuthority.approvedAt, expiresAt: proposedAuthority.expiresAt, status: "AWAITING_EXACT_FOUNDER_APPROVAL" as const, proposedAuthority, effectAuthority: { simulationCapabilityEnabled: true as const, providerInvocationAuthorizedAfterSeparateRequest: true as const, providerRequestLimit: 1 as const, simulationExecutionAuthorized: false as const, sendingAuthorized: false as const, externalActionAuthorized: false as const } };
  return { ...body, previewId: revenueStableId("closersimpreview", body), previewSha256: revenueSha256(body) };
}

export function verifyFounderSimulationAuthorityPreview(params: { preview: CloserSimulationAuthorityPreviewV1; reconstructedAuthority: CloserSimulationAuthorityV1; expectedPreviewId: string; expectedPreviewSha256: string; explicitFounderApproval: boolean; now: string }): void {
  if (!params.explicitFounderApproval) throw new CloserSimulationAuthorityError("founder_approval_missing", "Explicit Founder approval of the exact preview is required.");
  const { previewId, previewSha256, ...body } = params.preview;
  if (revenueSha256(body) !== previewSha256 || revenueStableId("closersimpreview", body) !== previewId || previewId !== params.expectedPreviewId || previewSha256 !== params.expectedPreviewSha256) throw new CloserSimulationAuthorityError("preview_integrity_failed", "The exact Founder authority preview identity is missing or mismatched.");
  if (params.preview.proposedAuthority.authorityId !== params.reconstructedAuthority.authorityId || params.preview.proposedAuthority.authoritySha256 !== params.reconstructedAuthority.authoritySha256) throw new CloserSimulationAuthorityError("preview_stale", "The authoritative scope changed after preview.");
  if (Date.parse(params.now) > Date.parse(params.preview.expiresAt)) throw new CloserSimulationAuthorityError("preview_expired", "The exact Founder authority preview expired.");
}

export function verifyFounderSimulationAuthority(params: { authority: CloserSimulationAuthorityV1; currentPacket: ConversationIntelligencePacketV1; now: string }): void {
  const { authority } = params, { authorityId, authoritySha256, ...body } = authority;
  if (authority.contractSha256 !== CLOSER_SIMULATION_AUTHORITY_CONTRACT_SHA256 || revenueSha256(body) !== authoritySha256 || revenueStableId("closersimauth", body) !== authorityId) throw new CloserSimulationAuthorityError("authority_integrity_failed", "Simulation authority identity or contract is invalid.");
  if (authority.binding.closerPacketId !== params.currentPacket.packetId || authority.binding.closerPacketSha256 !== params.currentPacket.packetSha256) throw new CloserSimulationAuthorityError("authority_stale", "The CLOSER packet changed after authority preparation.");
  if (Date.parse(params.now) < Date.parse(authority.effectiveAt) || Date.parse(params.now) > Date.parse(authority.expiresAt)) throw new CloserSimulationAuthorityError("authority_expired", "Simulation authority is outside its session validity window.");
  if (authority.lifecycle.persisted || authority.lifecycle.consumed || !authority.safety.simulationCapabilityEnabled || !authority.safety.providerInvocationAuthorized || authority.safety.providerRequestLimit !== 1 || authority.safety.simulationExecutionAuthorized || authority.safety.sendingAuthorized || authority.safety.externalActionAuthorized) throw new CloserSimulationAuthorityError("authority_amplification", "Message-preparation authority exceeds the approved one-provider-request, non-sending scope.");
}
