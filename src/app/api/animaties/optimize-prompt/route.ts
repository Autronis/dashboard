import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert AI image prompt engineer. The user gives you a simple product description (e.g. "Nike Air Max 90", "espresso machine", "mechanical keyboard"). Your job is to transform this into a rich, detailed product description optimized for AI image generation.

Your output should include:
- Exact product name and model
- Materials (brushed aluminum, matte ABS plastic, tempered glass, leather, rubber, etc.)
- Colors with specifics (space gray, arctic white, burnt orange, etc.)
- Key visual details (textures, finishes, reflections, patterns)
- Shape and form description
- Notable design elements (logos, branding, buttons, ports, seams)
- State of the product (new, pristine, closed, powered off)

DO NOT include:
- Photography instructions (no camera, lighting, background info)
- Composition or framing
- Any prompt engineering syntax

Just describe the OBJECT itself in vivid detail, as if you're writing a product catalog entry that a 3D artist would use as reference.

Keep it to 2-4 sentences. Be specific, not generic.

Return ONLY a JSON object:
{
  "optimizedPrompt": "The detailed product description",
  "productName": "Short product name"
}`;

export async function POST(req: NextRequest) {
  const { description, imageBase64, mediaType } = await req.json() as {
    description?: string;
    imageBase64?: string;
    mediaType?: string;
  };

  if (!description?.trim() && !imageBase64) {
    return NextResponse.json({ error: "Geef een beschrijving op." }, { status: 400 });
  }

  let userContent: MessageParam["content"] = [];

  if (imageBase64 && mediaType) {
    userContent = [
      {
        type: "image",
        source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: imageBase64 },
      },
      {
        type: "text",
        text: description
          ? `Beschrijf dit product in detail voor AI image generation. Extra context: ${description}`
          : "Beschrijf dit product in detail voor AI image generation.",
      },
    ];
  } else {
    userContent = [{ type: "text", text: `Beschrijf dit product in detail voor AI image generation: ${description}` }];
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

  const result = JSON.parse(jsonMatch[0]) as {
    optimizedPrompt: string;
    productName: string;
  };

  return NextResponse.json(result);
}
