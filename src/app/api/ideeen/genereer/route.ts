import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ideeen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { sql } from "drizzle-orm";
import { aiComplete } from "@/lib/ai/client";

interface AiIdee {
  naam: string;
  categorie: string;
  omschrijving: string;
  doelgroep: string;
  verdienmodel: string;
  haalbaarheid: number;
  marktpotentie: number;
  fitAutronis: number;
}

export async function POST() {
  try {
    const gebruiker = await requireAuth();

    // Get existing ideas to prevent duplicates
    const bestaande = db
      .select({ naam: ideeen.naam })
      .from(ideeen)
      .all()
      .map((i) => i.naam);

    const { text: tekst } = await aiComplete({
      prompt: `Je bent een business ideeën generator voor Autronis, een AI- en automatiseringsbureau.

Over Autronis:
- Diensten: workflow automatisering (Make.com, n8n), AI integraties (OpenAI, Claude), systeem integraties (CRM, boekhouding, webshops), data & dashboards
- Tech stack: Next.js, n8n, Make.com, OpenAI API, Claude API, Supabase, Vercel
- Doelgroep: MKB-bedrijven breed (van retail tot bouw tot horeca)
- Team: 2 personen (Sem en Syb)

Bestaande ideeën (niet herhalen):
${bestaande.map((n) => `- ${n}`).join("\n")}

Genereer precies 5 NIEUWE ideeën:
- 3 ideeën voor KLANTEN/VERKOOP (producten of diensten die Autronis kan verkopen aan MKB)
- 2 ideeën voor PERSOONLIJK/INTERN gebruik (tools die Sem en Syb zelf kunnen gebruiken)

Per idee geef:
- naam: pakkende korte naam
- categorie: saas | productized_service | intern | dev_tools
- omschrijving: 1-2 zinnen wat het doet
- doelgroep: "klant" of "persoonlijk"
- verdienmodel: 1 zin hoe het geld oplevert (of tijd bespaart bij persoonlijk)
- haalbaarheid: 1-10 (hoe makkelijk te bouwen met huidige stack)
- marktpotentie: 1-10 (hoe groot is de markt/behoefte)
- fitAutronis: 1-10 (hoe goed past het bij Autronis expertise)

Antwoord als JSON array:
[{"naam": "...", "categorie": "...", "omschrijving": "...", "doelgroep": "...", "verdienmodel": "...", "haalbaarheid": 8, "marktpotentie": 7, "fitAutronis": 9}]
Alleen JSON, geen uitleg.`,
      maxTokens: 3000,
    });
    let resultaten: AiIdee[] = [];

    try {
      const match = tekst.match(/\[[\s\S]*\]/);
      if (match) resultaten = JSON.parse(match[0]) as AiIdee[];
    } catch {
      return NextResponse.json(
        { fout: "AI response kon niet geparsed worden" },
        { status: 500 }
      );
    }

    // Get next nummer
    const maxNummer = db
      .select({ max: sql<number>`MAX(nummer)` })
      .from(ideeen)
      .get();
    let nextNummer = (maxNummer?.max || 33) + 1;

    const aangemaakteIdeeen = [];

    const validCategorieen = [
      "dashboard",
      "klant_verkoop",
      "intern",
      "dev_tools",
      "content_media",
      "geld_groei",
      "experimenteel",
      "website",
    ] as const;

    for (const idee of resultaten) {
      const aiScore = Math.round(
        (idee.haalbaarheid + idee.marktpotentie + idee.fitAutronis) / 3
      );

      const categorie = (
        validCategorieen as readonly string[]
      ).includes(idee.categorie)
        ? (idee.categorie as (typeof validCategorieen)[number])
        : "intern";

      const result = db
        .insert(ideeen)
        .values({
          nummer: nextNummer++,
          naam: idee.naam,
          categorie,
          status: "idee",
          omschrijving: idee.omschrijving,
          prioriteit: "normaal",
          doelgroep: idee.doelgroep === "klant" ? "klant" : "persoonlijk",
          verdienmodel: idee.verdienmodel,
          aiScore,
          aiHaalbaarheid: idee.haalbaarheid,
          aiMarktpotentie: idee.marktpotentie,
          aiFitAutronis: idee.fitAutronis,
          isAiSuggestie: 1,
          gepromoveerd: 0,
          aangemaaktDoor: gebruiker.id,
        })
        .returning()
        .all();

      aangemaakteIdeeen.push(result[0]);
    }

    // Sync to backlog file
    try {
      await syncToBacklogFile();
    } catch {
      // Non-critical, continue
    }

    return NextResponse.json({
      resultaat: {
        aangemaakt: aangemaakteIdeeen.length,
        ideeen: aangemaakteIdeeen,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        fout:
          error instanceof Error ? error.message : "Onbekende fout",
      },
      {
        status:
          error instanceof Error &&
          error.message === "Niet geauthenticeerd"
            ? 401
            : 500,
      }
    );
  }
}

async function syncToBacklogFile() {
  const { writeFile } = await import("fs/promises");

  const alleIdeeen = db.select().from(ideeen).orderBy(ideeen.nummer).all();

  const statusEmoji: Record<string, string> = {
    gebouwd: "\u2705",
    actief: "\uD83D\uDFE2",
    uitgewerkt: "\uD83D\uDFE1",
    idee: "\u26AA",
  };

  const catHeaders: Record<string, string> = {
    saas: "SaaS & Producten",
    productized_service: "Productized Services",
    intern: "Interne Tools & Persoonlijk",
    dev_tools: "Claude Code & Dev Tools",
    video: "Video & Visual Content",
    design: "Image & Design Automation",
    website: "Website & Branding",
  };

  // Group by category
  const grouped: Record<string, typeof alleIdeeen> = {};
  for (const idee of alleIdeeen) {
    const cat = idee.categorie || "intern";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(idee);
  }

  let md = `# Autronis Idee\u00EBn Backlog\n\nLaatste update: ${new Date().toISOString().split("T")[0]}\n\n---\n\n`;
  md += `## Status Legenda\n- \u2705 Gebouwd (live)\n- \uD83D\uDFE2 Actief project (in development)\n- \uD83D\uDFE1 Uitgewerkt (klaar om te starten)\n- \u26AA Idee (nog niet uitgewerkt)\n\n---\n\n`;

  for (const [cat, header] of Object.entries(catHeaders)) {
    const items = grouped[cat];
    if (!items || items.length === 0) continue;

    md += `## ${header}\n\n`;
    md += `| # | Naam | Status | Omschrijving |\n`;
    md += `|---|------|--------|-------------|\n`;

    for (const idee of items) {
      const emoji = statusEmoji[idee.status || "idee"] || "\u26AA";
      md += `| ${idee.nummer} | ${idee.naam} | ${emoji} | ${idee.omschrijving || ""} |\n`;
    }

    md += `\n`;
  }

  await writeFile(
    "c:/Users/semmi/OneDrive/Claude AI/Business-ideas/IDEAS_BACKLOG.md",
    md,
    "utf-8"
  );
}
