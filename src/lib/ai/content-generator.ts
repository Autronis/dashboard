import Anthropic from "@anthropic-ai/sdk";
import { AUTRONIS_CONTEXT } from "./autronis-context";

interface ProfielData {
  over_ons: string;
  diensten: string;
  usps: string;
  tone_of_voice: string;
}

interface InzichtInput {
  titel: string;
  inhoud: string;
  categorie: string;
}

interface GeneratedPost {
  titel: string;
  inhoud: string;
  platform: "linkedin" | "instagram";
  format: string;
  hashtags: string[];
  inzichtTitel?: string;
}

function selectRandomInzichten(inzichten: InzichtInput[], count: number): InzichtInput[] {
  const shuffled = [...inzichten].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function buildSystemPrompt(profiel: ProfielData): string {
  return `${AUTRONIS_CONTEXT}

## Jouw taak
Je genereert social media posts voor Autronis. Deze posts worden geschreven alsof Sem of Syb ze zelf schrijft — niet als AI, maar als een echte persoon die vakkennis deelt.

## Autronis profiel
**Over ons:**
${profiel.over_ons}

**Diensten:**
${profiel.diensten}

**USPs:**
${profiel.usps}

**Tone of voice:**
${profiel.tone_of_voice}

## Schrijfregels (STRIKT VOLGEN)
- Schrijf zoals Sem of Syb het zou zeggen — menselijk, direct, persoonlijk
- Geen AI-taal: geen "In de snelle wereld van...", geen "Als expert in...", geen "Het is duidelijk dat..."
- Geen salesy taal: geen "Wil jij ook?", geen "Neem vandaag nog contact op!"
- Korte, krachtige zinnen. Liever 2 korte dan 1 lange
- Concrete voorbeelden en specifieke details — geen vage claims
- Modern Nederlands, informeel maar professioneel
- Opinieus mag. Standpunten mogen scherp zijn
- Geen wollige intro's — begin meteen met de kern

## Platform-specifieke regels
**LinkedIn:**
- 150-300 woorden
- Professioneler van toon, maar nog steeds persoonlijk
- Mag langer verhaal vertellen of een standpunt onderbouwen
- Eindigt niet met een sales-call-to-action — wel met een open vraag of een gedachte

**Instagram:**
- 50-150 woorden
- Directer en visueler geschreven
- Korter en meer punchy
- Mag wat informeler

## Formats
- post: standaard LinkedIn update, mening of observatie
- caption: Instagram bijschrift bij een afbeelding
- thought_leadership: uitgesproken standpunt over de industrie
- tip: concrete, direct bruikbare tip
- storytelling: kort verhaal vanuit eigen ervaring. Structuur: pakkende one-liner als hook → persoonlijk verhaal met concreet voorbeeld → eerlijk over het probleem dat het oplost → geen hype, juist understateren → eindig met open vraag aan de lezer
- how_to: stapsgewijze uitleg van een aanpak
- vraag: post die eindigt met een prikkelende vraag

## Hashtags
- 3-5 relevante hashtags per post
- Mix van brede (#automatisering) en niche tags (#MakeAutomation, #AIWorkflow)
- Altijd in het Nederlands of Engelstalig vakjargon — geen pietluttige hashtags
- Geen hashtags in de posttekst zelf — alleen in het "hashtags" veld`;
}

function buildUserPrompt(
  inzichten: InzichtInput[],
  count: number,
  platforms: ("linkedin" | "instagram")[]
): string {
  const inzichtenText = inzichten.length > 0
    ? inzichten.map((i, idx) => `Inzicht ${idx + 1} [${i.categorie}]: ${i.titel}\n${i.inhoud}`).join("\n\n")
    : "Geen specifieke inzichten beschikbaar — baseer de posts op de Autronis kennis uit het systeemprompt.";

  const platformVerdeling = platforms.includes("linkedin") && platforms.includes("instagram")
    ? `Maak een mix: ongeveer de helft LinkedIn, de helft Instagram.`
    : platforms.includes("linkedin")
    ? `Alle posts zijn voor LinkedIn.`
    : `Alle posts zijn voor Instagram.`;

  return `Genereer precies ${count} social media posts voor Autronis.

${platformVerdeling}
Gebruik een mix van formats: vraag, statement, storytelling, lijst, how_to, tip, thought_leadership.

## Inspiratie (gebruik deze inzichten als basis voor de posts)
${inzichtenText}

## Outputformaat
Geef ALLEEN een JSON-array terug. Geen uitleg, geen markdown code blocks, geen prefix — alleen de raw JSON array.

Formaat per post:
{
  "titel": "korte interne titel voor dit stuk (max 10 woorden)",
  "inhoud": "de volledige posttekst",
  "platform": "linkedin" of "instagram",
  "format": "post" | "caption" | "thought_leadership" | "tip" | "storytelling" | "how_to" | "vraag",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"],
  "inzichtTitel": "titel van het gebruikte inzicht, of null als niet van toepassing"
}

Genereer nu de ${count} posts.`;
}

export async function generateContentBatch(
  profiel: ProfielData,
  inzichten: InzichtInput[],
  count: number = 7,
  platforms: ("linkedin" | "instagram")[] = ["linkedin", "instagram"]
): Promise<GeneratedPost[]> {
  const client = new Anthropic();

  const selectedInzichten = selectRandomInzichten(inzichten, Math.min(count, inzichten.length));

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    system: buildSystemPrompt(profiel),
    messages: [
      {
        role: "user",
        content: buildUserPrompt(selectedInzichten, count, platforms),
      },
    ],
  });

  const rawText = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  let parsed: GeneratedPost[];
  try {
    parsed = JSON.parse(rawText) as GeneratedPost[];
  } catch {
    // Try to extract JSON array from response if Claude added surrounding text
    const match = rawText.match(/\[[\s\S]*\]/);
    if (!match) {
      throw new Error("AI-respons bevat geen geldige JSON-array");
    }
    parsed = JSON.parse(match[0]) as GeneratedPost[];
  }

  if (!Array.isArray(parsed)) {
    throw new Error("AI-respons is geen array");
  }

  return parsed.map((post) => ({
    titel: post.titel ?? "Zonder titel",
    inhoud: post.inhoud ?? "",
    platform: post.platform === "instagram" ? "instagram" : "linkedin",
    format: post.format ?? "post",
    hashtags: Array.isArray(post.hashtags) ? post.hashtags : [],
    inzichtTitel: post.inzichtTitel ?? undefined,
  }));
}
