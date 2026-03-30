import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ChatBericht {
  rol: "gebruiker" | "ai";
  tekst: string;
  script?: unknown;
}

const SYSTEM_PROMPT = `Je bent een creatieve video content strategist voor Autronis. Je maakt video's in de AUTRONIS STIJL.

OVER AUTRONIS:
- AI- en automatiseringsbureau voor MKB
- Kleuren: donker thema (#0E1719 achtergrond), teal/turquoise accent (#23C6B7), wit tekst
- Tone of voice: direct, no-nonsense, data-gedreven, Nederlands
- Doelgroep: MKB ondernemers die tijd verspillen aan handmatig werk
- USP: "Wij automatiseren je herhalende taken — zonder omkijken"
- Website: autronis.nl

De video's worden gerenderd met Remotion. Het script is een JSON object met scenes.

SCENE FORMAT:
{
  "scenes": [
    {
      "tekst": ["Regel 1", "Regel 2", "Accent regel"],
      "accentRegel": 2,
      "accentKleur": "turquoise",
      "icon": "zap",
      "duur": 3,
      "isCta": false
    }
  ]
}

BESCHIKBARE ICONS: zap, target, shield, brain, rocket, chart, code, globe, users, clock, check, star, heart, trending-up, lightbulb, wrench, puzzle, layers, database, cpu, wifi, lock, eye, message-square, thumbs-up, award, gift, flag, megaphone, mail

VIDEO STIJL (Autronis brand):
- Donkere achtergrond met teal glow, flow-line animaties, premium feel
- Tekst poppt in per regel met spring animatie — groot, bold, impactful
- Max 2-3 regels per scene, KORTE zinnen (max 6 woorden per regel)
- accentKleur "turquoise" voor key message, "geel" voor waarschuwingen/problemen
- Totaal 3-5 scenes, max 15 seconden totaal (duur: 2-3 seconden per scene)
- Scene 1 = HOOK — 1 pakkende zin die scrollers stopt (2 sec)
- Midden scenes = waarde/probleem/oplossing (2-3 sec elk)
- Laatste scene = CTA (isCta: true) met "Autronis.nl" of "Plan een gesprek" (3 sec)
- Taal: Nederlands, direct, punchy — GEEN lange zinnen
- Elke scene heeft een icon dat past bij het onderwerp
- Iconen zijn groot (72px) met glow effect

ALS EEN AFBEELDING/VIDEO WORDT MEEGESTUURD:
- Analyseer de visuele stijl en content
- Neem de STIJL over maar maak UNIEKE content — niet kopiëren
- Beschrijf welke elementen je overneemt

JOUW ROL:
1. Spar mee over het concept — stel vragen, suggereer invalshoeken
2. Genereer het script als JSON wanneer het concept duidelijk is
3. Pas aan op feedback
4. Wees creatief — controversieel, verrassend, herkenbaar
5. Denk aan scroll-stopping hooks die de doelgroep (MKB ondernemers) raken

Als je een script genereert, zet het in een JSON codeblock:
\`\`\`json
{"scenes": [...]}
\`\`\`

Antwoord ALTIJD in het Nederlands. Wees bondig.`;

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const { bericht, geschiedenis, referentieVideos, huidigeScript, imageBase64, mediaType, videoFrames } = await req.json() as {
      bericht: string;
      geschiedenis?: ChatBericht[];
      referentieVideos?: string[];
      huidigeScript?: unknown;
      imageBase64?: string;
      mediaType?: string;
      videoFrames?: { base64: string; mediaType: string }[];
    };

    if (!bericht?.trim() && !imageBase64 && (!videoFrames || videoFrames.length === 0)) {
      return NextResponse.json({ fout: "Bericht is verplicht" }, { status: 400 });
    }

    const gespreksContext = geschiedenis?.length
      ? `\n\nEERDERE BERICHTEN:\n${geschiedenis.map(b => `${b.rol === "gebruiker" ? "GEBRUIKER" : "AI"}: ${b.tekst}`).join("\n\n")}`
      : "";

    const scriptContext = huidigeScript
      ? `\n\nHUIDIG SCRIPT (pas dit aan op basis van feedback):\n${JSON.stringify(huidigeScript, null, 2)}`
      : "";

    const refContext = referentieVideos?.length
      ? `\n\nDE GEBRUIKER HEEFT REFERENTIE VIDEO'S GEDEELD. De stijl moet vergelijkbaar zijn maar met UNIEKE content.`
      : "";

    // Build user content — support text + images + video frames
    const userContent: MessageParam["content"] = [];

    // Video frames: send all 6 frames so AI sees the entire video flow
    if (videoFrames && videoFrames.length > 0) {
      for (let i = 0; i < videoFrames.length; i++) {
        userContent.push({
          type: "image",
          source: { type: "base64", media_type: videoFrames[i].mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: videoFrames[i].base64 },
        });
      }
      userContent.push({
        type: "text",
        text: `Hierboven zie je ${videoFrames.length} frames uit een referentie video (van begin tot eind). Analyseer:
1. De visuele stijl — kleuren, typografie, layout, achtergrond
2. De content flow — hoe de scenes opgebouwd zijn, welke tekst per scene
3. Het tempo — hoeveel scenes, hoelang elk duurt
4. De hook — hoe begint het, waarmee pakt het de aandacht

Maak nu een NIEUW script in dezelfde stijl maar met FRISSE, UNIEKE content. Niet dezelfde tekst — nieuwe invalshoek, nieuw onderwerp of nieuwe draai. Behoud de Autronis brand stijl.

${bericht}${refContext}${scriptContext}${gespreksContext}`,
      });
    } else if (imageBase64 && mediaType) {
      // Single image reference
      userContent.push({
        type: "image",
        source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: imageBase64 },
      });
      userContent.push({
        type: "text",
        text: `${bericht}${refContext}${scriptContext}${gespreksContext}`,
      });
    } else {
      userContent.push({
        type: "text",
        text: `${bericht}${refContext}${scriptContext}${gespreksContext}`,
      });
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const antwoord = message.content[0].type === "text" ? message.content[0].text : "";

    // Extract script from response if present
    let script = null;
    const jsonMatch = antwoord.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        script = JSON.parse(jsonMatch[1]);
      } catch { /* invalid JSON */ }
    }

    return NextResponse.json({ antwoord, script });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Chat mislukt" },
      { status: 500 }
    );
  }
}
