import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert AI image prompt engineer AND product analysis specialist. The user gives you a simple product description (e.g. "Nike Air Max 90", "espresso machine", "process automation"). Your job is to:

1. Transform this into a rich, detailed product description optimized for AI image generation
2. Create a detailed component manifest listing all visible parts

CRITICAL: If a VISUAL STYLE is specified in the user message, you MUST design the product entirely in that style. ALL materials, colors, textures, and components must match the specified style. The style dictates everything — the product should look like it was manufactured in that aesthetic.

For the PRODUCT DESCRIPTION include:
- A product name that incorporates the style (e.g. "Glass Morphism Process Automation Machine" or "Matte Black Espresso Hub")
- Materials that match the specified style EXACTLY
- Colors that match the specified style EXACTLY
- Key visual details matching the style (textures, finishes, reflections, glow effects)
- Shape and form description
- Notable design elements fitting the style
- State of the product (new, pristine)

For the COMPONENT MANIFEST include each visible component with:
- Component name
- Material (MUST match the visual style — e.g. for Glass Morphism: borosilicate glass, chrome, brushed steel)
- Color (MUST match the visual style — e.g. for Glass Morphism: ice-blue transparent, chrome silver, teal glow)
- Size relative to the whole ("groot", "klein", "medium")
- Position in the assembled object ("bovenkant", "linkerzijde", "intern")
- Quantity if multiple ("4x", "2x links + 2x rechts")

If the input is abstract (like a service or concept), visualize it as a physical product/device that REPRESENTS that concept in the specified style. For example: "process automation" with Glass Morphism style → a futuristic transparent glass automation control hub with chrome gears, glowing cyan data tubes, and teal LED indicators.

DO NOT include photography instructions, camera info, or prompt syntax in the description.

Keep the description to 3-5 sentences. Be specific, not generic. Make it vivid and detailed.
The manifest should list 8-15 components with bullet points.

Return ONLY a JSON object:
{
  "optimizedPrompt": "The detailed product description",
  "productName": "Short product name",
  "objectNaam": "Product name for manifest header",
  "manifest": "Complete component manifest as readable text, one component per line with bullet points (• prefix)"
}`;

export async function POST(req: NextRequest) {
  const { description, imageBase64, mediaType, stylePrompt } = await req.json() as {
    description?: string;
    imageBase64?: string;
    mediaType?: string;
    stylePrompt?: string;
  };

  if (!description?.trim() && !imageBase64) {
    return NextResponse.json({ error: "Geef een beschrijving op." }, { status: 400 });
  }

  let userContent: MessageParam["content"] = [];

  const styleContext = stylePrompt ? `\n\nVISUAL STYLE (VERPLICHT — pas alle materialen, kleuren en sfeer aan op deze stijl):\n${stylePrompt}` : "";

  if (imageBase64 && mediaType) {
    userContent = [
      {
        type: "image",
        source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: imageBase64 },
      },
      {
        type: "text",
        text: (description
          ? `Beschrijf dit product in detail en maak een onderdelen manifest. Extra context: ${description}`
          : "Beschrijf dit product in detail en maak een onderdelen manifest.") + styleContext,
      },
    ];
  } else {
    userContent = [{ type: "text", text: `Beschrijf dit product in detail en maak een onderdelen manifest: ${description}${styleContext}` }];
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({ error: "Kon prompt niet optimaliseren." }, { status: 500 });

  const result = JSON.parse(jsonMatch[0]) as {
    optimizedPrompt: string;
    productName: string;
    objectNaam: string;
    manifest: string;
  };

  return NextResponse.json(result);
}
