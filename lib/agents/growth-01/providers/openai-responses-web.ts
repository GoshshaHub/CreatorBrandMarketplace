import {
  consumeProviderErrorDiagnostics,
  formatProviderErrorDiagnostics,
  type GrowthResearchProvider,
} from "../research-provider";
import { buildGrowthResearchInstructions } from "../research-prompt";
import {
  MAX_PROVIDER_OUTPUT_TOKENS,
  MAX_WEB_SEARCH_CALLS,
  OPENAI_GROWTH_RESEARCH_JSON_SCHEMA,
  PROVIDER_TIMEOUT_MS,
  GrowthResearchError,
  normalizeCompletedOpenAIResearchResponse,
} from "../research-schema";
import type { GrowthResearchProviderContext, GrowthResearchRequest } from "../research-types";

type FetchLike = typeof fetch;

export class OpenAIResponsesWebResearchProvider implements GrowthResearchProvider {
  private apiKey: string;
  private model: string;
  private fetchImpl: FetchLike;

  constructor(params: { apiKey: string; model: string; fetchImpl?: FetchLike }) {
    this.apiKey = params.apiKey;
    this.model = params.model;
    this.fetchImpl = params.fetchImpl || fetch;
  }

  async research(request: GrowthResearchRequest, context: GrowthResearchProviderContext, signal: AbortSignal) {
    if (!this.apiKey) throw new GrowthResearchError("provider_not_configured", "Live research is not configured.", 503);
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), PROVIDER_TIMEOUT_MS);
    const abort = () => timeoutController.abort();
    signal.addEventListener("abort", abort, { once: true });
    try {
      const response = await this.fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          store: false,
          reasoning: { effort: "medium" },
          instructions: buildGrowthResearchInstructions(context),
          input: "Research current public-web Goshsha growth opportunities within the supplied market and Founder focus.",
          tools: [{ type: "web_search", search_context_size: "medium" }],
          tool_choice: "auto",
          max_tool_calls: MAX_WEB_SEARCH_CALLS,
          max_output_tokens: MAX_PROVIDER_OUTPUT_TOKENS,
          include: ["web_search_call.action.sources"],
          text: {
            format: {
              type: "json_schema",
              name: "growth_research_proposal",
              strict: true,
              schema: OPENAI_GROWTH_RESEARCH_JSON_SCHEMA,
            },
          },
        }),
        signal: timeoutController.signal,
      });
      if (!response.ok) {
        const diagnostics = await consumeProviderErrorDiagnostics(response);
        const safeDetails = formatProviderErrorDiagnostics(diagnostics);
        if (response.status === 429) {
          throw new GrowthResearchError(
            "provider_rate_limited",
            `OpenAI rate-limited the research request.${safeDetails ? ` ${safeDetails}` : ""} Try again later only with current Founder spending authority. No automatic retry was attempted.`,
            429
          );
        }
        throw new GrowthResearchError(
          "provider_request_failed",
          `OpenAI research failed with status ${response.status}.${safeDetails ? ` ${safeDetails}` : ""} No automatic retry was attempted.`,
          502
        );
      }
      const payload = await response.json() as Record<string, unknown>;
      const serverReceivedAt = new Date().toISOString();
      return normalizeCompletedOpenAIResearchResponse({
        response: payload,
        request,
        requestedModel: this.model,
        serverReceivedAt,
      });
    } catch (error) {
      if (error instanceof GrowthResearchError) throw error;
      if (timeoutController.signal.aborted) throw new GrowthResearchError("provider_timeout", "Live research timed out. No automatic retry was attempted.", 504);
      throw new GrowthResearchError("provider_failure_ambiguous", "Live research failed ambiguously. No automatic retry was attempted.", 502);
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
    }
  }
}
