import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { slimmeTakenTemplates, projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";

const VALID_CLUSTERS = ["backend-infra", "frontend", "klantcontact", "content", "admin", "research"];

interface SuggestedTemplate {
  naam: string;
  beschrijving: string;
  cluster: string;
  geschatteDuur: number;
  prompt: string;
  velden?: Array<{ key: string; label: string }>;
}

// POST /api/taken/slim/templates/suggest
// Body: { aantal?: number (default 5) }
// Vraagt Claude Sonnet 4 om N nieuwe slimme taak template ideeen te
// genereren op basis van de bestaande templates en actieve projecten,
// zodat ze niet overlappen en wel relevant zijn.
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = (await req.json().catch(() => ({}))) as { aantal?: number };
    const aantal = Math.min(Math.max(body.aantal ?? 5, 1), 10);

    const bestaande = await db
      .select({
        naam: slimmeTakenTemplates.naam,
        beschrijving: slimmeTakenTemplates.beschrijving,
        cluster: slimmeTakenTemplates.cluster,
      })
      .from(slimmeTakenTemplates)
      .where(eq(slimmeTakenTemplates.isActief, 1));

    const actieveProjecten = await db
      .select({ naam: projecten.naam })
      .from(projecten)
      .where(eq(projecten.isActief, 1))
      .limit(20);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ fout: "ANTHROPIC_API_KEY niet ingesteld" }, { status: 500 });
    }
    const client = Anthropic({ apiKey }, "/api/taken/slim/templates/suggest");

    const prompt = `Je bent een productivity assistant voor Autronis (Sem & Syb's bedrijf). Je taak: bedenk ${aantal} nieuwe "slimme taak" templates die Claude (jij/AI) zelf kan uitvoeren binnen ~5-30 min.

CONTEXT — bestaande templates (NIET dupliceren):
${bestaande.map((t) => `- ${t.naam} (${t.cluster}): ${t.beschrijving || "geen beschrijving"}`).join("\n")}

CONTEXT — actieve projecten:
${actieveProjecten.map((p) => `- ${p.naam}`).join("\n")}

EISEN per template:
- naam: korte action-titel, NL, mag {variabele} bevatten voor user input (bv. "Scrape website {url}")
- beschrijving: 1 zin wat het oplevert
- cluster: EXACT een van: ${VALID_CLUSTERS.join(", ")}
- geschatteDuur: realistische schatting in minuten (5/10/15/20/25/30)
- prompt: de letterlijke prompt die jij (Claude) krijgt als de taak wordt opgepakt — moet een concreet uitvoerbaar instruction zijn, mag {variabelen} gebruiken
- velden: optioneel array { key, label } voor user input variabelen

EISEN voor de set:
- Diversiteit: spreid over clusters
- Geen duplicaten van bestaande templates
- Concrete, niet-vage acties die echt waarde leveren voor een AI-automation bureau
- Denk aan: research, analysis, klantretentie, lead generation, content audits, financial sanity checks, project health, competitor monitoring, social listening

OUTPUT: alleen JSON array, geen markdown wrapping, geen uitleg:
[
  {
    "naam": "...",
    "beschrijving": "...",
    "cluster": "research",
    "geschatteDuur": 15,
    "prompt": "...",
    "velden": [{"key": "branche", "label": "Branche"}]
  }
]`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json(
        { fout: "Claude returned geen geldige JSON array" },
        { status: 500 }
      );
    }

    let parsed: SuggestedTemplate[];
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return NextResponse.json(
        { fout: "JSON parse error in Claude response" },
        { status: 500 }
      );
    }

    // Valideer + clean up
    const valid = parsed
      .filter(
        (t) =>
          t.naam &&
          t.prompt &&
          t.cluster &&
          VALID_CLUSTERS.includes(t.cluster)
      )
      .slice(0, aantal);

    return NextResponse.json({ suggesties: valid });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      {
        status:
          error instanceof Error && error.message === "Niet geauthenticeerd"
            ? 401
            : 500,
      }
    );
  }
}
