import Anthropic from "@anthropic-ai/sdk";
import type { BannerTemplateType, BannerData, QuoteData, StatData, TipData, CaseStudyData } from "@/types/content";
import { AUTRONIS_CONTEXT } from "./autronis-context";

interface BannerGenerationResult {
  templateType: BannerTemplateType;
  data: BannerData;
}

interface RawBannerResult {
  templateType: unknown;
  data: unknown;
}

function buildPrompt(postInhoud: string, postTitel: string): string {
  return `${AUTRONIS_CONTEXT}

## Jouw taak
Analyseer de onderstaande social media post en genereer de beste banner data.

Kies het template type op basis van de inhoud:
- "quote" — als de post een sterke uitspraak, stelling of citaat bevat
- "stat" — als de post concrete cijfers, tijdsbesparing, percentages of meetbare resultaten bevat
- "tip" — als de post tips, stappen of een lijst met adviezen bevat
- "case_study" — als de post een klant, project of concreet resultaat voor iemand beschrijft

## Post
**Titel:** ${postTitel}

**Inhoud:**
${postInhoud}

## Outputformaat
Geef ALLEEN een JSON-object terug. Geen uitleg, geen markdown, geen code blocks.

Voor quote:
{"templateType":"quote","data":{"tekst":"De krachtigste quote of stelling uit de post","auteur":"Optioneel naam"}}

Voor stat:
{"templateType":"stat","data":{"label":"Wat er verbeterd is","van":"oude waarde","naar":"nieuwe waarde","eenheid":"min/uur/%/etc"}}

Voor tip:
{"templateType":"tip","data":{"titel":"Titel van de tip","punten":["Punt 1","Punt 2","Punt 3"]}}

Voor case_study:
{"templateType":"case_study","data":{"klantNaam":"Naam klant of sector","resultaat":"Concreet resultaat in 1 zin","beschrijving":"Optionele korte uitleg"}}

Regels:
- tekst voor quote: max 120 tekens, krachtig en direct
- punten voor tip: elk max 80 tekens, actief geformuleerd
- resultaat voor case_study: max 100 tekens
- Schrijf in het Nederlands

Genereer nu de banner data:`;
}

function validateQuoteData(raw: Record<string, unknown>): QuoteData {
  const tekst = typeof raw.tekst === "string" && raw.tekst.length > 0 ? raw.tekst : "Slimmer werken met AI";
  const auteur = typeof raw.auteur === "string" && raw.auteur.length > 0 ? raw.auteur : undefined;
  return { tekst, auteur };
}

function validateStatData(raw: Record<string, unknown>): StatData {
  const label = typeof raw.label === "string" && raw.label.length > 0 ? raw.label : "Tijdsbesparing";
  const van = typeof raw.van === "string" && raw.van.length > 0 ? raw.van : "8u";
  const naar = typeof raw.naar === "string" && raw.naar.length > 0 ? raw.naar : "1u";
  const eenheid = typeof raw.eenheid === "string" && raw.eenheid.length > 0 ? raw.eenheid : undefined;
  return { label, van, naar, eenheid };
}

function validateTipData(raw: Record<string, unknown>): TipData {
  const titel = typeof raw.titel === "string" && raw.titel.length > 0 ? raw.titel : "Tips voor automatisering";
  const rawPunten = Array.isArray(raw.punten) ? raw.punten : [];
  const punten: [string, string, string] = [
    typeof rawPunten[0] === "string" ? rawPunten[0] : "Analyseer je werkproces",
    typeof rawPunten[1] === "string" ? rawPunten[1] : "Automatiseer repetitieve taken",
    typeof rawPunten[2] === "string" ? rawPunten[2] : "Meet en optimaliseer continu",
  ];
  return { titel, punten };
}

function validateCaseStudyData(raw: Record<string, unknown>): CaseStudyData {
  const klantNaam = typeof raw.klantNaam === "string" && raw.klantNaam.length > 0 ? raw.klantNaam : "MKB Klant";
  const resultaat = typeof raw.resultaat === "string" && raw.resultaat.length > 0 ? raw.resultaat : "80% minder handmatig werk";
  const beschrijving = typeof raw.beschrijving === "string" && raw.beschrijving.length > 0 ? raw.beschrijving : undefined;
  return { klantNaam, resultaat, beschrijving };
}

export async function generateBannerData(postInhoud: string, postTitel: string): Promise<BannerGenerationResult> {
  const client = new Anthropic();

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: buildPrompt(postInhoud, postTitel),
      },
    ],
  });

  const rawText = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  let parsed: RawBannerResult;
  try {
    parsed = JSON.parse(rawText) as RawBannerResult;
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("AI-respons bevat geen geldige JSON");
    }
    parsed = JSON.parse(match[0]) as RawBannerResult;
  }

  const VALID_TYPES: BannerTemplateType[] = ["quote", "stat", "tip", "case_study"];
  const templateType: BannerTemplateType = VALID_TYPES.includes(parsed.templateType as BannerTemplateType)
    ? (parsed.templateType as BannerTemplateType)
    : "quote";

  if (typeof parsed.data !== "object" || parsed.data === null) {
    throw new Error("AI-respons bevat geen geldige data");
  }

  const rawData = parsed.data as Record<string, unknown>;
  let data: BannerData;

  switch (templateType) {
    case "quote":
      data = validateQuoteData(rawData);
      break;
    case "stat":
      data = validateStatData(rawData);
      break;
    case "tip":
      data = validateTipData(rawData);
      break;
    case "case_study":
      data = validateCaseStudyData(rawData);
      break;
  }

  return { templateType, data };
}
