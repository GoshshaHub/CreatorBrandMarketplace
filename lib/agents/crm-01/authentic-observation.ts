import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import type { CrmStoredRecord } from "./types";

export const CRM_AUTHENTIC_OBSERVATION_PREVIEW_SCHEMA = "crm-authentic-objection-observation-preview-v1";
export const CRM_AUTHENTIC_OBSERVATION_ASSESSMENT_SCHEMA = "crm-authentic-objection-assessment-v1";

const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const id = (value: string, field: string) => { if (!/^[A-Za-z0-9_-]{1,160}$/.test(value)) throw new Error(`${field}_invalid`); return value; };
const record = (value: unknown, kind: string): CrmStoredRecord => { const row=value as CrmStoredRecord;if(!row||row.recordSchemaVersion!=="crm-record-v1"||row.entityType!==kind||!Number.isInteger(row.revision)||row.revision<1)throw new Error(`${kind}_record_invalid`);return row; };

export type AuthenticObservationSelection = { accountId:string;pursuitId:string;conversationId:string;interactionId:string };
export type AuthenticObservationInterpretation = { closerInterpretation:string;playbookCoverage:"covered"|"unsupported";commerciallyMaterial:boolean;materialityReasons:string[];requestedReviews:{sales:boolean;revenue:boolean;founder:boolean} };

export async function reconstructAuthenticObservation(db:Firestore, raw:AuthenticObservationSelection){
  const selection={accountId:id(raw.accountId,"accountId"),pursuitId:id(raw.pursuitId,"pursuitId"),conversationId:id(raw.conversationId,"conversationId"),interactionId:id(raw.interactionId,"interactionId")};
  const [accountSnap,pursuitSnap,interactionSnap]=await db.getAll(db.doc(`crm/accounts/records/${selection.accountId}`),db.doc(`crm/salesPursuits/records/${selection.pursuitId}`),db.doc(`crm/interactions/records/${selection.interactionId}`));
  if(!accountSnap.exists||!pursuitSnap.exists||!interactionSnap.exists)throw new Error("canonical_source_missing");
  const account=record(accountSnap.data(),"account"),pursuit=record(pursuitSnap.data(),"salesPursuit"),interaction=record(interactionSnap.data(),"interaction");
  if(String(pursuit.data.accountId)!==selection.accountId||String(interaction.data.accountId)!==selection.accountId||String(interaction.data.pursuitId)!==selection.pursuitId)throw new Error("canonical_source_scope_mismatch");
  const conversation=pursuit.data.canonicalConversation as Record<string,unknown>|undefined;
  if(!conversation||conversation.conversationId!==selection.conversationId||conversation.accountId!==selection.accountId||conversation.pursuitId!==selection.pursuitId)throw new Error("canonical_conversation_mismatch");
  const refs=Array.isArray(conversation.interactionReferences)?conversation.interactionReferences as Array<Record<string,unknown>>:[];
  if(refs.filter(x=>x.interactionId===selection.interactionId).length!==1||interaction.data.conversationId!==selection.conversationId)throw new Error("canonical_interaction_membership_ambiguous");
  if(interaction.data.type!=="inbound_received")throw new Error("source_not_attributed_inbound");
  const statement=typeof interaction.data.exactStatement==="string"?interaction.data.exactStatement.trim():"";
  const sender=typeof interaction.data.senderParticipantKey==="string"?interaction.data.senderParticipantKey:"";
  const participants=Array.isArray(interaction.data.participants)?interaction.data.participants as Array<Record<string,unknown>>:[];
  const senderMatches=participants.filter(x=>`${x.type}:${x.id}`===sender&&x.type==="crm_contact");
  if(!statement||senderMatches.length!==1)throw new Error("source_attribution_missing_or_ambiguous");
  const contactId=String(senderMatches[0].id);if(interaction.data.contactId!==contactId)throw new Error("source_speaker_identity_mismatch");
  const contactSnap=await db.doc(`crm/contacts/records/${id(contactId,"contactId")}`).get();if(!contactSnap.exists)throw new Error("source_speaker_missing");
  const contact=record(contactSnap.data(),"contact");if(String(contact.data.accountId)!==selection.accountId)throw new Error("source_speaker_scope_mismatch");
  const sourceProvenance=Array.isArray(interaction.provenance)?interaction.provenance:[];
  if(!sourceProvenance.includes("future_brand_statement")&&!sourceProvenance.includes("founder_provided_information"))throw new Error("source_provenance_not_authoritative");
  const revisionBinding={accountRevision:account.revision,pursuitRevision:pursuit.revision,interactionRevision:interaction.revision,contactRevision:contact.revision,conversationRevision:Number(conversation.revision),conversationRevisionSha256:String(conversation.revisionSha256??"")};
  if(!Number.isInteger(revisionBinding.conversationRevision)||!revisionBinding.conversationRevisionSha256)throw new Error("canonical_conversation_revision_invalid");
  const evidenceAuthenticity=interaction.data.evidenceAuthenticity==="authentic"?"authentic":interaction.data.evidenceAuthenticity==="synthetic"||interaction.data.syntheticFixture===true?"synthetic":"unknown";
  return {selection,revisionBinding,sourceEvidence:{exactAttributedStatement:statement,speaker:{type:"crm_contact" as const,contactId},occurredAt:String(interaction.data.occurredAt??""),provenance:sourceProvenance,evidenceAuthenticity,synthetic:evidenceAuthenticity==="synthetic",authenticProductionEvidence:evidenceAuthenticity==="authentic"},sourceRecordPaths:{account:accountSnap.ref.path,pursuit:pursuitSnap.ref.path,conversation:pursuitSnap.ref.path,interaction:interactionSnap.ref.path,contact:contactSnap.ref.path}};
}

export function buildAuthenticObservationPreview(source:Awaited<ReturnType<typeof reconstructAuthenticObservation>>,interpretation:AuthenticObservationInterpretation){
  if(!interpretation.closerInterpretation.trim())throw new Error("assessment_interpretation_required");
  const body={schemaVersion:CRM_AUTHENTIC_OBSERVATION_PREVIEW_SCHEMA,source,interpretation:{...interpretation,materialityReasons:[...new Set(interpretation.materialityReasons.map(x=>x.trim()).filter(Boolean))]},authority:{crmInteractionCreationAuthorized:false as const,closerContinuationAuthorized:false as const,agentInvocationAuthorized:false as const,externalActionAuthorized:false as const}};
  return {...body,previewId:`crmobs_${sha(body).slice(0,32)}`,previewSha256:sha(body)};
}

export function verifyAuthenticObservationPreview(value:ReturnType<typeof buildAuthenticObservationPreview>){const{previewId,previewSha256,...body}=value;if(previewSha256!==sha(body)||previewId!==`crmobs_${sha(body).slice(0,32)}`)throw new Error("observation_preview_integrity_failed");}
