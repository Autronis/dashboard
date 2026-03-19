import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { aiComplete } from "@/lib/ai/client";

// Autronis diensten voor overlap berekening
const AUTRONIS_DIENSTEN = [
  "workflow automatisering",
  "ai integraties",
  "systeem integraties",
  "data & dashboards",
  "make.com",
  "n8n",
  "api integraties",
  "openai api",
  "custom agents",
  "crm integraties",
  "boekhouding integraties",
  "webshop integraties",
];

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AuironisBot/1.0)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 15000);
}

// POST /api/concurrenten/analyse — AI analyseert URL en geeft gestructureerde data terug
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const { url } = await req.json();

    if (!url?.trim()) {
      return NextResponse.json({ fout: "URL is verplicht." }, { status: 400 });
    }

    // Fetch homepage + common pages
    const baseUrl = url.replace(/\/$/, "");
    const paginas = [
      baseUrl,
      `${baseUrl}/diensten`,
      `${baseUrl}/services`,
      `${baseUrl}/over-ons`,
      `${baseUrl}/about`,
      `${baseUrl}/pricing`,
      `${baseUrl}/cases`,
    ];

    let siteContent = "";
    for (const pagina of paginas) {
      try {
        const html = await fetchWithTimeout(pagina);
        const text = stripHtml(html);
        if (text.length > 100) {
          siteContent += `\n--- ${pagina} ---\n${text}`;
        }
      } catch {
        // Pagina bestaat niet of timeout — skip
      }
    }

    if (!siteContent) {
      return NextResponse.json({ fout: "Kon de website niet bereiken." }, { status: 400 });
    }

    // AI analyse
    const { text: raw } = await aiComplete({
      prompt: `Analyseer deze website content van een bedrijf en geef gestructureerde info terug.

Website: ${baseUrl}
Content:
${siteContent.slice(0, 12000)}

Geef terug als JSON (geen markdown, alleen valid JSON):
{
  "naam": "Bedrijfsnaam",
  "beschrijving": "Korte beschrijving van wat ze doen (1-2 zinnen, Nederlands)",
  "diensten": ["dienst 1", "dienst 2", ...],
  "techStack": ["technologie 1", "technologie 2", ...],
  "prijzen": "Beschrijving van prijzen als zichtbaar, anders null",
  "teamGrootte": "Schatting als beschikbaar, anders null",
  "sterktes": ["sterkte 1", "sterkte 2"],
  "zwaktes": ["zwakte 1", "zwakte 2"],
  "socialMedia": {
    "linkedin": "URL als gevonden, anders null",
    "instagram": "handle als gevonden, anders null"
  },
  "overlapScore": 0-100,
  "overlapUitleg": "Waarom deze score (1 zin)",
  "threatLevel": "laag" | "medium" | "hoog",
  "threatUitleg": "Waarom dit level (1 zin)"
}

Voor overlapScore: vergelijk hun diensten met Autronis (workflow automatisering, AI integraties, systeem integraties, dashboards voor MKB). 0 = geen overlap, 100 = identiek aanbod.
Voor threatLevel: hoog als ze direct concurreren op dezelfde markt + diensten, medium als gedeeltelijke overlap, laag als anders segment.

Antwoord alleen met valid JSON.`,
      maxTokens: 1500,
    });
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const analyse = JSON.parse(cleaned);

    return NextResponse.json({ analyse });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Analyse mislukt" },
      { status: 500 }
    );
  }
}
