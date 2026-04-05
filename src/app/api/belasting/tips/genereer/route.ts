import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { belastingTips } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";

const anthropic = Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/belasting/tips/genereer — Generate new tips based on user's situation
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const body = await request.json();
    const {
      omzet,
      kosten,
      winst,
      urenBehaald,
      investeringen,
      branche,
      toegepasteTips,
      jaar,
    } = body;

    // Get existing tips to avoid duplicates
    const bestaandeTips = await db.select().from(belastingTips);
    const bestaandeTitels = bestaandeTips.map((t) => t.titel);

    const systemPrompt = `Je bent een fiscaal expert gespecialiseerd in Nederlandse belastingwetgeving voor ZZP'ers en kleine ondernemers (IB-ondernemers).

REGELS:
- Geef ALLEEN tips die 100% juridisch correct zijn voor belastingjaar ${jaar || 2026}
- Verwijs ALTIJD naar de officiële bron (belastingdienst.nl of rvo.nl)
- Gebruik actuele bedragen en percentages
- Geef GEEN tips die al bestaan in de lijst van de gebruiker
- Geef tips die SPECIFIEK relevant zijn voor de situatie van de gebruiker
- Elke tip moet een concrete actie bevatten
- Wees conservatief: liever geen tip dan een foute tip
- Antwoord in het Nederlands

BESTAANDE TIPS (niet herhalen):
${bestaandeTitels.map((t) => `- ${t}`).join("\n")}

TOEGEPASTE TIPS (gebruiker heeft deze al toegepast):
${(toegepasteTips || []).join("\n")}

Antwoord in JSON formaat als array van objecten:
[{
  "categorie": "aftrekpost" | "regeling" | "subsidie" | "optimalisatie" | "weetje",
  "titel": "Korte titel",
  "beschrijving": "Uitgebreide uitleg met concrete actie en bedragen",
  "voordeel": "Concreet voordeel, bijv. '€2.123 extra aftrek'",
  "bron": "URL naar belastingdienst.nl of rvo.nl",
  "bronNaam": "Belastingdienst" of "RVO" of "KVK"
}]

Genereer 3-5 nieuwe, relevante tips.`;

    const userContext = `Mijn situatie (${jaar || 2026}):
- Omzet: €${omzet || "onbekend"}
- Kosten: €${kosten || "onbekend"}
- Winst: €${winst || "onbekend"}
- Gewerkte uren: ${urenBehaald || "onbekend"}
- Investeringen dit jaar: €${investeringen || 0}
- Branche: ${branche || "IT / Software development"}

Genereer nieuwe belastingtips op basis van mijn situatie. Focus op regelingen die ik waarschijnlijk mis.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userContext }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ fout: "Onverwacht AI-antwoord" }, { status: 500 });
    }

    // Parse JSON from response
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ fout: "Kon geen tips genereren" }, { status: 500 });
    }

    const gegenereerd: Array<{
      categorie: "aftrekpost" | "regeling" | "subsidie" | "optimalisatie" | "weetje";
      titel: string;
      beschrijving: string;
      voordeel?: string;
      bron?: string;
      bronNaam?: string;
    }> = JSON.parse(jsonMatch[0]);

    // Filter out duplicates
    const nieuweTips = gegenereerd.filter(
      (tip) => !bestaandeTitels.some((t) => t.toLowerCase() === tip.titel.toLowerCase())
    );

    // Insert new tips
    const opgeslagen = [];
    for (const tip of nieuweTips) {
      const [saved] = await db.insert(belastingTips).values({
        categorie: tip.categorie,
        titel: tip.titel,
        beschrijving: tip.beschrijving,
        voordeel: tip.voordeel || null,
        bron: tip.bron || null,
        bronNaam: tip.bronNaam || null,
        jaar: jaar || null,
        isAiGegenereerd: 1,
      }).returning();
      opgeslagen.push(saved);
    }

    return NextResponse.json({
      tips: opgeslagen,
      gegenereerd: nieuweTips.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("auth")) {
      return NextResponse.json({ fout: "Niet ingelogd" }, { status: 401 });
    }
    return NextResponse.json(
      { fout: "Kon geen tips genereren. Probeer het later opnieuw." },
      { status: 500 }
    );
  }
}
