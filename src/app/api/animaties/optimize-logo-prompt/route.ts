import { NextRequest, NextResponse } from "next/server";
import { TrackedAnthropic as Anthropic, type MessageParam } from "@/lib/ai/tracked-anthropic";

const anthropic = Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You refine short animation descriptions into concise AI video prompts. The user has ALREADY uploaded a reference image — do NOT describe the object in detail. The video model will SEE the image.

Your job:
- Keep it SHORT (2-4 sentences max)
- Start with "The object" or "The logo" — never describe what it looks like (the image handles that)
- Focus ONLY on the MOTION: what moves, how, timing, direction
- Add specific timing (e.g. "over 2 seconds", "at 0.5s")
- Add motion style (e.g. "smooth ease-in-out", "snappy", "organic")
- Include lighting changes if relevant (e.g. "glow intensifies", "subtle pulse")
- Always end with: "Clean white background, photorealistic, locked camera."

Example input: "oplichten en stroom door de kabels"
Example output: "The object sits still for 0.5s, then a warm golden glow gradually builds from the core outward over 1.5s. Thin electric pulses travel along the cables as bright teal charges, racing from center to endpoints in sequential waves. The glow stabilizes at full intensity with a subtle breathing pulse. Clean white background, photorealistic, locked camera."

Do NOT:
- Describe the shape, materials, or colors of the object
- Write "A [object type] sits on..."
- Start from scratch — build on what the user wrote
- Make it longer than 4 sentences

Return ONLY a JSON object:
{
  "optimizedPrompt": "The refined animation prompt"
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

  const tagContext = tags && tags.length > 0 ? ` Animatie types: ${tags.join(", ")}.` : "";

  let userContent: MessageParam["content"] = [];

  if (imageBase64 && mediaType) {
    userContent = [
      {
        type: "image",
        source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: imageBase64 },
      },
      {
        type: "text",
        text: `Dit is het object. De gebruiker wil deze animatie: "${description || "mooie animatie"}".${tagContext} Verfijn dit tot een korte video prompt. Beschrijf NIET het object — alleen de beweging.`,
      },
    ];
  } else {
    userContent = [{ type: "text", text: `De gebruiker wil deze animatie: "${description}".${tagContext} Verfijn tot een korte video prompt — alleen de beweging, niet het object beschrijven.` }];
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({ error: "Kon prompt niet optimaliseren." }, { status: 500 });

  const result = JSON.parse(jsonMatch[0]) as { optimizedPrompt: string };
  return NextResponse.json(result);
}
