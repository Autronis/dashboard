import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";
import { AUTRONIS_CONTEXT } from "./autronis-context";
import { getTemplate } from "./video-templates";

export interface Scene {
  tekst: string[];
  accentRegel?: number;
  accentKleur?: "turquoise" | "geel";
  icon?: string;
  duur?: number;
  isCta?: boolean;
}

const AVAILABLE_ICONS = ["database", "flow", "sync", "shield", "deal", "manual", "integration", "data"] as const;

function fillTemplate(promptTemplate: string, input: Record<string, string>): string {
  let filled = promptTemplate;
  for (const [key, value] of Object.entries(input)) {
    filled = filled.replaceAll(`{{${key}}}`, value);
  }
  return filled;
}

function buildTemplatePrompt(filledPrompt: string): string {
  return `${AUTRONIS_CONTEXT}

## Jouw taak
Genereer een video script op basis van de onderstaande instructies.

## Video stijl Autronis
- Donkere achtergrond, turquoise en geel als accentkleuren
- Korte, punchende tekstregels — max 4 woorden per regel
- Geel (accentKleur: "geel") = pijnpunten, problemen, uitdagingen van de klant
- Turquoise (accentKleur: "turquoise") = oplossingen, voordelen, Autronis aanpak
- Elke scene heeft 2-4 korte tekstregels
- Beschikbare iconen: database, flow, sync, shield, deal, manual, integration, data
- Laatste scene is altijd een CTA (isCta: true): "Autronis.nl" of een korte call-to-action

## Regels voor scenes
- Elke scene: 2-4 tekstregels, max 5 woorden per regel
- accentRegel: het regelnummer (0-indexed) dat opvalt — de kern van de scene
- duur: 2-4 seconden per scene
- Gebruik geen zinnen — gebruik losse, krachtige woorden en korte frasen

## Template instructies
${filledPrompt}

## Outputformaat
Geef ALLEEN een JSON-array terug. Geen uitleg, geen markdown, geen code blocks — alleen de raw JSON array.

Formaat per scene:
{
  "tekst": ["regel 1", "regel 2", "regel 3"],
  "accentRegel": 1,
  "accentKleur": "turquoise",
  "icon": "flow",
  "duur": 3,
  "isCta": false
}

Genereer nu het volledige video script als JSON-array.`;
}

function validateScene(raw: unknown): Scene {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Scene is geen object");
  }

  const obj = raw as Record<string, unknown>;

  const tekst = Array.isArray(obj.tekst)
    ? (obj.tekst as unknown[]).filter((t): t is string => typeof t === "string")
    : [];

  if (tekst.length === 0) {
    throw new Error("Scene heeft geen tekst");
  }

  const accentRegel = typeof obj.accentRegel === "number" ? obj.accentRegel : undefined;
  const accentKleur = obj.accentKleur === "turquoise" || obj.accentKleur === "geel"
    ? obj.accentKleur
    : undefined;

  const icon = typeof obj.icon === "string" && (AVAILABLE_ICONS as readonly string[]).includes(obj.icon)
    ? obj.icon
    : undefined;

  const duur = typeof obj.duur === "number" && obj.duur >= 2 && obj.duur <= 6
    ? obj.duur
    : 3;

  const isCta = obj.isCta === true ? true : undefined;

  return { tekst, accentRegel, accentKleur, icon, duur, isCta };
}

export async function generateFromTemplate(
  templateId: string,
  input: Record<string, string>
): Promise<Scene[]> {
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error(`Template '${templateId}' niet gevonden`);
  }

  // Validate required fields
  for (const veld of template.velden) {
    if (veld.required && (!input[veld.key] || input[veld.key].trim() === "")) {
      throw new Error(`Veld '${veld.label}' is verplicht`);
    }
  }

  const filledPrompt = fillTemplate(template.promptTemplate, input);
  const prompt = buildTemplatePrompt(filledPrompt);

  const client = Anthropic();

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const rawText = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  let parsed: unknown[];
  try {
    parsed = JSON.parse(rawText) as unknown[];
  } catch {
    const match = rawText.match(/\[[\s\S]*\]/);
    if (!match) {
      throw new Error("AI-respons bevat geen geldige JSON-array");
    }
    parsed = JSON.parse(match[0]) as unknown[];
  }

  if (!Array.isArray(parsed)) {
    throw new Error("AI-respons is geen array");
  }

  const scenes = parsed.map((raw, idx) => {
    try {
      return validateScene(raw);
    } catch (err) {
      throw new Error(`Scene ${idx + 1} ongeldig: ${err instanceof Error ? err.message : "onbekende fout"}`);
    }
  });

  if (scenes.length < 3) {
    throw new Error("Video script bevat te weinig scenes (minimaal 3 vereist)");
  }

  // Ensure last scene is CTA
  const lastScene = scenes[scenes.length - 1];
  if (lastScene && !lastScene.isCta) {
    lastScene.isCta = true;
  }

  return scenes;
}
