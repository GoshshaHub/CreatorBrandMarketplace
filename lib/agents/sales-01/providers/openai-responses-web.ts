import { buildSalesResearchInstructions } from "../research-prompt";
import { consumeSalesProviderErrorDiagnostics, formatSalesProviderErrorDiagnostics, type SalesResearchProvider } from "../research-provider";
import { MAX_SALES_PROVIDER_OUTPUT_TOKENS, MAX_SALES_WEB_SEARCH_CALLS, OPENAI_SALES_INTELLIGENCE_JSON_SCHEMA, SALES_PROVIDER_TIMEOUT_MS, SalesResearchError, normalizeCompletedOpenAISalesResponse } from "../research-schema";
import type { SalesResearchProviderContext, SalesResearchRequest } from "../research-types";

type FetchLike = typeof fetch;

export class OpenAIResponsesWebSalesProvider implements SalesResearchProvider {
  private apiKey: string; private model: string; private fetchImpl: FetchLike;
  constructor(params: { apiKey: string; model: string; fetchImpl?: FetchLike }) { this.apiKey = params.apiKey; this.model = params.model; this.fetchImpl = params.fetchImpl || fetch; }
  async research(request: SalesResearchRequest, context: SalesResearchProviderContext, signal: AbortSignal) {
    if (!this.apiKey) throw new SalesResearchError("provider_not_configured", "Live SALES intelligence is not configured.", 503);
    const timeoutController = new AbortController(); const timeout = setTimeout(() => timeoutController.abort(), SALES_PROVIDER_TIMEOUT_MS); const abort = () => timeoutController.abort(); signal.addEventListener("abort", abort, { once: true });
    try {
      const response = await this.fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST", headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, store: false, reasoning: { effort: "medium" }, instructions: buildSalesResearchInstructions(context), input: "Research public-web Sales intelligence for the one supplied qualified opportunity.", tools: [{ type: "web_search", search_context_size: "medium" }], tool_choice: "auto", parallel_tool_calls: false, max_tool_calls: MAX_SALES_WEB_SEARCH_CALLS, max_output_tokens: MAX_SALES_PROVIDER_OUTPUT_TOKENS, include: ["web_search_call.action.sources"], text: { format: { type: "json_schema", name: "sales_intelligence_proposal", strict: true, schema: OPENAI_SALES_INTELLIGENCE_JSON_SCHEMA } } }),
        signal: timeoutController.signal,
      });
      if (!response.ok) {
        const diagnostics = await consumeSalesProviderErrorDiagnostics(response); const details = formatSalesProviderErrorDiagnostics(diagnostics);
        throw new SalesResearchError(response.status === 429 ? "provider_rate_limited" : "provider_request_failed", `OpenAI SALES research failed with status ${response.status}.${details ? ` ${details}` : ""} No automatic retry was attempted.`, response.status === 429 ? 429 : 502);
      }
      const payload = await response.json() as Record<string, unknown>;
      return normalizeCompletedOpenAISalesResponse({ response: payload, request, requestedModel: this.model, serverReceivedAt: new Date().toISOString() });
    } catch (error) {
      if (error instanceof SalesResearchError) throw error;
      if (timeoutController.signal.aborted) throw new SalesResearchError("provider_timeout", "SALES research timed out. No automatic retry was attempted.", 504);
      throw new SalesResearchError("provider_failure_ambiguous", "SALES research failed ambiguously. No automatic retry was attempted.", 502);
    } finally { clearTimeout(timeout); signal.removeEventListener("abort", abort); }
  }
}
