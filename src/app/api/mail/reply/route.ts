import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const formData = await req.formData();
    const screenshot = formData.get("screenshot") as File | null;
    const context = formData.get("context") as string | null;
    const toon = (formData.get("toon") as string) || "professioneel";

    if (!screenshot) {
      return NextResponse.json({ fout: "Geen screenshot geüpload" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ fout: "ANTHROPIC_API_KEY niet geconfigureerd" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });
    const buffer = Buffer.from(await screenshot.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mediaType = screenshot.type.startsWith("image/") ? screenshot.type : "image/jpeg";

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: base64,
              },
            },
            {
              type: "text",
              text: `Je bent de e-mail assistent van Autronis, een AI- en automatiseringsbureau voor MKB.

Analyseer deze screenshot van een e-mail en stel een passend antwoord op.

Toon: ${toon}
${context ? `Extra context: ${context}` : ""}

Geef je antwoord als JSON:
{
  "afzender": "naam en/of e-mailadres van de afzender",
  "onderwerp": "onderwerp van de originele mail",
  "samenvatting": "korte samenvatting van wat de mail vraagt/zegt",
  "reactieNodig": true/false,
  "antwoord": "het volledige concept-antwoord in het Nederlands, klaar om te verzenden",
  "suggesties": ["optionele alternatieve aanpak 1", "alternatief 2"]
}

Schrijf het antwoord alsof het van Sem komt (founder van Autronis). Houd het zakelijk maar vriendelijk. Alleen JSON, geen uitleg.`,
            },
          ],
        },
      ],
    });

    const tekst = response.content[0].type === "text" ? response.content[0].text : "";

    let parsed: {
      afzender?: string;
      onderwerp?: string;
      samenvatting?: string;
      reactieNodig?: boolean;
      antwoord?: string;
      suggesties?: string[];
    } = {};

    try {
      const match = tekst.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch {
      parsed = { antwoord: tekst, reactieNodig: true };
    }

    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
