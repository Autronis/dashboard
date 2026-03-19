import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wikiArtikelen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { aiComplete } from "@/lib/ai/client";

// POST /api/wiki/zoeken — AI-powered search
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const { vraag } = await req.json();

    if (!vraag?.trim()) {
      return NextResponse.json({ fout: "Vraag is verplicht." }, { status: 400 });
    }

    // Haal alle gepubliceerde artikelen op
    const artikelen = await db
      .select({
        id: wikiArtikelen.id,
        titel: wikiArtikelen.titel,
        inhoud: wikiArtikelen.inhoud,
        categorie: wikiArtikelen.categorie,
        tags: wikiArtikelen.tags,
      })
      .from(wikiArtikelen)
      .where(eq(wikiArtikelen.gepubliceerd, 1));

    if (artikelen.length === 0) {
      return NextResponse.json({
        antwoord: "Er zijn nog geen artikelen in de kennisbank. Voeg eerst artikelen toe.",
        bronnen: [],
      });
    }

    // Bouw context — titels + snippets voor alle artikelen
    const context = artikelen
      .map((a) => {
        const snippet = (a.inhoud || "").slice(0, 500);
        let tags = "";
        try { tags = a.tags ? JSON.parse(a.tags).join(", ") : ""; } catch { /* noop */ }
        return `[ID:${a.id}] Titel: ${a.titel} | Categorie: ${a.categorie} | Tags: ${tags}\nInhoud: ${snippet}`;
      })
      .join("\n\n");

    const { text: raw } = await aiComplete({
      prompt: `Je bent een AI assistent voor de Autronis kennisbank. Beantwoord de volgende vraag op basis van de beschikbare artikelen.

Vraag: ${vraag}

Beschikbare artikelen:
${context}

Antwoord in het Nederlands. Als je relevante artikelen vindt, verwijs ernaar met hun ID's.
Geef je antwoord als JSON:
{
  "antwoord": "Je antwoord hier (max 3-4 zinnen)",
  "bronnen": [{"id": 1, "titel": "Artikel titel", "relevantie": "Waarom relevant"}]
}

Als er geen relevante artikelen zijn, zeg dat eerlijk. Antwoord alleen met valid JSON.`,
      maxTokens: 800,
    });
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();

    try {
      const result = JSON.parse(cleaned);
      return NextResponse.json(result);
    } catch {
      return NextResponse.json({ antwoord: cleaned, bronnen: [] });
    }
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Zoeken mislukt" },
      { status: 500 }
    );
  }
}
