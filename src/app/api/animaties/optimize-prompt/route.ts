import { NextRequest, NextResponse } from "next/server";
import { TrackedAnthropic as Anthropic, type MessageParam } from "@/lib/ai/tracked-anthropic";

const anthropic = Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert AI image prompt engineer. Your job depends on whether the user provides an IMAGE or only TEXT:

## IF AN IMAGE IS PROVIDED:
Describe EXACTLY what you SEE in the image. Do NOT invent or reimagine the object.
- Describe the actual materials, colors, shapes, and components visible
- Note every visible detail: textures, finishes, glow effects, cables, ports, panels
- Create a manifest listing each component you can identify in the image
- If a VISUAL STYLE is specified, adapt your description to emphasize matching elements

## IF ONLY TEXT IS PROVIDED:
Transform the text into a rich product description.
- If abstract (service/concept), visualize it as a physical device representing that concept
- If a VISUAL STYLE is specified, design the product entirely in that style

## ALWAYS:
- Keep the description to 3-5 sentences
- Be specific, not generic — describe exact materials (e.g. "frosted borosilicate glass" not "glass")
- DO NOT include photography/camera instructions
- The manifest should list 8-15 components with: name, material, color, size, position, quantity

If a VISUAL STYLE is specified, ALL materials and colors must match that style.

Return ONLY a JSON object:
{
  "optimizedPrompt": "The detailed product description based on what you see/imagine",
  "productName": "Short product name",
  "objectNaam": "Product name for manifest header",
  "manifest": "Complete component manifest, one per line with • prefix"
}`;

export async function POST(req: NextRequest) {
  const { description, imageBase64, mediaType, images, stylePrompt } = await req.json() as {
    description?: string;
    imageBase64?: string;
    mediaType?: string;
    images?: { base64: string; mediaType: string }[];
    stylePrompt?: string;
  };

  if (!description?.trim() && !imageBase64 && (!images || images.length === 0)) {
    return NextResponse.json({ error: "Geef een beschrijving op." }, { status: 400 });
  }

  let userContent: MessageParam["content"] = [];

  const styleContext = stylePrompt ? `\n\nVISUAL STYLE (VERPLICHT — pas alle materialen, kleuren en sfeer aan op deze stijl):\n${stylePrompt}` : "";

  // Support multiple reference images
  const allImages = images ?? (imageBase64 && mediaType ? [{ base64: imageBase64, mediaType }] : []);

  if (allImages.length > 0) {
    for (const img of allImages) {
      userContent.push({
        type: "image",
        source: { type: "base64", media_type: img.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: img.base64 },
      });
    }
    userContent.push({
      type: "text",
      text: `BELANGRIJK: Beschrijf EXACT wat je ZIET in ${allImages.length > 1 ? "deze afbeeldingen" : "deze afbeelding"}. ${allImages.length > 1 ? "Combineer de elementen uit alle afbeeldingen — gebruik de vormen/producten uit de ene en de content/data uit de andere." : "Beschrijf de echte materialen, kleuren, vormen en onderdelen die zichtbaar zijn."} Verzin NIETS — beschrijf alleen wat er is.${description ? ` Extra context van de gebruiker: ${description}` : ""}${styleContext}`,
    });
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
