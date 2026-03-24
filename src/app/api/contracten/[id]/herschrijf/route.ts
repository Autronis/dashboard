import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { aiComplete } from "@/lib/ai/client";

// POST /api/contracten/[id]/herschrijf
// Body: { tekst: string, instructie: string }
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const { tekst, instructie } = await req.json() as { tekst: string; instructie: string };

    if (!tekst || !instructie) {
      return NextResponse.json({ fout: "Tekst en instructie zijn verplicht." }, { status: 400 });
    }

    const { text } = await aiComplete({
      provider: "anthropic",
      system: "Je herschrijft clausules in Nederlandse contracten. Geef alleen de herschreven tekst terug, zonder uitleg of inleiding.",
      prompt: `Herschrijf de volgende contracttekst. Instructie: ${instructie}

ORIGINELE TEKST:
${tekst}

Geef alleen de herschreven tekst terug, in hetzelfde markdown format als het origineel.`,
      maxTokens: 1000,
    });

    return NextResponse.json({ tekst: text });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Herschrijven mislukt" },
      { status: 500 }
    );
  }
}
