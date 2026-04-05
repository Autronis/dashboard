import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";
import { AUTRONIS_CONTEXT } from "./autronis-context";

export interface Scene {
  tekst: string[];
  accentRegel?: number;
  accentKleur?: "turquoise" | "geel";
  icon?: string;
  duur?: number;
  isCta?: boolean;
}

const AVAILABLE_ICONS = ["database", "flow", "sync", "shield", "deal", "manual", "integration", "data"] as const;

function buildVideoPrompt(postInhoud: string, postTitel: string): string {
  return `${AUTRONIS_CONTEXT}

## Jouw taak
Converteer de onderstaande Autronis social media post naar een video script voor een korte, krachtige bedrijfsvideo (45-60 seconden totaal).

## Video stijl Autronis
- Donkere achtergrond, turquoise en geel als accentkleuren
- Korte, punchende tekstregels — max 4 woorden per regel
- Geel (accentKleur: "geel") = pijnpunten, problemen, uitdagingen van de klant
- Turquoise (accentKleur: "turquoise") = oplossingen, voordelen, Autronis aanpak
- Elke scene heeft 2-4 korte tekstregels
- Beschikbare iconen: database, flow, sync, shield, deal, manual, integration, data
- Laatste scene is altijd een CTA (isCta: true): "Autronis.nl" of een korte call-to-action

## Regels voor scenes
- 8-15 scenes per video
- Elke scene: 2-4 tekstregels, max 5 woorden per regel
- accentRegel: het regelnummer (0-indexed) dat opvalt — de kern van de scene
- duur: 2-4 seconden per scene (totaal 45-60 seconden)
- Begin met het pijnpunt (geel), bouw op naar de oplossing (turquoise), eindig met CTA
- Gebruik geen zinnen — gebruik losse, krachtige woorden en korte frasen

## Post inhoud
**Titel:** ${postTitel}

**Inhoud:**
${postInhoud}

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

export async function generateVideoScript(postInhoud: string, postTitel: string): Promise<Scene[]> {
  const client = Anthropic();

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: buildVideoPrompt(postInhoud, postTitel),
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
