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

function observation(packet: ConversationIntelligencePacketV1): CloserSimulationObservationPreviewV1 {
  const latest = packet.crm.interactions.at(-1) ?? null, statement = latest?.exactAttributedStatement ?? null;
  return { exactAttributedEvidence: { interactionId: latest?.interactionId ?? null, statement, classification: statement ? "attributed_statement" : "unavailable" }, interpretation: { objectionDetected: Boolean(statement), objection: statement, playbookCoverage: statement ? "covered" : "none", commerciallyMaterial: false, rationale: statement ? "The attributed prospect statement is available to the bounded provider projection; the provider must return review_required when current evidence, strategy, claims, offer, or authority is insufficient." : "No prior prospect statement is required for an initial outreach draft." }, requiredReview: { sales: false, revenue: false, founder: false, reasons: [] }, canonicalCrmRecordCreated: false, persisted: false };
}

function validateGeneratedPair(pair: CloserSimulationGeneratedPair, assertions: Array<{claimId:string;statement:string}>, authority: CloserSimulationAuthorityV1): void {
  if (!pair.nextAction.trim() || !pair.message.trim()) throw new CloserSimulationError("simulation_output_invalid", "Simulation output must contain exactly one nonempty next-action/message pair.");
  const approved = new Map(authority.claimsEnvelope.approvedClaims.map((claim) => [claim.id,claim.statement]));
  if (!assertions.length || assertions.some(({claimId,statement}) => approved.get(claimId)!==statement || !pair.message.includes(statement))) throw new CloserSimulationError("simulation_claim_support_invalid", "Every factual assertion must exactly match a current approved Playbook claim and appear in the draft.");
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
    else { const generated=await params.generator.generate({ authority: params.authority,currentPacket:params.currentPacket,latestInboundStatement:preview.exactAttributedEvidence.statement });providerExecution=generated.execution;if(generated.proposal.status==="review_required"){status="REVIEW_REQUIRED_NO_SIMULATION";preview.interpretation.playbookCoverage="unsupported";preview.interpretation.commerciallyMaterial=true;preview.requiredReview={...generated.proposal.requiredReviews,reasons:generated.proposal.reviewReasons};}else{pair={generatorVersion:generated.generatorVersion,nextAction:generated.proposal.nextAction!,message:generated.proposal.message!};validateGeneratedPair(pair,generated.proposal.assertions,params.authority);} }
    const body = { schemaVersion: CLOSER_SIMULATION_RESULT_SCHEMA, version: CLOSER_SIMULATION_RESULT_VERSION, canonicalizationVersion: CLOSER_SIMULATION_RESULT_CANONICALIZATION, status, authorityId: params.authority.authorityId, authoritySha256: params.authority.authoritySha256, pair, observationPreview: preview, providerExecution, safety: { sent: false as const, scheduled: false as const, dispatched: false as const, persisted: false as const, crmMutation: false as const, providerInvoked: providerExecution?.provider==="openai_responses", paymentAction: false as const, externalAction: false as const, revenueObjectiveChanged: false as const, positioningChanged: false as const, offerChanged: false as const } };
    return { ...body, simulationId: revenueStableId("closersim", body), simulationSha256: revenueSha256(body) };
  });
}
