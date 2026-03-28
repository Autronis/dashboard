import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a product analysis expert. Your job is to create a detailed component manifest for a product/object that will be used to generate consistent AI image prompts.

Analyze the product and create an EXACT list of all visible components with:
- Component name
- Material (e.g., brushed aluminum, matte black plastic, tempered glass)
- Color (exact, e.g., "space gray", "chrome silver", "matte black")
- Size relative to the whole (e.g., "groot", "klein", "medium")
- Position in the assembled object (e.g., "bovenkant", "linkerzijde", "intern")
- Quantity if multiple (e.g., "4x", "2x links + 2x rechts")

Be SPECIFIC and ACCURATE. For example:
- "4x chrome tandwielen (2 groot Ø3cm, 2 klein Ø1.5cm)"
- "1x matte zwarte ABS behuizing (bovenschaal)"
- "6x gehard glazen panelen (2 links, 2 rechts, 1 boven, 1 onder) - smoke getint"
- "1x RVS voetplaat met rubberen antislip pads (4x)"

Use real, plausible components for the product type. Don't invent fantasy parts.

Return ONLY a JSON object:
{
  "objectNaam": "Product name",
  "manifest": "The complete component manifest as a readable text block, one component per line with bullet points"
}`;

export async function POST(req: NextRequest) {
  const { url, product, imageBase64, mediaType } = await req.json() as {
    url?: string;
    product?: string;
    imageBase64?: string;
    mediaType?: string;
  };

  let userContent: MessageParam["content"] = [];

  if (imageBase64 && mediaType) {
    userContent = [
      {
        type: "image",
        source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: imageBase64 },
      },
      {
        type: "text",
        text: product
          ? `Analyseer dit product en maak een gedetailleerd onderdelen manifest. Extra context: ${product}`
          : "Analyseer dit product en maak een gedetailleerd onderdelen manifest op basis van wat je ziet.",
      },
    ];
  } else if (product) {
    userContent = [{ type: "text", text: `Maak een gedetailleerd onderdelen manifest voor: ${product}` }];
  } else {
    return NextResponse.json({ error: "Geef een productnaam of afbeelding op." }, { status: 400 });
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({ error: "Kon geen manifest genereren." }, { status: 500 });

  const result = JSON.parse(jsonMatch[0]) as {
    objectNaam: string;
    manifest: string;
  };

  return NextResponse.json(result);
}
