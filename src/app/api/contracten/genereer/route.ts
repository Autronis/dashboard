import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { klanten, bedrijfsinstellingen } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateContractPrompt, type ContractType } from "@/lib/contract-templates";

// POST /api/contracten/genereer
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();

    const { klantId, type, details } = body as {
      klantId: number;
      type: ContractType;
      details: string;
    };

    if (!klantId || !type) {
      return NextResponse.json({ fout: "Klant en type zijn verplicht." }, { status: 400 });
    }

    // Fetch klant info
    const [klant] = db
      .select({
        bedrijfsnaam: klanten.bedrijfsnaam,
        contactpersoon: klanten.contactpersoon,
      })
      .from(klanten)
      .where(eq(klanten.id, klantId))
      .all();

    if (!klant) {
      return NextResponse.json({ fout: "Klant niet gevonden." }, { status: 404 });
    }

    // Fetch bedrijf info
    const [bedrijf] = db.select().from(bedrijfsinstellingen).limit(1).all();
    const bedrijfsnaam = bedrijf?.bedrijfsnaam || "Autronis";

    const prompt = generateContractPrompt(
      type,
      bedrijfsnaam,
      klant.bedrijfsnaam,
      klant.contactpersoon,
      details || ""
    );

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ fout: "OpenAI API key niet geconfigureerd." }, { status: 500 });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Je bent een juridisch assistent die professionele Nederlandse contracten schrijft voor een AI- en automatiseringsbureau. Schrijf beknopt, professioneel en in goed Nederlands. Gebruik markdown formatting met ## voor artikelkoppen.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.4,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ fout: `AI fout: ${err}` }, { status: 500 });
    }

    const data = await response.json();
    const inhoud = data.choices?.[0]?.message?.content || "";

    return NextResponse.json({ inhoud });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
