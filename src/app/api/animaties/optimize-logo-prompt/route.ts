import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert AI video prompt engineer specializing in logo and product animations. The user gives you a simple description of what they want (e.g. "de kabels moeten bewegen", "logo draait", "oplichten") and optionally an image and animation tags.

Your job is to transform this into a detailed, professional video animation prompt optimized for AI video generation (Runway, Higgsfield, Kling).

Your output should describe:
- The starting state of the object/logo (position, angle, lighting)
- The exact motion sequence step by step (what moves, how fast, in what direction)
- Camera behavior (static, slow zoom, orbit)
- Lighting changes (glow, pulse, dim, illuminate)
- Timing (what happens at 0s, 1s, 2s, etc.)
- The ending state (where does it land, final pose)
- Background (white, dark, gradient)
- Style (photorealistic, cinematic, clean, dramatic)

Write in English. Be specific about motion — not "it moves" but "it rotates 360° clockwise over 2 seconds with slight hover bounce".

Keep it to 3-6 sentences. Concise but detailed enough for an AI video model.

Return ONLY a JSON object:
{
  "optimizedPrompt": "The detailed animation prompt"
}`;

export async function POST(req: NextRequest) {
  const { description, tags, imageBase64, mediaType } = await req.json() as {
    description?: string;
    tags?: string[];
    imageBase64?: string;
    mediaType?: string;
  };

  if (!description?.trim() && !imageBase64) {
    return NextResponse.json({ error: "Geef een beschrijving op." }, { status: 400 });
  }

  const tagContext = tags && tags.length > 0 ? `\nGeselecteerde animatie stijlen: ${tags.join(", ")}` : "";

  let userContent: MessageParam["content"] = [];

  if (imageBase64 && mediaType) {
    userContent = [
      {
        type: "image",
        source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: imageBase64 },
      },
      {
        type: "text",
        text: `Maak een gedetailleerde video animatie prompt voor dit object/logo. De gebruiker wil: ${description || "een mooie animatie"}.${tagContext}`,
      },
    ];
  } else {
    userContent = [{ type: "text", text: `Maak een gedetailleerde video animatie prompt. De gebruiker wil: ${description}.${tagContext}` }];
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({ error: "Kon prompt niet optimaliseren." }, { status: 500 });

  const result = JSON.parse(jsonMatch[0]) as { optimizedPrompt: string };
  return NextResponse.json(result);
}
