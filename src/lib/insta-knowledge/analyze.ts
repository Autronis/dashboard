// src/lib/insta-knowledge/analyze.ts
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";
import { INSTA_SYSTEM_PROMPT } from "./prompts";
import type { AnalysisResult, ImageContent } from "./types";

export const INSTA_MODEL = "claude-sonnet-4-20250514";

function buildPrompt(input: { caption: string; transcript?: string; imageCount: number }): string {
  const parts: string[] = [];
  if (input.imageCount > 0) {
    parts.push(
      `--- AFBEELDINGEN ---\n${input.imageCount} afbeelding${input.imageCount > 1 ? "en" : ""} uit de Instagram-post ${input.imageCount > 1 ? "(carousel-slides)" : "(thumbnail of post-foto)"}. Lees alle tekst die op de afbeelding(en) staat en gebruik de visuele context actief voor je analyse.`
    );
  }
  parts.push(`--- CAPTION ---\n${input.caption || "(geen caption)"}`);
  if (input.transcript) parts.push(`--- TRANSCRIPT ---\n${input.transcript}`);
  return parts.join("\n\n");
}

function stripFences(s: string): string {
  return s
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

function assertAnalysis(obj: unknown): asserts obj is AnalysisResult {
  if (!obj || typeof obj !== "object") throw new Error("analysis_not_object");
  const r = obj as Record<string, unknown>;
  if (typeof r.summary !== "string") throw new Error("analysis_missing_summary");
  if (typeof r.idea_title !== "string") throw new Error("analysis_missing_idea_title");
  if (!Array.isArray(r.features)) throw new Error("analysis_missing_features");
  if (!Array.isArray(r.steps)) throw new Error("analysis_missing_steps");
  if (!Array.isArray(r.tips)) throw new Error("analysis_missing_tips");
  if (!Array.isArray(r.links)) throw new Error("analysis_missing_links");
  if (typeof r.relevance_score !== "number") throw new Error("analysis_missing_score");
  if (typeof r.relevance_reason !== "string") throw new Error("analysis_missing_reason");
}

export async function analyzeInstaContent(input: {
  caption: string;
  transcript?: string;
  images?: ImageContent[];
}): Promise<AnalysisResult> {
  const anthropic = Anthropic(undefined, "/api/insta-knowledge");
  const images = input.images ?? [];
  const promptText = buildPrompt({
    caption: input.caption,
    transcript: input.transcript,
    imageCount: images.length,
  });

  type Block =
    | { type: "image"; source: { type: "base64"; media_type: ImageContent["mediaType"]; data: string } }
    | { type: "text"; text: string };
  const content: Block[] = images.map((img) => ({
    type: "image",
    source: { type: "base64", media_type: img.mediaType, data: img.data },
  }));
  content.push({ type: "text", text: promptText });

  const response = await anthropic.messages.create({
    model: INSTA_MODEL,
    max_tokens: 4096,
    system: INSTA_SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });
  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  const cleaned = stripFences(raw);
  const parsed = JSON.parse(cleaned) as unknown;
  assertAnalysis(parsed);
  return parsed;
}
