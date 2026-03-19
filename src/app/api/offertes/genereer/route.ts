import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { klanten, leads, salesEngineScans, salesEngineKansen, projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, desc } from "drizzle-orm";
import { aiComplete } from "@/lib/ai/client";

interface OfferteRegel {
  omschrijving: string;
  aantal: number;
  eenheidsprijs: number;
}

interface GeneratedOfferte {
  titel: string;
  type: "per_uur" | "fixed" | "retainer";
  scope: string;
  deliverables: string;
  tijdlijn: string;
  regels: OfferteRegel[];
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const body = await request.json();
    const { klantId } = body as { klantId: number };

    if (!klantId) {
      return NextResponse.json({ fout: "klantId is verplicht" }, { status: 400 });
    }

    // Klantgegevens ophalen
    const klant = await db
      .select()
      .from(klanten)
      .where(and(eq(klanten.id, klantId), eq(klanten.isActief, 1)))
      .get();

    if (!klant) {
      return NextResponse.json({ fout: "Klant niet gevonden" }, { status: 404 });
    }

    const uurtarief = klant.uurtarief ?? 125;

    // Bestaande projecten ophalen voor context
    const bestaandeProjecten = await db
      .select({ naam: projecten.naam, status: projecten.status, omschrijving: projecten.omschrijving })
      .from(projecten)
      .where(eq(projecten.klantId, klantId))
      .all();

    // Sales engine scans ophalen via lead (matchen op bedrijfsnaam)
    let scanContext = "";
    try {
      const matchendeLead = await db
        .select({ id: leads.id })
        .from(leads)
        .where(eq(leads.bedrijfsnaam, klant.bedrijfsnaam))
        .get();

      if (matchendeLead) {
        const scan = await db
          .select()
          .from(salesEngineScans)
          .where(
            and(
              eq(salesEngineScans.leadId, matchendeLead.id),
              eq(salesEngineScans.status, "completed")
            )
          )
          .orderBy(desc(salesEngineScans.aangemaaktOp))
          .get();

        if (scan) {
          const kansen = await db
            .select()
            .from(salesEngineKansen)
            .where(eq(salesEngineKansen.scanId, scan.id))
            .all();

          scanContext = `
--- SALES ENGINE ANALYSE ---
Website: ${scan.websiteUrl}
Bedrijfsgrootte: ${scan.bedrijfsgrootte ?? "Onbekend"}
Grootste knelpunt: ${scan.grootsteKnelpunt ?? "Onbekend"}
Huidige tools: ${scan.huidigeTools ?? "Onbekend"}
AI Analyse samenvatting: ${scan.samenvatting ?? "Geen"}
Automation readiness score: ${scan.automationReadinessScore ?? "Onbekend"}/100
Aanbevolen pakket: ${scan.aanbevolenPakket ?? "Onbekend"}

Geïdentificeerde kansen:
${kansen.map((k) => `- ${k.titel} (${k.categorie}, impact: ${k.impact}): ${k.beschrijving}`).join("\n")}
`;
        }
      }
    } catch {
      // Sales engine data is optioneel, skip bij fouten
    }

    const projectContext =
      bestaandeProjecten.length > 0
        ? `\nBestaande projecten bij deze klant:\n${bestaandeProjecten.map((p) => `- ${p.naam} (${p.status}): ${p.omschrijving ?? "geen omschrijving"}`).join("\n")}`
        : "";

    // AI offerte genereren
    const prompt = `Je bent een offerte-assistent voor Autronis, een AI- en automatiseringsbureau.
Genereer een professionele offerte voor de volgende klant.

--- KLANTGEGEVENS ---
Bedrijfsnaam: ${klant.bedrijfsnaam}
Contactpersoon: ${klant.contactpersoon ?? "Onbekend"}
Email: ${klant.email ?? "Onbekend"}
Adres: ${klant.adres ?? "Onbekend"}
Uurtarief: €${uurtarief}
Notities: ${klant.notities ?? "Geen"}
${projectContext}
${scanContext}

--- INSTRUCTIES ---
Genereer een offerte in het Nederlands met:
1. Een pakkende titel voor de offerte
2. Het meest passende offertetype: "per_uur", "fixed", of "retainer"
3. Een scope-omschrijving (wat wordt er gedaan, 2-4 alinea's)
4. Deliverables (wat levert Autronis op, als bullet points gescheiden door newlines)
5. Tijdlijn (geschatte doorlooptijd en fasering)
6. Regelitems met omschrijving, aantal (uren of stuks), en eenheidsprijs (€)

Autronis biedt:
- Workflow automatisering (Make.com, n8n, API-integraties)
- AI integraties (OpenAI, custom agents, AI workflows)
- Systeem integraties (CRM, boekhouding, webshops, databases)
- Data & dashboards (realtime KPIs, rapportages)

Baseer de offerte op alle beschikbare informatie over de klant.
Als er weinig informatie is, maak dan een algemene maar professionele automatiserings-offerte.

Antwoord ALLEEN met valid JSON in dit exacte formaat (geen markdown, geen uitleg):
{
  "titel": "string",
  "type": "per_uur" | "fixed" | "retainer",
  "scope": "string",
  "deliverables": "string (bullet points gescheiden door \\n)",
  "tijdlijn": "string",
  "regels": [
    { "omschrijving": "string", "aantal": number, "eenheidsprijs": number }
  ]
}`;

    const { text: aiText } = await aiComplete({ prompt, maxTokens: 2048 });

    let generated: GeneratedOfferte;
    try {
      generated = JSON.parse(aiText.replace(/```json\n?|\n?```/g, "").trim()) as GeneratedOfferte;
    } catch {
      return NextResponse.json(
        { fout: "AI-antwoord kon niet worden geparsed", raw: aiText },
        { status: 500 }
      );
    }

    // Valideer de structuur
    if (
      !generated.titel ||
      !generated.type ||
      !generated.scope ||
      !generated.regels ||
      !Array.isArray(generated.regels)
    ) {
      return NextResponse.json(
        { fout: "AI-antwoord heeft een onverwacht formaat", raw: generated },
        { status: 500 }
      );
    }

    return NextResponse.json({
      offerte: {
        ...generated,
        klantId,
        uurtarief,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ fout: `Fout bij genereren offerte: ${message}` }, { status: 500 });
  }
}
