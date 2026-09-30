import { crmSha256, crmStableId } from "./canonical";
import type { CrmConversationInput, CrmConversationParticipant, CrmProviderReference } from "./mutation-types";

export const CRM_CONVERSATION_SCHEMA = "crm-canonical-conversation-v1" as const;
export const CRM_CONVERSATION_VERSION = "v1" as const;
export const CRM_CONVERSATION_CANONICALIZATION = "crm-canonical-conversation-json-v1" as const;

export const CRM_CONVERSATION_CONTRACT = {
  schemaVersion: CRM_CONVERSATION_SCHEMA,
  version: CRM_CONVERSATION_VERSION,
  canonicalizationVersion: CRM_CONVERSATION_CANONICALIZATION,
  identityScope: ["accountId", "pursuitId"],
  providerIndependentIdentity: true,
  requiresExplicitParticipants: true,
  interactionContinuity: "append_only_references",
  communicationAuthority: false,
  externalActionAuthority: false,
} as const;
export const CRM_CONVERSATION_CONTRACT_SHA256 = crmSha256(CRM_CONVERSATION_CONTRACT);
export const APPROVED_CRM_CONVERSATION_CONTRACT_SHA256 = "d8c7b5cd455d4c563922cf24f28974a2a9075b3580100392ec293156fbb2527f" as const;

export type CrmConversationInteractionReference = { interactionId: string; occurredAt: string; orderKey: string };
export type CrmCanonicalConversationV1 = {
  schemaVersion: typeof CRM_CONVERSATION_SCHEMA;
  version: typeof CRM_CONVERSATION_VERSION;
  canonicalizationVersion: typeof CRM_CONVERSATION_CANONICALIZATION;
  contractSha256: string;
  conversationId: string;
  accountId: string;
  pursuitId: string;
  revision: number;
  revisionSha256: string;
  lifecycle: "active";
  origin: { type: "founder_supervised_crm_mutation"; createdAt: string; createdByUid: string };
  participants: CrmConversationParticipant[];
  interactionReferences: CrmConversationInteractionReference[];
  providerReferences: CrmProviderReference[];
  evidenceIds: string[];
  updatedAt: string;
  communicationAuthority: false;
  executionAuthorized: false;
};

export const canonicalConversationId = (accountId: string, pursuitId: string) => crmStableId("conversation", { accountId, pursuitId, scope: "commercial_pursuit" });
export const participantKey = (participant: CrmConversationParticipant) => `${participant.type}:${participant.id}`;
const uniqueBy = <T>(items: T[], key: (item: T) => string) => [...new Map(items.map((item) => [key(item), item])).values()];

export function buildCanonicalConversation(params: { accountId: string; pursuitId: string; input: CrmConversationInput; interactionId: string; occurredAt: string; recordedAt: string; actorUid: string; prior: CrmCanonicalConversationV1 | null }): CrmCanonicalConversationV1 {
  if (CRM_CONVERSATION_CONTRACT_SHA256 !== APPROVED_CRM_CONVERSATION_CONTRACT_SHA256) throw new Error("Canonical conversation contract integrity failed.");
  const conversationId = canonicalConversationId(params.accountId, params.pursuitId);
  if (params.prior) {
    const { revisionSha256, ...priorBody } = params.prior;
    if (params.prior.schemaVersion !== CRM_CONVERSATION_SCHEMA || params.prior.conversationId !== conversationId || params.prior.accountId !== params.accountId || params.prior.pursuitId !== params.pursuitId || crmSha256(priorBody) !== revisionSha256) throw new Error("Canonical conversation state is malformed, stale, or bound to another Account/Pursuit.");
  }
  const participants = uniqueBy([...(params.prior?.participants ?? []), ...params.input.participants], participantKey).sort((a,b)=>participantKey(a).localeCompare(participantKey(b)));
  const interactionReferences = uniqueBy([...(params.prior?.interactionReferences ?? []), { interactionId: params.interactionId, occurredAt: params.occurredAt, orderKey: `${params.occurredAt}|${params.interactionId}` }], (item) => item.interactionId).sort((a,b)=>a.orderKey.localeCompare(b.orderKey));
  const providerReferences = uniqueBy([...(params.prior?.providerReferences ?? []), ...(params.input.providerReference ? [params.input.providerReference] : [])], (item) => crmSha256(item)).sort((a,b)=>crmSha256(a).localeCompare(crmSha256(b)));
  const body = { schemaVersion: CRM_CONVERSATION_SCHEMA, version: CRM_CONVERSATION_VERSION, canonicalizationVersion: CRM_CONVERSATION_CANONICALIZATION, contractSha256: CRM_CONVERSATION_CONTRACT_SHA256, conversationId, accountId: params.accountId, pursuitId: params.pursuitId, revision: (params.prior?.revision ?? 0) + 1, lifecycle: "active" as const, origin: params.prior?.origin ?? { type: "founder_supervised_crm_mutation" as const, createdAt: params.recordedAt, createdByUid: params.actorUid }, participants, interactionReferences, providerReferences, evidenceIds: [...new Set([...(params.prior?.evidenceIds ?? []), ...params.input.evidenceIds])].sort(), updatedAt: params.recordedAt, communicationAuthority: false as const, executionAuthorized: false as const };
  return { ...body, revisionSha256: crmSha256(body) };
}
