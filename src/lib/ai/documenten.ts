import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";
import { AUTRONIS_CONTEXT } from "./autronis-context";
import { AiDraftRequest, AiDraftResponse, AiCategorisatieResponse, DocumentType } from "@/types/documenten";

function getClient() {
  return Anthropic();
}

const TYPE_PROMPTS: Record<DocumentType, string> = {
  contract: "Genereer een professioneel contract. Gebruik duidelijke clausules, partijen, verplichtingen en voorwaarden.",
  klantdocument: "Genereer een klantgericht document. Wees helder over deliverables en verwachtingen.",
  intern: "Genereer een intern document. Focus op duidelijke instructies en processen.",
  "belangrijke-info": "Genereer een beknopt overzicht van belangrijke informatie. Wees feitelijk en direct.",
  plan: "Genereer een projectplan of roadmap. Gebruik fases, milestones en concrete deliverables met een tijdlijn.",
  notitie: "Genereer een gestructureerde notitie met de belangrijkste punten.",
};

export async function generateDraft(request: AiDraftRequest): Promise<AiDraftResponse> {
  const veldenTekst = Object.entries(request.velden)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const message = await getClient().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: `${AUTRONIS_CONTEXT}\n\n${TYPE_PROMPTS[request.type]}\n\nSchrijf in het Nederlands.`,
    messages: [
      {
        role: "user",
        content: `Maak een ${request.type} document aan met de volgende informatie:

Titel: ${request.titel}
${request.klantNaam ? `Klant: ${request.klantNaam}` : ""}
${request.projectNaam ? `Project: ${request.projectNaam}` : ""}
${veldenTekst ? `\nExtra informatie:\n${veldenTekst}` : ""}
${request.extraContext ? `\nContext: ${request.extraContext}` : ""}

Genereer het volledige document. Gebruik duidelijke koppen en structuur.`,
      },
    ],
  });

  const content = message.content[0].type === "text" ? message.content[0].text : "";

  const summaryMessage = await getClient().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Geef een samenvatting van maximaal 2 zinnen van het volgende document:\n\n${content}`,
      },
    ],
  });

  const samenvatting = summaryMessage.content[0].type === "text" ? summaryMessage.content[0].text : "";

  return { content, samenvatting };
}

export type { ImproveMode } from "./documenten-types";
export { IMPROVE_MODE_LABELS } from "./documenten-types";
import type { ImproveMode } from "./documenten-types";

const IMPROVE_PROMPTS: Record<ImproveMode, string> = {
  formeler: "Herschrijf dit document professioneler en zakelijker. Behoud alle inhoud maar maak de toon formeler.",
  korter: "Maak dit document 30% korter. Behoud de kernboodschap maar verwijder overbodige tekst.",
  uitgebreider: "Breid dit document uit met relevante details. Voeg context toe die nuttig is op basis van de Autronis diensten en werkwijze.",
  eenvoudiger: "Herschrijf dit document in eenvoudig Nederlands. Vermijd jargon en gebruik korte zinnen.",
  toon: "Pas de toon van dit document aan zodat het past bij de Autronis tone of voice: professioneel maar toegankelijk, concreet en to-the-point.",
};

export async function improveDocument(content: string, mode: ImproveMode): Promise<{ original: string; improved: string }> {
  const message = await getClient().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: `${AUTRONIS_CONTEXT}\n\n${IMPROVE_PROMPTS[mode]}\n\nSchrijf in het Nederlands. Geef alleen het verbeterde document terug, geen uitleg.`,
    messages: [
      { role: "user", content },
    ],
  });

  const improved = message.content[0].type === "text" ? message.content[0].text : content;
  return { original: content, improved };
}

export async function categorizeDocument(content: string, type: DocumentType): Promise<AiCategorisatieResponse> {
  const message = await getClient().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `Analyseer het volgende ${type} document en geef:
1. Een samenvatting van maximaal 2 zinnen
2. Eventuele belangrijke datums (als array van strings in YYYY-MM-DD formaat)
3. Eventuele bedragen (als array van getallen)

Antwoord in JSON formaat:
{"samenvatting": "...", "extractedMetadata": {"datums": [...], "bedragen": [...]}}

Document:
${content}`,
      },
    ],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "{}";

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as AiCategorisatieResponse;
    }
  } catch {
    // Fallback
  }

  return {
    samenvatting: "",
    extractedMetadata: {},
  };
}

export async function generateSummary(content: string): Promise<string> {
  const message = await getClient().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Geef een samenvatting van maximaal 2 zinnen van het volgende document:\n\n${content}`,
      },
    ],
  });
  return message.content[0].type === "text" ? message.content[0].text : "";
}
