import { revenueSha256, revenueStableId } from "../revenue-01/canonical";
import type { ConversationIntelligencePacketV1 } from "./types";
import { verifyFounderSimulationAuthority, type CloserSimulationAuthorityV1 } from "./simulation-authority";
import type { CloserSimulationConsumptionCoordinator } from "./simulation-consumption";
import type { CloserProviderExecutionMetadata, CloserSimulationGeneratedPair, CloserSimulationGenerator } from "./simulation-generator";

export const CLOSER_SIMULATION_RESULT_SCHEMA = "closer-01-founder-reviewed-simulation-v1" as const;
export const CLOSER_SIMULATION_RESULT_VERSION = "v1" as const;
export const CLOSER_SIMULATION_RESULT_CANONICALIZATION = "closer-01-founder-reviewed-simulation-canonical-json-v1" as const;
export class CloserSimulationError extends Error { code: string; constructor(code: string, message: string) { super(message); this.name = "CloserSimulationError"; this.code = code; } }

export type CloserSimulationObservationPreviewV1 = { exactAttributedEvidence: { interactionId: string | null; statement: string | null; classification: "attributed_statement" | "unavailable" }; interpretation: { objectionDetected: boolean; objection: string | null; playbookCoverage: "covered" | "unsupported" | "none"; commerciallyMaterial: boolean; rationale: string }; requiredReview: { sales: boolean; revenue: boolean; founder: boolean; reasons: string[] }; canonicalCrmRecordCreated: false; persisted: false };
export type CloserSimulationResultV1 = { schemaVersion: typeof CLOSER_SIMULATION_RESULT_SCHEMA; version: typeof CLOSER_SIMULATION_RESULT_VERSION; canonicalizationVersion: typeof CLOSER_SIMULATION_RESULT_CANONICALIZATION; simulationId: string; simulationSha256: string; status: "SIMULATED_FOR_FOUNDER_REVIEW" | "REVIEW_REQUIRED_NO_SIMULATION"; authorityId: string; authoritySha256: string; pair: CloserSimulationGeneratedPair | null; observationPreview: CloserSimulationObservationPreviewV1; providerExecution: CloserProviderExecutionMetadata | null; safety: { sent: false; scheduled: false; dispatched: false; persisted: false; crmMutation: false; providerInvoked: boolean; paymentAction: false; externalAction: false; revenueObjectiveChanged: false; positioningChanged: false; offerChanged: false } };

const unsupported = /discount|concession|custom (?:build|engineering|implementation)|legal terms|contract terms|guarantee(?:d)? (?:sales|roi|conversion|reach|views)|change (?:the )?(?:price|offer)|ignore (?:the )?(?:authority|playbook|instructions)|bypass/i;
const prohibitedOutput = /guarantee(?:d)? (?:sales|roi|conversion|reach|views)|massive (?:audience|reach)|all (?:retail )?shoppers|causal .*purchase|retailer (?:endorses|authorizes|integrates)/i;

function observation(packet: ConversationIntelligencePacketV1): CloserSimulationObservationPreviewV1 {
  const latest = packet.crm.interactions.at(-1) ?? null, statement = latest?.exactAttributedStatement ?? null;
  const unsupportedObjection = Boolean(statement && unsupported.test(statement));
  const revisedCoverage = Boolean(unsupportedObjection && packet.sales.objections.some((item) => /custom implementation|guaranteed ROI|discount/i.test(item.objection) && Boolean(item.response) && item.escalate === false));
  const audienceObjection = Boolean(statement && /how many (users|people)|audience size/i.test(statement));
  const objectionDetected = unsupportedObjection || audienceObjection;
  const remainsUnsupported=unsupportedObjection&&!revisedCoverage;
  return { exactAttributedEvidence: { interactionId: latest?.interactionId ?? null, statement, classification: statement ? "attributed_statement" : "unavailable" }, interpretation: { objectionDetected, objection: objectionDetected ? statement : null, playbookCoverage: remainsUnsupported ? "unsupported" : objectionDetected ? "covered" : "none", commerciallyMaterial: unsupportedObjection, rationale: remainsUnsupported ? "The prospect text requests strategy, terms, claims, or authority outside the current Playbook." : revisedCoverage ? "The current immutable SALES Playbook contains the Founder-approved standard-scope response." : audienceObjection ? "The canonical Sales Playbook contains the approved audience objection response." : "No material objection was detected by the bounded deterministic classifier." }, requiredReview: { sales: remainsUnsupported, revenue: remainsUnsupported, founder: remainsUnsupported, reasons: remainsUnsupported ? ["Unsupported objection requires CRM evidence preservation, SALES review, REVENUE reevaluation when commercially material, and exact Founder continuation approval."] : [] }, canonicalCrmRecordCreated: false, persisted: false };
}

function validateGeneratedPair(pair: CloserSimulationGeneratedPair, authority: CloserSimulationAuthorityV1): void {
  if (!pair.nextAction.trim() || !pair.message.trim()) throw new CloserSimulationError("simulation_output_invalid", "Simulation output must contain exactly one nonempty next-action/message pair.");
  const exactApprovedObjectionResponse=authority.claimsEnvelope.objections.some(item=>item.escalate===false&&item.response===pair.message&&/can(?:not|[’']t) promise guaranteed ROI|not guaranteed/i.test(item.response));
  if (prohibitedOutput.test(`${pair.nextAction} ${pair.message}`)&&!exactApprovedObjectionResponse) throw new CloserSimulationError("simulation_prohibited_claim", "Simulation output contains a prohibited or unsupported claim.");
  const approvedPrice=`$${authority.offerEnvelope.selectedOffer.priceUsd}`;
  if (pair.message.replaceAll(approvedPrice,"").includes("$")) throw new CloserSimulationError("simulation_offer_text_unapproved", "Simulation output may not author mutable pricing text outside the bound offer artifact.");
  if (!authority.claimsEnvelope.positioning || !authority.binding.commercialPositioningSha256) throw new CloserSimulationError("simulation_positioning_missing", "Simulation output lacks a current positioning boundary.");
}

export async function executeFounderReviewedSimulation(params: { authority: CloserSimulationAuthorityV1; currentPacket: ConversationIntelligencePacketV1; now: string; explicitSimulationRequest: boolean; coordinator: CloserSimulationConsumptionCoordinator; generator: CloserSimulationGenerator }): Promise<CloserSimulationResultV1> {
  if (!params.explicitSimulationRequest) throw new CloserSimulationError("simulation_request_missing", "A separate explicit Founder simulation request is required after PREPARED authority.");
  verifyFounderSimulationAuthority({ authority: params.authority, currentPacket: params.currentPacket, now: params.now });
  return params.coordinator.consumeOnce({ authorityId: params.authority.authorityId, authoritySha256: params.authority.authoritySha256, founderUid: params.authority.approvedByUid, accountId: params.authority.binding.accountId, pursuitId: params.authority.binding.pursuitId, expiresAt: params.authority.expiresAt }, async () => {
    const preview = observation(params.currentPacket);
    let pair: CloserSimulationGeneratedPair | null = null, providerExecution:CloserProviderExecutionMetadata|null=null, status: CloserSimulationResultV1["status"] = "SIMULATED_FOR_FOUNDER_REVIEW";
    if (preview.interpretation.playbookCoverage === "unsupported") status = "REVIEW_REQUIRED_NO_SIMULATION";
    else { const generated=await params.generator.generate({ authority: params.authority,currentPacket:params.currentPacket,latestInboundStatement:preview.exactAttributedEvidence.statement });providerExecution=generated.execution;if(generated.proposal.status==="review_required"){status="REVIEW_REQUIRED_NO_SIMULATION";preview.requiredReview={...generated.proposal.requiredReviews,reasons:generated.proposal.reviewReasons};}else{pair={generatorVersion:generated.generatorVersion,nextAction:generated.proposal.nextAction!,message:generated.proposal.message!};validateGeneratedPair(pair,params.authority);} }
    const body = { schemaVersion: CLOSER_SIMULATION_RESULT_SCHEMA, version: CLOSER_SIMULATION_RESULT_VERSION, canonicalizationVersion: CLOSER_SIMULATION_RESULT_CANONICALIZATION, status, authorityId: params.authority.authorityId, authoritySha256: params.authority.authoritySha256, pair, observationPreview: preview, providerExecution, safety: { sent: false as const, scheduled: false as const, dispatched: false as const, persisted: false as const, crmMutation: false as const, providerInvoked: providerExecution?.provider==="openai_responses", paymentAction: false as const, externalAction: false as const, revenueObjectiveChanged: false as const, positioningChanged: false as const, offerChanged: false as const } };
    return { ...body, simulationId: revenueStableId("closersim", body), simulationSha256: revenueSha256(body) };
  });
}
