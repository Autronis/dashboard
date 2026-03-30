import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { aiComplete } from "@/lib/ai/client";

interface ChatBericht {
  rol: "gebruiker" | "ai";
  tekst: string;
  script?: unknown;
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const { bericht, geschiedenis, referentieVideos, huidigeScript } = await req.json() as {
      bericht: string;
      geschiedenis?: ChatBericht[];
      referentieVideos?: string[];
      huidigeScript?: unknown;
    };

    if (!bericht?.trim()) {
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

    const { text: antwoord } = await aiComplete({
      provider: "anthropic",
      system: `Je bent een creatieve video content strategist voor Autronis, een AI- en automatiseringsbureau. Je helpt de gebruiker met het bedenken en maken van korte social media video's (Instagram, LinkedIn, TikTok).

De video's worden gerenderd met Remotion (React-gebaseerde video framework). Het script is een JSON array van scenes.

SCENE FORMAT:
{
  "scenes": [
    {
      "tekst": ["Regel 1", "Regel 2", "Accent regel"],
      "accentRegel": 2,           // 0-indexed, welke regel teal/geel wordt
      "accentKleur": "turquoise", // "turquoise" of "geel"
      "icon": "zap",              // optioneel lucide icon naam
      "duur": 3,                  // seconden
      "isCta": false              // true voor call-to-action scene
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
- Elke video moet een duidelijk punt maken

JOUW ROL:
1. Als de gebruiker een IDEE bespreekt → spar mee, stel vragen, suggereer verbeteringen
2. Als het concept duidelijk is → genereer het script als JSON
3. Als de gebruiker feedback geeft → pas het script aan
4. Wees creatief — stel unieke invalshoeken voor die nog niet eerder zijn gebruikt
5. Denk aan scroll-stopping hooks: controversieel, verrassend, of herkenbaar

Als je een script genereert, zet het in een JSON codeblock:
\`\`\`json
{"scenes": [...]}
\`\`\`

Antwoord ALTIJD in het Nederlands. Wees bondig.${refContext}${scriptContext}${gespreksContext}`,
      prompt: bericht,
      maxTokens: 2000,
    });

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
