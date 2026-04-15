import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";

// POST /api/site-rebuild/optimize-instructies
// Body: { notes: string, url?: string, brandNaam?: string }
// Neemt Sem's korte input ("focus op zorg") en expand'et naar een
// gedetailleerde extra-instructies briefing die de site-rebuild
// generator kan gebruiken voor betere output.
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = (await req.json()) as {
      notes?: string;
      url?: string;
      brandNaam?: string;
    };

    const notes = body.notes?.trim();
    if (!notes || notes.length < 2) {
      return NextResponse.json(
        { fout: "Geef minimaal een paar woorden als input" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { fout: "ANTHROPIC_API_KEY niet ingesteld" },
        { status: 500 }
      );
    }

    const client = Anthropic(
      { apiKey },
      "/api/site-rebuild/optimize-instructies"
    );

    const context = [
      body.brandNaam ? `Brand: ${body.brandNaam}` : null,
      body.url ? `URL: ${body.url}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = `Je bent een senior product designer + copywriter die designbriefings opstelt voor een AI website generator. Sem geeft je een hele korte input ("focus op zorg" of "moet meer eruitzien als apple") en jij maakt er een concrete, uitvoerbare design briefing van die de generator daadwerkelijk kan gebruiken.

${context ? `CONTEXT:\n${context}\n\n` : ""}SEM'S INPUT:
${notes}

EISEN voor jouw output:
- 3-7 bullet points (korte zinnen, max 15 woorden elk)
- Concreet en uitvoerbaar — geen vage termen als "modern" of "professioneel" zonder context
- Mix van: doelgroep, kleur/typografie hints, layout/sectie suggesties, tone of voice, eventueel content suggesties
- Sluit aan bij wat Sem aangeeft, niet je eigen agenda
- Als Sem iets noemt over de doelgroep → maak die specifiek (leeftijd, context, beslissingsmoment)
- Als Sem iets noemt over de branche → noem branchespecifieke elementen
- NL, directe stijl, geen marketing jargon

OUTPUT format: alleen de bullets, geen kop, geen disclaimer. Bullets met "- " prefix, één per regel. Maximaal 600 tekens totaal.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0]?.type === "text"
        ? response.content[0].text.trim()
        : "";

    if (!text) {
      return NextResponse.json(
        { fout: "Claude returnde lege response" },
        { status: 500 }
      );
    }

    return NextResponse.json({ instructies: text });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      {
        status:
          error instanceof Error && error.message === "Niet geauthenticeerd"
            ? 401
            : 500,
      }
    );
  }
}
