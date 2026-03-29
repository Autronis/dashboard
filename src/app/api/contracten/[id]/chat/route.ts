import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contracten } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { aiComplete } from "@/lib/ai/client";

interface ChatBericht {
  rol: "gebruiker" | "ai";
  tekst: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const { bericht, geschiedenis, risicos } = await req.json() as {
      bericht: string;
      geschiedenis?: ChatBericht[];
      risicos?: { probleem: string; suggestie: string; ernst: string }[];
    };

    if (!bericht?.trim()) {
      return NextResponse.json({ fout: "Bericht is verplicht" }, { status: 400 });
    }

    const [contract] = await db
      .select({ inhoud: contracten.inhoud, type: contracten.type, titel: contracten.titel })
      .from(contracten)
      .where(eq(contracten.id, Number(id)))
      .all();

    if (!contract) {
      return NextResponse.json({ fout: "Contract niet gevonden" }, { status: 404 });
    }

    // Build conversation context
    const risicoContext = risicos?.length
      ? `\n\nEERDERE RISICOSCAN RESULTATEN:\n${risicos.map((r, i) => `${i + 1}. [${r.ernst}] ${r.probleem} → ${r.suggestie}`).join("\n")}`
      : "";

    const gespreksGeschiedenis = geschiedenis?.length
      ? `\n\nEERDERE BERICHTEN IN DIT GESPREK:\n${geschiedenis.map(b => `${b.rol === "gebruiker" ? "GEBRUIKER" : "AI"}: ${b.tekst}`).join("\n\n")}`
      : "";

    const { text: antwoord } = await aiComplete({
      provider: "anthropic",
      system: `Je bent een juridisch adviseur die spart met de gebruiker over een ${contract.type}. Je kent het volledige contract en eventuele risico's uit de risicoscan.

Je rol:
- Help de gebruiker begrijpen wat clausules betekenen
- Adviseer of bepaalde clausules nodig zijn voor hun situatie
- Stel alternatieven voor als iets te streng of te mild is
- Leg juridische termen uit in begrijpelijk Nederlands
- Wees eerlijk — als iets niet nodig is, zeg dat
- Als de gebruiker context geeft (bijv. "het is voor dit en dit"), pas je advies daarop aan

Antwoord bondig en direct. Gebruik bullets waar handig. Schrijf in het Nederlands.

CONTRACT (${contract.titel}):
${contract.inhoud?.slice(0, 8000)}${risicoContext}${gespreksGeschiedenis}`,
      prompt: bericht,
      maxTokens: 1000,
    });

    return NextResponse.json({ antwoord });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Chat mislukt" },
      { status: 500 }
    );
  }
}
