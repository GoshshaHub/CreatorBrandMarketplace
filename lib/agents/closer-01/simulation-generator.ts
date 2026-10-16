import type { CloserSimulationAuthorityV1 } from "./simulation-authority";
import type { ConversationIntelligencePacketV1 } from "./types";
import type { CloserProviderProposal } from "./provider-output";

export type CloserProviderExecutionMetadata = { provider: string; requestedModel: string; returnedModel: string | null; responseId: string | null; status: string | null; serverStartedAt: string; serverCompletedAt: string; inputTokens: number | null; cachedInputTokens: number | null; cacheWriteTokens: number | null; outputTokens: number | null; reasoningTokens: number | null; totalTokens: number | null; costUsd: null; sanitizedCode: string | null };
export type CloserSimulationGenerationInput = { authority: CloserSimulationAuthorityV1; currentPacket: ConversationIntelligencePacketV1; latestInboundStatement: string | null };
export type CloserSimulationGeneratedPair = { generatorVersion: string; nextAction: string; message: string };
export type CloserSimulationGenerationResult = { proposal: CloserProviderProposal; generatorVersion: string; execution: CloserProviderExecutionMetadata };
export interface CloserSimulationGenerator { generate(input: CloserSimulationGenerationInput): Promise<CloserSimulationGenerationResult> }

export class DeterministicFixtureSimulationGenerator implements CloserSimulationGenerator {
  async generate(input: CloserSimulationGenerationInput): Promise<CloserSimulationGenerationResult> {
    const objection = input.authority.claimsEnvelope.audienceObjection;
    const asksAudience = /how many (users|people)|audience size/i.test(input.latestInboundStatement ?? "");
    const execution={provider:"deterministic_fixture",requestedModel:"deterministic_fixture",returnedModel:"deterministic_fixture",responseId:null,status:"completed",serverStartedAt:new Date(0).toISOString(),serverCompletedAt:new Date(0).toISOString(),inputTokens:null,cachedInputTokens:null,cacheWriteTokens:null,outputTokens:null,reasoningTokens:null,totalTokens:null,costUsd:null,sanitizedCode:null};
    const approved=input.authority.claimsEnvelope.approvedClaims[0],assertions=[{claimId:approved.id,statement:approved.statement}];
    if (asksAudience) return { generatorVersion: "closer-01-deterministic-fixture-generator-v1", proposal:{status:"draft",nextAction:"Answer the approved audience question, then invite Founder review of any continuation.",message:`${approved.statement} ${objection.response} ${objection.deeperQualification}`,assertions,reviewReasons:[],requiredReviews:{sales:false,revenue:false,founder:false}},execution };
    const scopeObjection=input.authority.claimsEnvelope.objections.find(item=>/custom implementation|guaranteed ROI|discount/i.test(item.objection)&&item.escalate===false);
    if(scopeObjection&&/custom implementation|guaranteed ROI|discount/i.test(input.latestInboundStatement??""))return{generatorVersion:"closer-01-deterministic-fixture-generator-v1",proposal:{status:"draft",nextAction:"Use the approved standard-scope response.",message:`${approved.statement} ${scopeObjection.response}`,assertions,reviewReasons:[],requiredReviews:{sales:false,revenue:false,founder:false}},execution};
    const offer = input.authority.offerEnvelope.selectedOffer;
    return { generatorVersion: "closer-01-deterministic-fixture-generator-v1", proposal:{status:"draft",nextAction:"Present one Founder-reviewable, objective-aligned draft using the current Sales Playbook and standard offer.",message:`${approved.statement} The current standard option is ${offer.name}.`,assertions,reviewReasons:[],requiredReviews:{sales:false,revenue:false,founder:false}},execution };
  }
}
