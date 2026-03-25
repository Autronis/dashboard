import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function scrapeUrl(url: string): Promise<string> {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, formats: ["markdown"] }),
  });

  if (!res.ok) throw new Error(`Firecrawl error: ${res.status}`);
  const data = await res.json() as { success: boolean; data?: { markdown?: string } };
  if (!data.success || !data.data?.markdown) throw new Error("Geen content gevonden");
  return data.data.markdown.slice(0, 6000);
}

const SYSTEM_PROMPT = `You generate a coordinated set of 3 prompts that work together to produce scroll-stopping video content: a clean product shot, its deconstructed version, and a video transition between them.

## Prompt A — The Assembled Shot

A clean hero product image. Use this template and customize for the specific object:

Professional product photography of a [OBJECT] centered in frame, shot from a 3/4 angle.
Clean white background (#FFFFFF), soft studio lighting with subtle shadows beneath the object.
The [OBJECT] is pristine, brand-new, fully assembled and closed/complete.
Photorealistic rendering, 16:9 aspect ratio, product catalog quality. Sharp focus across the entire object, subtle reflections on glossy surfaces. Minimal, elegant, Apple-style product photography. No text, no logos, no other objects in frame.
Shot on Phase One IQ4 150MP, 120mm macro lens, f/8, studio strobe lighting with large softbox above and white bounce cards on sides. Ultra-sharp detail, 8K quality downsampled to 4K.

Customize: adjust camera angle, add material-specific details (brushed aluminum, matte plastic, leather texture), specify the state. Always keep white background.

## Prompt B — The Deconstructed Shot

Exploded/disassembled version — object elegantly taken apart, each piece floating in space.

Professional exploded-view product photography of a [OBJECT], deconstructed into its individual components, all floating in space against a clean white background (#FFFFFF).
Every internal component is visible and separated: [LIST 8-15 SPECIFIC REAL COMPONENTS].
Each piece floats with even spacing, maintaining spatial relationships. Arrangement follows a vertical or diagonal explosion axis.
Soft studio lighting with subtle shadows on each floating piece. Components are pristine and detailed.
Photorealistic rendering, 16:9 aspect ratio. Shot on Phase One IQ4 150MP, focus-stacked. Same lighting as assembled shot.

Component accuracy matters — use real components for the object type. For food/beverages use "explosion" style (freeze-frame, 1/10000s).

## Prompt C — The Video Transition

START FRAME: A fully assembled [OBJECT] sitting centered on a white background, product photography style, soft studio lighting.
END FRAME: The same [OBJECT] elegantly deconstructed into an exploded view — every component floating in space, separated along a vertical axis, maintaining spatial relationships.
TRANSITION: Smooth, satisfying mechanical deconstruction. The object begins whole and still. After a brief pause (0.5s), pieces begin to separate — starting from the outer shell and progressively revealing inner components. Each piece lifts and floats outward along clean, deliberate paths. Movement is eased (slow-in, slow-out) with slight rotations. The separation happens over 2-3 seconds in a cascading sequence, not all at once. Final floating arrangement holds for 1 second.
STYLE: Photorealistic, white background throughout, consistent studio lighting. No camera movement — locked-off tripod shot. Satisfying, ASMR-like mechanical precision.
DURATION: 4-5 seconds total. ASPECT RATIO: 16:9. QUALITY: High fidelity, smooth 24fps or higher.

## Best Practices
- Consistency is key — assembled and deconstructed must look like the same object (same materials, colors, lighting, angle)
- White background always — critical for clean video transition
- Component accuracy — don't make up parts, use real components
- The video prompt is model-agnostic — works in Higgsfield, Runway, Kling, Pika

## Output format

Return ONLY a JSON object with these exact fields, no markdown, no explanation:
{
  "promptA": "...",
  "promptB": "...",
  "promptC": "...",
  "objectNaam": "...",
  "tabANaam": "Assembled Shot",
  "tabBNaam": "Deconstructed View"
}`;

export async function POST(req: NextRequest) {
  const { url, product, imageBase64, mediaType } = await req.json() as {
    url?: string;
    product?: string;
    imageBase64?: string;
    mediaType?: string;
  };

  let bronLabel = product ?? url ?? "afbeelding";
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
          ? `Analyseer dit product/logo en genereer 3 scroll-stop prompts voor Higgsfield Nano Banana 2. Gebruik de exacte kleuren, materialen en vormen die je ziet in de afbeelding.\n\nExtra instructies: ${product}`
          : "Analyseer dit product/logo en genereer 3 scroll-stop prompts voor Higgsfield Nano Banana 2. Gebruik de exacte kleuren, materialen en vormen die je ziet in de afbeelding.",
      },
    ];
    bronLabel = product ?? "geüploade afbeelding";
  } else if (url) {
    try {
      const scraped = await scrapeUrl(url);
      userContent = [{ type: "text", text: `Genereer 3 scroll-stop prompts voor Higgsfield Nano Banana 2 op basis van:\n\nWebsite content:\n${scraped}` }];
      bronLabel = url;
    } catch {
      return NextResponse.json({ error: "Kon URL niet scrapen. Probeer een productnaam." }, { status: 400 });
    }
  } else if (product) {
    userContent = [{ type: "text", text: `Genereer 3 scroll-stop prompts voor Higgsfield Nano Banana 2 op basis van:\n\nProduct: ${product}` }];
  } else {
    return NextResponse.json({ error: "Geef een URL, productnaam of afbeelding op." }, { status: 400 });
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

  return NextResponse.json({ ...prompts, bron: bronLabel });
}
