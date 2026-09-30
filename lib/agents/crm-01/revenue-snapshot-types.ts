export type RevenueSnapshotEvidenceRef = { id: string; classification: string; source: string | null; statement: string | null; observedAt: string | null; evidenceUrl: string | null };
export type RevenueSnapshotRecordBinding = { recordPath: string; entityType: string; recordId: string; revision: number; recordSha256: string; updatedAt: string };
export type RevenueSnapshotUnknown = { id: string; statement: string; status: "unresolved" | "resolved" | "conflicting"; source: string; resolutionEvidenceIds: string[] };

export type CrmRevenueSnapshotV1 = {
  schemaVersion: "crm-revenue-snapshot-v1";
  generatedAt: string;
  generatedByUid: string;
  crmContract: { version: "V1.1"; sha256: string };
  offerCatalog: { version: "goshsha-commercial-offers-v1"; sha256: string; offers: Array<{ id: string; priceUsd: number; revenueEligible: boolean }> };
  snapshotIdentity: { snapshotId: string; snapshotSha256: string; canonicalizationVersion: "crm-revenue-canonical-json-v1"; accountId: string; pursuitId: string; completeness: "complete" | "incomplete"; incompletenessReasons: string[] };
  revisionBinding: { records: RevenueSnapshotRecordBinding[]; revisionSetSha256: string; latestRecordedAt: string };
  upstream: {
    growth: { opportunityId: string | null; sourceEnvelopeId: string | null; sourceEnvelopeSha256: string | null; candidateSha256: string | null; score: number | null; band: string | null; confidence: string | null; feasibility: string | null; immutableSnapshotRevision: number | null };
    sales: { pursuitId: string; salesArtifactSha256: string | null; playbookSchemaVersion: string | null; salesContractVersion: string | null; salesContractSha256: string | null; providerProjectionVersion: string | null; providerProjectionSha256: string | null; pursuitDecision: string | null };
  };
  account: { accountId: string; displayName: string | null; relationshipStatus: string | null; provenance: string[]; conflicts: string[] };
  pursuit: { pursuitId: string; opportunityId: string | null; stage: string | null; disposition: string | null; selectedEntryOfferId: string | null; rightsState: { status: string | null; conditionalRequirement: string | null }; retailerDependencyState: { posture: string | null; description: string | null }; canonicalConversation: { conversationId: string; revision: number; revisionSha256: string; participants: Array<{ type: "crm_contact" | "goshsha_internal"; id: string }>; interactionIds: string[]; updatedAt: string } | null; provenance: string[] };
  stakeholders: Array<{ contactId: string; currentTitle: string | null; strategicRoles: string[]; roleClassification: "sales_inference" | "unavailable"; buyingAuthority: "supported" | "unknown"; buyingAuthorityEvidenceIds: string[]; freshness: string | null; conflicts: string[] }>;
  relationshipSafety: { accountDnc: { state: string; evaluation: string; evidenceIds: string[] }; contactDnc: Array<{ contactId: string; state: string; evaluation: string; evidenceIds: string[] }>; effectiveExecutionState: "blocked" | "review_required" | "eligible_for_separate_authorization" };
  founderDecisions: Array<{ decisionId: string; type: string | null; decision: string | null; effectiveAt: string | null; evidence: RevenueSnapshotEvidenceRef[]; doesNotAuthorizeExternalAction: true }>;
  interactions: Array<{ interactionId: string; contactId: string | null; conversationId: string | null; senderParticipantKey: string | null; recipientParticipantKeys: string[]; participants: Array<{ type: "crm_contact" | "goshsha_internal"; id: string }>; channel: string | null; inReplyToInteractionId: string | null; providerReference: { provider: string; externalMessageId: string | null; externalThreadId: string | null; externalConversationId: string | null; evidenceIds: string[] } | null; orderKey: string | null; type: string | null; occurredAt: string | null; exactAttributedStatement: string | null; summary: string | null; classification: "attributed_statement" | "internal_record" | "unknown"; evidence: RevenueSnapshotEvidenceRef[] }>;
  commercialEvidence: {
    freeFirst: { offerId: "free-first-irl-campaign"; catalogVersion: "goshsha-commercial-offers-v1"; catalogSha256: string; priceUsd: 0; revenueEligible: false; acceptance: "supported" | "unknown"; publication: "supported" | "unknown"; physicalScan: "supported" | "unknown" };
    offerEvents: { availability: "unavailable"; items: [] };
    objections: { availability: "unavailable"; items: [] };
    commitments: { availability: "unavailable"; items: [] };
    paymentReferences: { availability: "unavailable"; items: [] };
    subscriptionReferences: { availability: "unavailable"; items: [] };
    refundReversalState: "unknown";
    milestones: Array<{ milestoneId: string; type: string | null; occurredAt: string | null; summary: string | null; verification: "verified" | "pending" | "unsupported"; productionReference: { type: string; id: string; status: string } | null; evidence: RevenueSnapshotEvidenceRef[] }>;
  };
  nextAction: { actionId: string | null; description: string | null; owner: string | null; status: string | null; dueAt: string | null; timingBasis: string | null; approvalRequired: boolean; executionAuthorized: false; evidenceIds: string[] } | null;
  attentionItems: Array<{ attentionItemId: string; type: string | null; reason: string | null; priority: string | null; status: string | null; dueAt: string | null; triggeringCondition: string | null; evidence: RevenueSnapshotEvidenceRef[] }>;
  unknowns: RevenueSnapshotUnknown[];
  provenance: { evidence: RevenueSnapshotEvidenceRef[]; sourceArtifacts: Array<{ type: string; version: string | null; sha256: string | null }>; conflicts: string[] };
  freshness: { generatedAt: string; oldestMaterialEvidenceAt: string | null; newestMaterialEvidenceAt: string | null; staleFields: string[]; unknownFreshnessFields: string[] };
  authority: { crmMutationAuthorized: false; revenueInvocationAuthorized: false; closerInvocationAuthorized: false; externalActionAuthorized: false; paymentActionAuthorized: false };
};

export type CrmRevenueSnapshotResult = { outcome: "complete" | "incomplete"; snapshot: CrmRevenueSnapshotV1 };
