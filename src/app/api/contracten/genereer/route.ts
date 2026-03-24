import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { klanten, bedrijfsinstellingen, offertes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateContractPrompt, type ContractType } from "@/lib/contract-templates";
import { aiComplete } from "@/lib/ai/client";

// POST /api/contracten/genereer
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();

    const { klantId, type, details, offerteId } = body as {
      klantId: number;
      type: ContractType;
      details?: string;
      offerteId?: number;
    };

    if (!klantId || !type) {
      return NextResponse.json({ fout: "Klant en type zijn verplicht." }, { status: 400 });
    }

    const [klant] = await db
      .select({
        bedrijfsnaam: klanten.bedrijfsnaam,
        contactpersoon: klanten.contactpersoon,
        uurtarief: klanten.uurtarief,
      })
      .from(klanten)
      .where(eq(klanten.id, klantId))
      .all();

    if (!klant) {
      return NextResponse.json({ fout: "Klant niet gevonden." }, { status: 404 });
    }

    const [bedrijf] = await db.select().from(bedrijfsinstellingen).limit(1).all();
    const bedrijfsnaam = bedrijf?.bedrijfsnaam || "Autronis";

    // Offerte context ophalen indien gekoppeld
    let offerteContext = "";
    if (offerteId) {
      const [offerte] = await db
        .select({
          offertenummer: offertes.offertenummer,
          scope: offertes.scope,
          bedragExclBtw: offertes.bedragExclBtw,
          type: offertes.type,
          tijdlijn: offertes.tijdlijn,
        })
        .from(offertes)
        .where(eq(offertes.id, offerteId))
        .all();

      if (offerte) {
        offerteContext = `
Gebaseerd op offerte ${offerte.offertenummer}:
- Projectscope: ${offerte.scope || "niet opgegeven"}
- Waarde: €${offerte.bedragExclBtw} excl. BTW
- Facturatietype: ${offerte.type || "niet opgegeven"}
- Tijdlijn: ${offerte.tijdlijn || "niet opgegeven"}`;
      }
    }

    // Klant-specifieke context
    const klantContext = [
      klant.uurtarief ? `Uurtarief: €${klant.uurtarief}/uur` : "",
      klant.contactpersoon ? `Contactpersoon: ${klant.contactpersoon}` : "",
      details || "",
      offerteContext,
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = generateContractPrompt(type, bedrijfsnaam, klant.bedrijfsnaam, klant.contactpersoon, klantContext);

    const { text: inhoud } = await aiComplete({
      provider: "anthropic",
      system:
        "Je bent een juridisch assistent die professionele Nederlandse contracten schrijft voor een AI- en automatiseringsbureau. Schrijf beknopt, professioneel en in goed Nederlands. Gebruik markdown formatting met ## voor artikelkoppen. Vul namen, tarieven en specifieke details altijd concreet in — gebruik geen placeholders zoals [NAAM] of [BEDRAG].",
      prompt,
      maxTokens: 4000,
    });

    return NextResponse.json({ inhoud });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
