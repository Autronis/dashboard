import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";

const anthropic = Anthropic(undefined, "/api/agenda/taken/schat-duur");

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

    const prompt = `Je schat taakduur voor Sem (Autronis). Hij werkt met Claude AI en bouwt extreem snel.

Taak: ${titel}
${omschrijving ? `Omschrijving: ${omschrijving}` : ""}
${projectNaam ? `Project: ${projectNaam}` : ""}

DUUR REGELS — volg dit STRIKT, overschat NOOIT:
- Bugfix / config / kleine aanpassing: 15 min
- UI component / API endpoint: 15 min
- Nieuwe pagina of feature: 15-30 min
- Meerdere pagina's + API + database: 30 min
- Enorm complexe multi-systeem integratie: 45 min MAX

80% van alle taken duurt 15 minuten. Kies bij twijfel ALTIJD 15 min.
Het absolute maximum is 45 minuten — NOOIT hoger.

Antwoord ALLEEN in dit exacte JSON format:
{"geschatteDuur": <15 of 30 of 45>, "toelichting": "<1 zin, NL>", "stappen": ["<stap 1>", "<stap 2>", "<stap 3>"]}

Geef 3-5 korte stappen.`;

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

    // Cap op 45 min, rond af op 15
    if (result.geschatteDuur > 45) result.geschatteDuur = 45;
    result.geschatteDuur = Math.round(result.geschatteDuur / 15) * 15 || 15;

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
