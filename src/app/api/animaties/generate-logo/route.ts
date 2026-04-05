import { NextRequest, NextResponse } from "next/server";
import { TrackedAnthropic as Anthropic, type MessageParam } from "@/lib/ai/tracked-anthropic";

const anthropic = Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You generate a single AI video prompt for animating a logo, icon, or product image. The user provides:
1. An image of their logo/icon/product
2. A text description of the desired animation
3. Optionally, one or more animation type tags (e.g., "Opstijgen", "360° draai", "Oplichten")

Your job is to create ONE detailed video prompt that:
- Describes the START FRAME (the uploaded image as-is, centered on white background)
- Describes the END FRAME (the result after the animation)
- Describes the TRANSITION in precise, step-by-step detail
- Is optimized for AI video generators (Runway, Kling, Higgsfield, Pika)

## Animation Tag Reference
When the user selects animation tags, incorporate them:
- Opstijgen: object lifts off the ground, hovers in the air
- Vleugels flappen: wings (if present) flap gracefully
- 360° draai: object rotates 360 degrees around its vertical axis
- Oplichten: object illuminates, glows from within
- Zweven: object floats weightlessly with subtle up/down motion
- Landen: object descends from above and lands gently
- Particle build-up: particles swirl and assemble into the object
- Materiaal transformatie: material changes (e.g., metal → glass → wood)
- Schudden: object shakes/vibrates energetically

Multiple tags can be combined into a fluid sequence.

## Rules
- Keep the white background (#FFFFFF) throughout
- No camera movement — locked-off tripod shot
- Be specific about timing (e.g., "over 1.5 seconds", "brief 0.3s pause")
- Reference exact visual details from the image (colors, materials, shapes)
- The prompt should be self-contained and copy-pasteable into any AI video tool

## Output format
Return ONLY a JSON object, no markdown, no explanation:
{
  "videoPrompt": "The complete video animation prompt",
  "objectNaam": "Name of the logo/object"
}`;

export async function POST(req: NextRequest) {
  const { description, imageBase64, mediaType, animatieTags } = await req.json() as {
    description?: string;
    imageBase64?: string;
    mediaType?: string;
    animatieTags?: string[];
  };

  if (!description?.trim() && !imageBase64) {
    return NextResponse.json({ error: "Geef een beschrijving op." }, { status: 400 });
  }

  const tagsText = animatieTags?.length ? `\n\nGeselecteerde animatie types: ${animatieTags.join(", ")}` : "";

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
          ? `Genereer een video animatie prompt op basis van dit logo/afbeelding en de volgende beschrijving:\n\n${description}${tagsText}`
          : `Genereer een video animatie prompt op basis van dit logo/afbeelding. Maak een mooie vloeiende animatie.${tagsText}`,
      },
    ];
  } else {
    userContent = [{ type: "text", text: `Genereer een video animatie prompt op basis van:\n\n${description}${tagsText}` }];
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({ error: "Geen geldige prompt gegenereerd." }, { status: 500 });

  const result = JSON.parse(jsonMatch[0]) as {
    videoPrompt: string;
    objectNaam: string;
  };

  return NextResponse.json({ ...result, bron: description ?? "logo afbeelding" });
}
