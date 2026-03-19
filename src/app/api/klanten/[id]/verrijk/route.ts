import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

interface VerrijkResultaat {
  branche: string | null;
  aantalMedewerkers: string | null;
  diensten: string[];
  techStack: string[];
  samenvatting: string | null;
}

async function fetchWebsite(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Autronis-Bot/1.0)",
        Accept: "text/html",
      },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    // Strip tags, scripts, styles to get clean text
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 6000); // Limit to ~6k chars for API
  } finally {
    clearTimeout(timeout);
  }
}

async function analyseMetAI(websiteText: string, bedrijfsnaam: string): Promise<VerrijkResultaat> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY niet geconfigureerd");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 1024,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Je bent een bedrijfsanalist. Analyseer website-tekst en extraheer bedrijfsinformatie. Antwoord altijd in JSON.`,
        },
        {
          role: "user",
          content: `Analyseer de volgende website-tekst van "${bedrijfsnaam}" en geef terug als JSON:
{
  "branche": "de branche/sector (bijv. 'IT & Software', 'Retail', 'Bouw', etc.) of null als onbekend",
  "aantalMedewerkers": "schatting (bijv. '1-10', '11-50', '51-200') of null als onbekend",
  "diensten": ["lijst", "van", "diensten/producten"],
  "techStack": ["technologieen", "die", "ze", "gebruiken"],
  "samenvatting": "1-2 zinnen samenvatting van wat het bedrijf doet"
}

Website-tekst:
${websiteText}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API fout: ${response.status} - ${errText.substring(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Geen antwoord van AI");

  return JSON.parse(content) as VerrijkResultaat;
}

// POST /api/klanten/[id]/verrijk — AI-enrichment via website
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const [klant] = await db.select().from(klanten).where(eq(klanten.id, Number(id)));
    if (!klant) {
      return NextResponse.json({ fout: "Klant niet gevonden." }, { status: 404 });
    }

    let websiteUrl = body.website || klant.website;
    if (!websiteUrl) {
      return NextResponse.json({ fout: "Geen website URL opgegeven." }, { status: 400 });
    }

    // Ensure URL has protocol
    if (!websiteUrl.startsWith("http")) {
      websiteUrl = `https://${websiteUrl}`;
    }

    // Fetch and analyze
    const websiteText = await fetchWebsite(websiteUrl);
    if (websiteText.length < 50) {
      return NextResponse.json({ fout: "Kon onvoldoende tekst van de website ophalen." }, { status: 400 });
    }

    const resultaat = await analyseMetAI(websiteText, klant.bedrijfsnaam);

    // Update klant record
    const updateData: Record<string, unknown> = {
      website: websiteUrl,
      aiVerrijktOp: new Date().toISOString(),
      bijgewerktOp: new Date().toISOString(),
    };

    if (resultaat.branche) updateData.branche = resultaat.branche;
    if (resultaat.aantalMedewerkers) updateData.aantalMedewerkers = resultaat.aantalMedewerkers;
    if (resultaat.diensten?.length) updateData.diensten = JSON.stringify(resultaat.diensten);
    if (resultaat.techStack?.length) updateData.techStack = JSON.stringify(resultaat.techStack);
    if (resultaat.samenvatting && !klant.notities) updateData.notities = resultaat.samenvatting;

    const [bijgewerkt] = await db
      .update(klanten)
      .set(updateData)
      .where(eq(klanten.id, Number(id)))
      .returning();

    return NextResponse.json({
      klant: bijgewerkt,
      verrijking: resultaat,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    const status = message === "Niet geauthenticeerd" ? 401 : 500;
    return NextResponse.json({ fout: message }, { status });
  }
}
