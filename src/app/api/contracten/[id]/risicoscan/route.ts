import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contracten } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { aiCompleteJson } from "@/lib/ai/client";

interface Risico {
  alinea: string;
  probleem: string;
  ernst: "hoog" | "midden" | "laag";
  suggestie: string;
}

// POST /api/contracten/[id]/risicoscan
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const [contract] = await db
      .select({ inhoud: contracten.inhoud, type: contracten.type })
      .from(contracten)
      .where(eq(contracten.id, Number(id)))
      .all();

    if (!contract) {
      return NextResponse.json({ fout: "Contract niet gevonden." }, { status: 404 });
    }

    const risicos = await aiCompleteJson<Risico[]>({
      provider: "anthropic",
      system: "Je bent een juridisch expert die Nederlandse contracten analyseert op risico's en lacunes.",
      prompt: `Analyseer dit ${contract.type} op juridische risico's, onduidelijkheden en ontbrekende clausules.

CONTRACT:
${contract.inhoud}

Geef een JSON array van risico's. Elk risico heeft:
- alinea: de eerste 80 tekens van de betreffende passage (of "Ontbrekend" als het volledig mist)
- probleem: wat er mis is (1-2 zinnen, NL)
- ernst: "hoog" | "midden" | "laag"
- suggestie: concreet wat toegevoegd/aangepast moet worden (1-2 zinnen, NL)

Geef 3-7 risico's. Alleen echte problemen, geen trivialiteiten.
Antwoord ALLEEN met een JSON array, geen extra tekst.`,
      maxTokens: 1500,
    });

    return NextResponse.json({ risicos });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Scan mislukt" },
      { status: 500 }
    );
  }
}
