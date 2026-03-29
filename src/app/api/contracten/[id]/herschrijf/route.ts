import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { aiComplete } from "@/lib/ai/client";

// POST /api/contracten/[id]/herschrijf
// Body: { tekst: string, instructie: string }
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const { tekst, instructie, volledig } = await req.json() as { tekst: string; instructie: string; volledig?: boolean };

    if (!tekst || !instructie) {
      return NextResponse.json({ fout: "Tekst en instructie zijn verplicht." }, { status: 400 });
    }

    const systemPrompt = volledig
      ? "Je past Nederlandse contracten aan op basis van instructies. Pas ALLEEN aan wat gevraagd wordt — laat de rest van het contract EXACT hetzelfde. Geef het VOLLEDIGE contract terug in hetzelfde markdown format, niet alleen het gewijzigde deel."
      : "Je herschrijft clausules in Nederlandse contracten. Geef alleen de herschreven tekst terug, zonder uitleg of inleiding.";

    const userPrompt = volledig
      ? `Pas het volgende contract aan. Instructie: ${instructie}

VOLLEDIG CONTRACT:
${tekst}

Geef het VOLLEDIGE aangepaste contract terug in hetzelfde markdown format. Verander ALLEEN wat de instructie vraagt.`
      : `Herschrijf de volgende contracttekst. Instructie: ${instructie}

ORIGINELE TEKST:
${tekst}

Geef alleen de herschreven tekst terug, in hetzelfde markdown format als het origineel.`;

    const { text } = await aiComplete({
      provider: "anthropic",
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: volledig ? 8000 : 1000,
    });

    return NextResponse.json({ tekst: text });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Herschrijven mislukt" },
      { status: 500 }
    );
  }
}
