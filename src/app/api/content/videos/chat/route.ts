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

const SYSTEM_PROMPT = `Je bent een creatieve video content strategist voor Autronis, een AI- en automatiseringsbureau. Je helpt de gebruiker met het bedenken en maken van korte social media video's (Instagram, LinkedIn, TikTok).

De video's worden gerenderd met Remotion (React-gebaseerde video framework). Het script is een JSON array van scenes.

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

STIJL REGELS:
- Max 3-4 regels tekst per scene, kort en krachtig
- Totaal 4-6 scenes per video (15-25 seconden)
- Eerste scene = hook (pakkende vraag of stelling)
- Laatste scene = CTA (isCta: true) met "Autronis.nl" of actie
- Taal: Nederlands, informeel maar professioneel
- Accent op het belangrijkste woord/zin per scene

ALS EEN AFBEELDING WORDT MEEGESTUURD:
- Analyseer de visuele stijl: kleuren, layout, typografie, sfeer
- Probeer die stijl te vertalen naar het Remotion scene format
- Beschrijf welke elementen je overneemt en welke je aanpast
- De content moet UNIEK zijn — niet kopiëren maar de STIJL overnemen

JOUW ROL:
1. Als de gebruiker een IDEE bespreekt → spar mee, stel vragen, suggereer verbeteringen
2. Als het concept duidelijk is → genereer het script als JSON
3. Als de gebruiker feedback geeft → pas het script aan
4. Wees creatief — stel unieke invalshoeken voor
5. Denk aan scroll-stopping hooks

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
