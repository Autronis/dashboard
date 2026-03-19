/**
 * Unified AI client: Groq (free, fast) → Anthropic (paid, fallback)
 * All non-vision, non-streaming AI calls should use this.
 */

interface AiCompletionOptions {
  prompt: string;
  system?: string;
  maxTokens?: number;
  /** Force a specific provider instead of auto-selecting */
  provider?: "groq" | "anthropic";
}

interface AiCompletionResult {
  text: string;
  provider: "groq" | "anthropic";
}

async function callGroq(options: AiCompletionOptions): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY niet ingesteld");

  const messages: Array<{ role: string; content: string }> = [];
  if (options.system) messages.push({ role: "system", content: options.system });
  messages.push({ role: "user", content: options.prompt });

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: options.maxTokens ?? 1024,
      messages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Groq API error ${res.status}: ${errText}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices?.[0]?.message?.content || "";
}

async function callAnthropic(options: AiCompletionOptions): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY niet ingesteld");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: options.maxTokens ?? 1024,
      ...(options.system ? { system: options.system } : {}),
      messages: [{ role: "user", content: options.prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${errText}`);
  }

  const data = await res.json() as {
    content: Array<{ type: string; text: string }>;
  };

  return data.content?.find((c) => c.type === "text")?.text || "";
}

/**
 * Call AI with automatic provider selection.
 * Priority: Groq (free) → Anthropic (paid fallback)
 */
export async function aiComplete(options: AiCompletionOptions): Promise<AiCompletionResult> {
  // If specific provider requested, use that
  if (options.provider === "anthropic") {
    const text = await callAnthropic(options);
    return { text, provider: "anthropic" };
  }
  if (options.provider === "groq") {
    const text = await callGroq(options);
    return { text, provider: "groq" };
  }

  // Auto: try Groq first (free), fallback to Anthropic
  try {
    const text = await callGroq(options);
    return { text, provider: "groq" };
  } catch (groqError) {
    // Groq failed, try Anthropic
    try {
      const text = await callAnthropic(options);
      return { text, provider: "anthropic" };
    } catch {
      // Both failed — throw the original Groq error (more likely fixable)
      throw groqError;
    }
  }
}

/**
 * Helper: call AI and parse JSON from response
 */
export async function aiCompleteJson<T>(options: AiCompletionOptions): Promise<T> {
  const { text } = await aiComplete(options);

  // Extract JSON from response (handles markdown code blocks too)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\[[\s\S]*\])/) || text.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) throw new Error("Geen JSON gevonden in AI response");

  return JSON.parse(jsonMatch[1]) as T;
}
