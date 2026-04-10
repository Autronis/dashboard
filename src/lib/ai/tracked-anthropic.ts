/**
 * Drop-in replacement for `new Anthropic()` that automatically logs token usage.
 *
 * Usage: replace `import Anthropic from "@anthropic-ai/sdk"` with
 *        `import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic"`
 */
import OriginalAnthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources";

export type { MessageParam };
export type { OriginalAnthropic as AnthropicType };
// Re-export the Anthropic namespace for type usage (e.g. Anthropic.TextBlock)
export { OriginalAnthropic as AnthropicNS };

// Cost per million tokens in cents (USD)
// Cost per million tokens in cents (USD) — keep in sync with Anthropic pricing
const COST_MAP: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-20250514": { input: 300, output: 1500 },
  "claude-sonnet-4-6": { input: 300, output: 1500 },
  "claude-opus-4-6": { input: 1500, output: 7500 },
  "claude-haiku-4-5-20251001": { input: 100, output: 500 },
  // OpenAI models (for logTokenUsage calls from OpenAI routes)
  "gpt-4o-mini": { input: 15, output: 60 },
  // Groq (free tier, but track for visibility)
  "llama-3.3-70b-versatile": { input: 0, output: 0 },
  "whisper-large-v3": { input: 0, output: 0 },
  // Older models
  "claude-3-5-sonnet-20241022": { input: 300, output: 1500 },
  "claude-3-haiku-20240307": { input: 25, output: 125 },
};

function calculateCostCents(model: string, inputTokens: number, outputTokens: number): number {
  const costs = COST_MAP[model] || COST_MAP["claude-sonnet-4-20250514"];
  return Math.round((inputTokens * costs.input + outputTokens * costs.output) / 1_000_000);
}

export async function logTokenUsage(
  provider: string,
  model: string | undefined,
  inputTokens: number,
  outputTokens: number,
  route?: string,
) {
  try {
    const kostenCent = model ? calculateCostCents(model, inputTokens, outputTokens) : 0;
    // Use dynamic import to avoid pulling db into client bundles
    const { db } = await import("@/lib/db");
    const { apiTokenGebruik } = await import("@/lib/db/schema");
    await db.insert(apiTokenGebruik).values({
      provider,
      model: model ?? "unknown",
      inputTokens,
      outputTokens,
      kostenCent,
      route,
    }).run();
  } catch {
    // Never let logging break the actual API call
  }
}

/**
 * Creates an Anthropic client that automatically tracks token usage.
 * Drop-in replacement: `const client = new TrackedAnthropic()`
 */
export function TrackedAnthropic(
  options?: ConstructorParameters<typeof OriginalAnthropic>[0],
  trackingRoute?: string,
): OriginalAnthropic {
  const client = new OriginalAnthropic(options);

  // Wrap messages.create
  const originalCreate = client.messages.create.bind(client.messages);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client.messages as any).create = async (...args: Parameters<typeof originalCreate>) => {
    const result = await originalCreate(...args);
    // Non-streaming response has usage directly
    if (result && "usage" in result) {
      const msg = result as { usage: { input_tokens: number; output_tokens: number }; model: string };
      logTokenUsage("anthropic", msg.model, msg.usage.input_tokens, msg.usage.output_tokens, trackingRoute);
    }
    return result;
  };

  // Wrap messages.stream
  const originalStream = client.messages.stream.bind(client.messages);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client.messages as any).stream = (...args: Parameters<typeof originalStream>) => {
    const stream = originalStream(...args);
    // After stream completes, log the usage from finalMessage
    const originalFinalMessage = stream.finalMessage.bind(stream);
    stream.finalMessage = async () => {
      const msg = await originalFinalMessage();
      if (msg.usage) {
        logTokenUsage("anthropic", msg.model, msg.usage.input_tokens, msg.usage.output_tokens, trackingRoute);
      }
      return msg;
    };
    return stream;
  };

  return client;
}
