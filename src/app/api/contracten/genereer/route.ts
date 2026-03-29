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

    const { klantId, type, details, offerteId, referentieText } = body as {
      klantId: number;
      type: ContractType;
      details?: string;
      offerteId?: number;
      referentieText?: string;
    };

    if (!klantId || !type) {
      return NextResponse.json({ fout: "Klant en type zijn verplicht." }, { status: 400 });
    }

    const [klant] = await db
      .select({
        bedrijfsnaam: klanten.bedrijfsnaam,
        contactpersoon: klanten.contactpersoon,
        uurtarief: klanten.uurtarief,
        adres: klanten.adres,
        email: klanten.email,
        kvkNummer: klanten.kvkNummer,
        btwNummer: klanten.btwNummer,
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
      klant.contactpersoon ? `Contactpersoon: ${klant.contactpersoon}` : "",
      klant.adres ? `Adres klant: ${klant.adres}` : "",
      klant.email ? `E-mail klant: ${klant.email}` : "",
      klant.kvkNummer ? `KvK-nummer klant: ${klant.kvkNummer}` : "",
      klant.btwNummer ? `BTW-nummer klant: ${klant.btwNummer}` : "",
      klant.uurtarief ? `Uurtarief: €${klant.uurtarief}/uur` : "",
      details || "",
      offerteContext,
    ]
      .filter(Boolean)
      .join("\n");

    // Bedrijfsgegevens context
    const bedrijfContext = [
      `Bedrijfsnaam opdrachtnemer: ${bedrijfsnaam}`,
      bedrijf?.adres ? `Adres: ${bedrijf.adres}` : "",
      bedrijf?.kvkNummer ? `KvK-nummer: ${bedrijf.kvkNummer}` : "",
      bedrijf?.btwNummer ? `BTW-nummer: ${bedrijf.btwNummer}` : "",
      bedrijf?.email ? `E-mail: ${bedrijf.email}` : "",
      bedrijf?.iban ? `IBAN: ${bedrijf.iban}` : "",
    ].filter(Boolean).join("\n");

    const prompt = generateContractPrompt(type, bedrijfsnaam, klant.bedrijfsnaam, klant.contactpersoon, klantContext);

    // Add reference document context if provided
    const referentieContext = referentieText
      ? `\n\nREFERENTIE DOCUMENT (gebruik als basis/inspiratie — neem relevante clausules, structuur en voorwaarden over maar pas aan voor deze specifieke situatie):\n${referentieText.slice(0, 15000)}`
      : "";

    const { text: inhoud } = await aiComplete({
      provider: "anthropic",
      system:
        `Je bent een senior juridisch adviseur gespecialiseerd in Nederlands ondernemingsrecht, contractenrecht en IT-recht. Je schrijft contracten op het niveau van een advocatenkantoor.

KWALITEITSEISEN:
- Elk contract moet juridisch waterdicht zijn en direct ondertekend kunnen worden
- Schrijf in correct, professioneel juridisch Nederlands — geen informeel taalgebruik
- Elk artikel moet volledig uitgeschreven zijn met concrete bepalingen, geen vage formuleringen
- Gebruik exacte bedragen, data en termijnen waar beschikbaar
- Neem altijd op: boeteclausules, aansprakelijkheidsbeperkingen, overmacht, toepasselijk recht (Nederlands), geschillenregeling
- Verwijs waar relevant naar Nederlands recht (BW, Handelsregisterwet, etc.)

GEGEVENS OPDRACHTNEMER:
${bedrijfContext}

FORMATTING:
- Vul ALLE gegevens concreet in — NOOIT placeholders zoals [adres], [KvK-nummer], [bedrag]
- Als gegevens ontbreken, laat die regel weg — vul NOOIT fictieve gegevens in
- Gebruik markdown ## voor artikelkoppen
- Nummer elk artikel en subartikel (1.1, 1.2, etc.)`,
      prompt: prompt + referentieContext,
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
