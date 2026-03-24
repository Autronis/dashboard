import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

// POST /api/agenda/taken/schat-duur
// Body: { titel, omschrijving?, projectNaam? }
// Returns: { geschatteDuur, toelichting, stappen }
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

    const prompt = `Je bent een planning assistent voor Autronis, een AI- en automatiseringsbureau.
Sem werkt hier als developer. Hij bouwt snel en efficiënt met Claude AI.

Schat hoelang deze taak duurt en maak een concreet stappenplan.

Taak: ${titel}
${omschrijving ? `Omschrijving: ${omschrijving}` : ""}
${projectNaam ? `Project: ${projectNaam}` : ""}

BELANGRIJK: Sem werkt met AI-assistentie, dus taken gaan SNELLER dan normaal.
- Bugfix / kleine aanpassing: 15 min
- Config / setup: 15-30 min
- UI component bouwen: 15-30 min
- Nieuwe pagina/feature: 30-60 min
- API endpoint + frontend: 30-45 min
- Complexe integratie: 45-90 min
- Onderzoek/analyse: 15-30 min
- De meeste taken duren 15-45 minuten. Ga NIET boven 90 min tenzij echt complex.

Antwoord ALLEEN in dit exacte JSON format:
{"geschatteDuur": <minuten, rond af op 15>, "toelichting": "<1 zin waarom, NL>", "stappen": ["<stap 1>", "<stap 2>", "<stap 3>"]}

Geef 3-5 concrete, actiegerichte stappen. Kort en bondig.`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({
        geschatteDuur: 30,
        toelichting: "Standaard schatting",
        stappen: [],
      });
    }

    const result = JSON.parse(jsonMatch[0]) as {
      geschatteDuur: number;
      toelichting: string;
      stappen: string[];
    };

    // Cap op 120 min als AI te hoog schat
    if (result.geschatteDuur > 120) result.geschatteDuur = 90;

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    if (message === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: message }, { status: 401 });
    }
    return NextResponse.json({
      geschatteDuur: 30,
      toelichting: "Kon geen schatting maken",
      stappen: [],
    });
  }
}
