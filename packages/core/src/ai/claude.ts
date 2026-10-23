// Shared server-side AI provider. Only imported from server code (database layer, route handlers);
// the API key never reaches the browser. Without ANTHROPIC_API_KEY every caller falls back to its own
// transparent rule-based logic, and the UI says so.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

export const defaultModel = "claude-opus-5-5";
// USD per million tokens [input, output]; unknown models are costed at the default model's rate.
const pricing: Record<string, [number, number]> = { "claude-opus-5-5": [4, 20], "claude-sonnet-5-5": [2, 10], "claude-haiku-5-5": [0.1, 0.5] };
export type AiStatus = { configured: boolean; provider: "anthropic" | null; model: string | null };
export function aiStatus(): AiStatus {
  const key = process.env.ANTHROPIC_API_KEY;
  return key ? { configured: true, provider: "anthropic", model: process.env.AI_MODEL || defaultModel } : { configured: false, provider: null, model: null };
}
// Euro cents, rounded up; the fixed rate is configurable because Anthropic bills in USD.
export function estimateCostCents(model: string, inputTokens: number, outputTokens: number): number {
  const [input, output] = pricing[model] ?? pricing[defaultModel], eurPerUsd = Number(process.env.AI_EUR_PER_USD) || 0.9;
  return Math.ceil(((inputTokens * input + outputTokens * output) / 1e6) * 100 * eurPerUsd);
}
export class AiUnavailable extends Error {}
export class AiDeclined extends Error {}
let client: Anthropic | undefined;
export async function structured<T>(schema: z.ZodType<T>, { system, prompt, maxTokens = 4000, effort = "low" }: { system: string; prompt: string; maxTokens?: number; effort?: "low" | "medium" | "high" }): Promise<{ data: T; costCents: number; model: string }> {
  const status = aiStatus();
  if (!status.configured || !status.model) throw new AiUnavailable("AI is not configured");
  client ??= new Anthropic({ maxRetries: 2, timeout: 60_000 });
  const response = await client.messages.parse({
    model: status.model, max_tokens: maxTokens, system,
    messages: [{ role: "user", content: prompt }],
    output_config: { effort, format: zodOutputFormat(schema as never) }
  });
  const costCents = estimateCostCents(status.model, response.usage.input_tokens, response.usage.output_tokens);
  // A declined or truncated answer is reported to the caller, which then uses its rule-based result.
  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens" || !response.parsed_output) throw Object.assign(new AiDeclined(response.stop_reason || "unparsed"), { costCents });
  return { data: response.parsed_output as T, costCents, model: status.model };
}
