import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

// POST /api/agenda/taken/schat-duur
// Body: { titel, omschrijving?, projectNaam? }
// Returns: { geschatteDuur: number (minuten), toelichting: string }
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();
    const { titel, omschrijving, projectNaam } = body as {
      titel: string;
      omschrijving?: string;
      projectNaam?: string;
    };

    if (!titel) {
      return NextResponse.json({ fout: "Titel is verplicht" }, { status: 400 });
    }

    const prompt = `Je bent een project planning assistent voor een AI- en automatiseringsbureau (Autronis).
Schat hoelang deze taak duurt in minuten. Geef een realistisch antwoord.

Taak: ${titel}
${omschrijving ? `Omschrijving: ${omschrijving}` : ""}
${projectNaam ? `Project: ${projectNaam}` : ""}

Antwoord ALLEEN in dit exacte JSON format, niets anders:
{"geschatteDuur": <getal in minuten>, "toelichting": "<korte uitleg in 1 zin, Nederlands>"}

Richtlijnen:
- Kleine config/fix taken: 15-30 min
- UI aanpassingen: 30-60 min
- Nieuwe feature bouwen: 60-180 min
- Complexe integratie: 120-240 min
- Onderzoek/analyse: 30-90 min
- Meetings/calls: 30-60 min
- Rond af op 15 minuten (15, 30, 45, 60, 90, 120, etc.)`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ geschatteDuur: 60, toelichting: "Standaard schatting" });
    }

    const result = JSON.parse(jsonMatch[0]) as { geschatteDuur: number; toelichting: string };
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    if (message === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: message }, { status: 401 });
    }
    // Fallback bij API error
    return NextResponse.json({ geschatteDuur: 60, toelichting: "Kon geen schatting maken, standaard 1 uur" });
  }
}
