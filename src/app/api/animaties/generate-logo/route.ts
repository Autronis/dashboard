import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You generate a set of 3 AI image/video prompts for a logo animation sequence, based on the user's description of what they want.

The 3 prompts follow whatever animation flow the user describes — do NOT default to an exploded/deconstructed format unless the user asks for it.

## Prompt A — The Starting State
The first image in the sequence. Could be assembled, deconstructed, floating, tilted — whatever the user describes as the starting point.
Always: clean white background (#FFFFFF), photorealistic CGI, soft studio lighting, 16:9 aspect ratio.

## Prompt B — The Middle / Key State
The second image in the sequence. An important intermediate or final state. Could be assembled, mid-animation, upright, etc.
Always: same white background and lighting as Prompt A, matching materials and colors.

## Prompt C — The Video Transition
A video prompt that animates between the states the user described. Be very explicit about:
- START FRAME: exact description of the opening state
- END FRAME: exact description of the final state
- TRANSITION: step-by-step description of the animation stages IN ORDER
- IMPORTANT notes (things to avoid, camera locked, no extra hardware, etc.)
Always: photorealistic CGI, white background, no camera movement, smooth eased motion.

## Rules
- Follow the user's animation description exactly — do NOT impose the scroll-stop exploded/assembled format
- Keep materials, colors, and lighting consistent across all 3 prompts
- Be specific about what makes each stage visually distinct
- tabANaam and tabBNaam should describe the actual states (e.g. "Liggend Samengesteld", "Rechtopstaand", "Exploded View", etc.)

## Output format
Return ONLY a JSON object, no markdown, no explanation:
{
  "promptA": "...",
  "promptB": "...",
  "promptC": "...",
  "objectNaam": "...",
  "tabANaam": "...",
  "tabBNaam": "..."
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
          ? `Genereer 3 animatie prompts op basis van dit logo en de volgende beschrijving:\n\n${description}`
          : "Genereer 3 animatie prompts op basis van dit logo. Maak een mooie vloeiende animatie.",
      },
    ];
  } else {
    userContent = [{ type: "text", text: `Genereer 3 animatie prompts op basis van:\n\n${description}` }];
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({ error: "Geen geldige prompts gegenereerd." }, { status: 500 });

  const prompts = JSON.parse(jsonMatch[0]) as {
    promptA: string;
    promptB: string;
    promptC: string;
    objectNaam: string;
    tabANaam: string;
    tabBNaam: string;
  };

  return NextResponse.json({ ...prompts, bron: description ?? "logo afbeelding" });
}
