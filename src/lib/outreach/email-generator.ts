import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";
import type { AnalysisResult } from "@/lib/sales-engine/analyzer";

interface EmailSequenceInput {
  bedrijfsnaam: string;
  contactpersoon: string;
  branche: string;
  watZeDoen: string;
  grootsteKnelpunt: string;
  topKansen: Array<{
    titel: string;
    beschrijving: string;
    geschatteTijdsbesparing: string;
    geschatteBesparing: string;
  }>;
  automationReadinessScore: number;
  samenvatting: string;
}

export interface GeneratedEmail {
  onderwerp: string;
  inhoud: string;
}

export interface GeneratedSequence {
  emails: [GeneratedEmail, GeneratedEmail, GeneratedEmail];
}

export function extractEmailInput(
  lead: { bedrijfsnaam: string; contactpersoon: string | null },
  analysis: AnalysisResult,
  scanData: { grootsteKnelpunt: string | null }
): EmailSequenceInput {
  const topKansen = analysis.kansen
    .filter((k) => k.impact === "hoog" || k.prioriteit <= 3)
    .slice(0, 3)
    .map((k) => ({
      titel: k.titel,
      beschrijving: k.beschrijving,
      geschatteTijdsbesparing: k.geschatteTijdsbesparing,
      geschatteBesparing: k.geschatteBesparing,
    }));

  return {
    bedrijfsnaam: lead.bedrijfsnaam,
    contactpersoon: lead.contactpersoon || "daar",
    branche: analysis.bedrijfsProfiel.branche,
    watZeDoen: analysis.bedrijfsProfiel.watZeDoen,
    grootsteKnelpunt: scanData.grootsteKnelpunt || "procesoptimalisatie",
    topKansen,
    automationReadinessScore: analysis.automationReadinessScore,
    samenvatting: analysis.samenvatting,
  };
}

export async function generateEmailSequence(
  input: EmailSequenceInput,
  variant: "a" | "b" = "a"
): Promise<GeneratedSequence> {
  const client = Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const variantInstructie = variant === "a"
    ? "Schrijf in een professionele maar warme toon. Focus op het knelpunt en de oplossing."
    : "Schrijf in een directe, resultaatgerichte toon. Focus op cijfers en ROI.";

  const prompt = `Je bent een outreach specialist voor Autronis, een AI- en automatiseringsbureau voor MKB-bedrijven.

Schrijf een email sequentie van 3 emails voor een prospect. ${variantInstructie}

## Prospect Info
- Bedrijf: ${input.bedrijfsnaam}
- Contactpersoon: ${input.contactpersoon}
- Branche: ${input.branche}
- Wat ze doen: ${input.watZeDoen}
- Grootste knelpunt: ${input.grootsteKnelpunt}
- Automation Readiness Score: ${input.automationReadinessScore}/10

## Gevonden Automatiseringskansen
${input.topKansen.map((k, i) => `${i + 1}. ${k.titel}: ${k.beschrijving} (Besparing: ${k.geschatteTijdsbesparing}, ${k.geschatteBesparing})`).join("\n")}

## AI Samenvatting
${input.samenvatting}

## Instructies

Schrijf 3 emails:

**Email 1 (Dag 0 - Introductie):**
- Kort, max 150 woorden
- Noem specifiek hun knelpunt
- Toon dat je hun website hebt bekeken (noem iets specifieks)
- Eindig met een vraag, geen harde pitch
- Geen bijlagen of links (behalve eventueel je website)

**Email 2 (Dag 3 - Waarde):**
- Max 120 woorden
- Deel een concreet inzicht of voorbeeld
- Refereer aan de top automatiseringskans
- Noem de geschatte besparing
- Casual call-to-action

**Email 3 (Dag 7 - Laatste check):**
- Max 80 woorden
- Kort en direct
- Laatste kans framing zonder pushy te zijn
- Simpele ja/nee vraag

## Format

Geef je antwoord als JSON (geen andere tekst):

{
  "emails": [
    { "onderwerp": "Onderwerp email 1", "inhoud": "<p>HTML inhoud...</p>" },
    { "onderwerp": "Onderwerp email 2", "inhoud": "<p>HTML inhoud...</p>" },
    { "onderwerp": "Onderwerp email 3", "inhoud": "<p>HTML inhoud...</p>" }
  ]
}

Regels:
- Schrijf in het Nederlands
- Gebruik HTML voor de inhoud (p, br, strong tags)
- Onderwerp max 60 karakters
- Geen "Geachte" - gebruik voornaam
- Onderteken met "Sem van Autronis"
- Geen emoji in onderwerp
- Maak elke email uniek en specifiek voor dit bedrijf`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonStr = responseText.replace(/```json\n?|\n?```/g, "").trim();

  try {
    const parsed = JSON.parse(jsonStr) as GeneratedSequence;

    if (!parsed.emails || parsed.emails.length !== 3) {
      throw new Error("AI genereerde niet exact 3 emails");
    }

    for (const email of parsed.emails) {
      if (!email.onderwerp?.trim() || !email.inhoud?.trim()) {
        throw new Error("Email mist onderwerp of inhoud");
      }
    }

    return parsed;
  } catch (parseError) {
    throw new Error(
      `Email generatie mislukt: ${parseError instanceof Error ? parseError.message : "onbekend"}`
    );
  }
}
