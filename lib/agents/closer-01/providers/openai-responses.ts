import { buildCloserProviderInstructions, buildCloserProviderProjection } from "../provider-projection";
import { CLOSER_PROVIDER_OUTPUT_SCHEMA, normalizeCloserProviderProposal } from "../provider-output";
import type { CloserSimulationGenerationInput, CloserSimulationGenerationResult, CloserSimulationGenerator } from "../simulation-generator";

export const CLOSER_PROVIDER_MODEL = "gpt-5.6-terra" as const;
export const CLOSER_PROVIDER_REASONING_EFFORT = "medium" as const;
export const CLOSER_PROVIDER_MAX_OUTPUT_TOKENS = 2000 as const;
export const CLOSER_PROVIDER_TIMEOUT_MS = 60_000 as const;

export class CloserProviderError extends Error { code: string; status: number; constructor(code: string, message: string, status = 502) { super(message); this.name = "CloserProviderError"; this.code = code; this.status = status; } }

type FetchLike = typeof fetch;
const number = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
function outputText(payload: Record<string, unknown>): string { if (typeof payload.output_text === "string") return payload.output_text; for (const item of Array.isArray(payload.output) ? payload.output : []) for (const content of Array.isArray(object(item).content) ? object(item).content as unknown[] : []) if (typeof object(content).text === "string") return String(object(content).text); throw new CloserProviderError("provider_output_missing", "CLOSER provider completed without structured output."); }

export class OpenAIResponsesCloserProvider implements CloserSimulationGenerator {
  private apiKey: string; private model: string; private fetchImpl: FetchLike; private now: () => string; private timeoutMs:number;
  constructor(params:{apiKey:string;model?:string;fetchImpl?:FetchLike;now?:()=>string;timeoutMs?:number}){this.apiKey=params.apiKey;this.model=params.model??CLOSER_PROVIDER_MODEL;this.fetchImpl=params.fetchImpl??fetch;this.now=params.now??(()=>new Date().toISOString());this.timeoutMs=params.timeoutMs??CLOSER_PROVIDER_TIMEOUT_MS;}
  async generate(input:CloserSimulationGenerationInput):Promise<CloserSimulationGenerationResult>{
    if(!this.apiKey)throw new CloserProviderError("provider_not_configured","CLOSER message preparation is not configured.",503);
    const started=this.now(),controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),this.timeoutMs);
    try{
      const response=await this.fetchImpl("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${this.apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:this.model,store:false,reasoning:{effort:CLOSER_PROVIDER_REASONING_EFFORT},instructions:buildCloserProviderInstructions(),input:JSON.stringify(buildCloserProviderProjection({authority:input.authority,packet:input.currentPacket})),max_output_tokens:CLOSER_PROVIDER_MAX_OUTPUT_TOKENS,text:{format:{type:"json_schema",name:"closer_message_preparation",strict:true,schema:CLOSER_PROVIDER_OUTPUT_SCHEMA}}}),signal:controller.signal});
      if(!response.ok)throw new CloserProviderError(response.status===429?"provider_rate_limited":"provider_request_failed",`CLOSER provider request failed with status ${response.status}. No automatic retry was attempted.`,response.status===429?429:502);
      const payload=await response.json() as Record<string,unknown>,usage=object(payload.usage),inputDetails=object(usage.input_tokens_details),outputDetails=object(usage.output_tokens_details),proposal=normalizeCloserProviderProposal(JSON.parse(outputText(payload)));
      return{generatorVersion:"closer-01-openai-responses-v1",proposal,execution:{provider:"openai_responses",requestedModel:this.model,returnedModel:typeof payload.model==="string"?payload.model:null,responseId:typeof payload.id==="string"?payload.id:null,status:typeof payload.status==="string"?payload.status:null,serverStartedAt:started,serverCompletedAt:this.now(),inputTokens:number(usage.input_tokens),cachedInputTokens:number(inputDetails.cached_tokens),cacheWriteTokens:number(inputDetails.cache_write_tokens),outputTokens:number(usage.output_tokens),reasoningTokens:number(outputDetails.reasoning_tokens),totalTokens:number(usage.total_tokens),costUsd:null,sanitizedCode:null}};
    }catch(error){if(error instanceof CloserProviderError)throw error;if(controller.signal.aborted)throw new CloserProviderError("provider_timeout","CLOSER provider request timed out. The authority remains consumed and no retry was attempted.",504);if(error instanceof SyntaxError||error instanceof Error&&error.message.startsWith("provider_output_"))throw new CloserProviderError("provider_output_invalid","CLOSER provider returned invalid structured output. The authority remains consumed.");throw new CloserProviderError("provider_failure_ambiguous","CLOSER provider failed ambiguously. The authority remains consumed and no retry was attempted.");}finally{clearTimeout(timeout);}
  }
}
