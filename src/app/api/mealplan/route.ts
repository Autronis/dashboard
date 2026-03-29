import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();
    const { kcal, eiwit, koolhydraten, vezels, suiker, vet, voorkeuren, uitsluitingen } = body as {
      kcal: number;
      eiwit: number;
      koolhydraten: number;
      vezels: number;
      suiker: number;
      vet: number;
      voorkeuren?: string;
      uitsluitingen?: string;
    };

    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: `Maak een dagelijks mealplan met exact deze macro's:
- ${kcal} kcal
- ${eiwit}g eiwit
- ${koolhydraten}g koolhydraten
- ${vezels}g vezels
- ${suiker}g suiker
- ${vet}g vet

${voorkeuren ? `Voorkeuren: ${voorkeuren}` : ""}
${uitsluitingen ? `Uitsluitingen (NIET gebruiken): ${uitsluitingen}` : ""}

Geef 5 maaltijden: ontbijt, lunch, tussendoor, avondeten, avondsnack.

Antwoord als JSON:
{
  "maaltijden": [
    {
      "type": "ontbijt",
      "naam": "Havermout met banaan en whey",
      "ingredienten": [
        { "naam": "Havermout", "hoeveelheid": "100g", "kcal": 370, "eiwit": 13, "kh": 60, "vet": 7, "vezels": 10, "suiker": 1 }
      ],
      "totaal": { "kcal": 650, "eiwit": 45, "kh": 80, "vet": 15, "vezels": 12, "suiker": 15 },
      "bereiding": "Korte beschrijving van bereiding"
    }
  ],
  "dagTotaal": { "kcal": 2750, "eiwit": 190, "kh": 300, "vet": 110, "vezels": 30, "suiker": 60 }
}

Zorg dat de dag-totalen zo dicht mogelijk bij de targets zitten (max 5% afwijking). Gebruik realistische portiegroottes. Nederlands eten, makkelijk te bereiden. Alleen JSON.`,
      }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ fout: "Geen response" }, { status: 500 });
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ fout: "Ongeldige response" }, { status: 500 });
    }

    const plan = JSON.parse(jsonMatch[0]);
    return NextResponse.json(plan);
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 500 }
    );
  }
}
