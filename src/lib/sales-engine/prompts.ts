import type { ScrapeResult } from "./scraper";

interface CalComContext {
  bedrijfsnaam: string;
  bedrijfsgrootte: string;
  rol: string;
  grootsteKnelpunt: string;
  huidigeTools: string;
}

export function buildAnalysisPrompt(scrapeResult: ScrapeResult, context: CalComContext): string {
  const websiteData = JSON.stringify(
    {
      homepage: {
        title: scrapeResult.homepage.title,
        metaDescription: scrapeResult.homepage.metaDescription,
        headings: scrapeResult.homepage.headings,
        bodyText: scrapeResult.homepage.bodyText,
      },
      subpaginas: scrapeResult.subpaginas.map((p) => ({
        url: p.url,
        title: p.title,
        headings: p.headings,
        bodyText: p.bodyText,
      })),
      techStack: scrapeResult.techStack,
      formulieren: scrapeResult.formulieren,
      chatWidgets: scrapeResult.chatWidgets,
      socialMedia: scrapeResult.socialMedia,
    },
    null,
    2
  );

  return `Je bent een business analyst voor Autronis, een AI- en automatiseringsbureau dat MKB-bedrijven helpt slimmer en efficiënter te werken.

Autronis biedt deze diensten aan:
- Workflow automatisering (Make.com, n8n, API-integraties)
- AI integraties (OpenAI API, custom agents, AI workflows)
- Systeem integraties (CRM, boekhouding, webshops, databases)
- Data & dashboards (realtime KPIs, rapportages, BI)

Een prospect heeft een gesprek geboekt. Analyseer hun bedrijf en identificeer automatiseringskansen.

## Prospect Context (uit booking formulier)
- Bedrijfsnaam: ${context.bedrijfsnaam}
- Bedrijfsgrootte: ${context.bedrijfsgrootte}
- Rol van de booker: ${context.rol}
- Grootste knelpunt: ${context.grootsteKnelpunt}
- Huidige tools: ${context.huidigeTools || "Niet opgegeven"}

## Website Scan Data
${websiteData}

## Opdracht

Analyseer het bedrijf en identificeer 5 tot 10 automatiseringskansen die Autronis kan bouwen. Focus op kansen die:
1. Direct aansluiten bij het genoemde knelpunt
2. Passen bij de huidige tech stack en tools
3. Concrete, meetbare tijdsbesparing opleveren
4. Een duidelijke ROI hebben

Geef je antwoord als JSON in exact dit formaat (geen andere tekst, alleen JSON):

{
  "bedrijfsProfiel": {
    "branche": "De branche/sector van het bedrijf",
    "watZeDoen": "Korte omschrijving van kernactiviteiten (1-2 zinnen)",
    "doelgroep": "B2B/B2C en type klanten"
  },
  "kansen": [
    {
      "titel": "Korte titel van de automatiseringskans",
      "beschrijving": "Uitleg: huidige situatie, wat Autronis kan bouwen, en het verwachte resultaat. 2-3 zinnen, concreet en specifiek voor dit bedrijf.",
      "categorie": "workflow | crm | e-commerce | marketing | klantenservice | facturatie | planning | lead_gen | communicatie | administratie | data | content",
      "impact": "hoog | midden | laag",
      "geschatteTijdsbesparing": "X uur per week",
      "geschatteKosten": "€X-Y (implementatiekosten)",
      "geschatteBesparing": "€X-Y per jaar (besparing)",
      "implementatieEffort": "laag | midden | hoog",
      "prioriteit": 1
    }
  ],
  "samenvatting": "Conclusie over het totale besparingspotentieel in 2-3 zinnen. Noem het totale aantal uren dat bespaard kan worden.",
  "automationReadinessScore": 7,
  "concurrentiePositie": "Korte tekst over hoe het bedrijf zich verhoudt tot concurrenten qua digitalisering en automatisering.",
  "aanbevolenPakket": "starter | business | enterprise"
}

Regels:
- Minimaal 5, maximaal 10 kansen, gerangschikt op impact (prioriteit 1 = hoogste impact)
- Categorieën: workflow, crm, e-commerce, marketing, klantenservice, facturatie, planning, lead_gen, communicatie, administratie, data, content
- Impact: hoog, midden, of laag
- implementatieEffort: laag (< 20 uur), midden (20-60 uur), hoog (> 60 uur)
- geschatteKosten: realistische implementatiekosten in euro's (bijv. "€500-1.000")
- geschatteBesparing: realistische jaarlijkse besparing in euro's (bijv. "€5.000-8.000 per jaar")
- automationReadinessScore: getal 1-10 dat aangeeft hoe klaar het bedrijf is voor automatisering
- aanbevolenPakket: "starter" voor kleine bedrijven met weinig complexiteit, "business" voor MKB met meerdere processen, "enterprise" voor grotere bedrijven met complexe integraties
- Tijdsbesparing moet realistisch zijn voor een MKB
- Schrijf in het Nederlands
- Kansen moeten specifiek zijn voor DIT bedrijf, niet generiek`;
}

export type { CalComContext };
