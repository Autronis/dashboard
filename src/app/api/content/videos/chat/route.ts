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
- Donkere achtergrond met teal accenten en flow-line animaties
- Tekst verschijnt met typewriter effect — kort, krachtig
- Max 3-4 regels per scene, grote tekst
- accentKleur "turquoise" voor de key message per scene, "geel" voor waarschuwingen/problemen
- Totaal 4-6 scenes (15-25 seconden)
- Scene 1 = HOOK — pakkende vraag, controversiële stelling, of herkenbaar probleem
- Laatste scene = CTA (isCta: true) met "Autronis.nl" of "Plan een gesprek"
- Taal: Nederlands, informeel maar professioneel — spreek de ondernemer direct aan
- Gebruik iconen die passen bij het onderwerp

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

    const { bericht, geschiedenis, referentieVideos, huidigeScript, imageBase64, mediaType } = await req.json() as {
      bericht: string;
      geschiedenis?: ChatBericht[];
      referentieVideos?: string[];
      huidigeScript?: unknown;
      imageBase64?: string;
      mediaType?: string;
    };

    if (!bericht?.trim() && !imageBase64) {
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

    // Build user content — support text + image
    const userContent: MessageParam["content"] = [];

    if (imageBase64 && mediaType) {
      userContent.push({
        type: "image",
        source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: imageBase64 },
      });
    }

    userContent.push({
      type: "text",
      text: `${bericht}${refContext}${scriptContext}${gespreksContext}`,
    });

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
