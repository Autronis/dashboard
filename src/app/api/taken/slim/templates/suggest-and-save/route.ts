import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { slimmeTakenTemplates, projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";

const VALID_CLUSTERS = ["backend-infra", "frontend", "klantcontact", "content", "admin", "research"] as const;

// POST /api/taken/slim/templates/suggest-and-save
// Genereert N suggesties via AI en slaat ze direct op als is_suggestie=1.
// Gebruikt session auth (geen CRON_SECRET nodig).
// Body: { aantal?: number (1-5, default 1), bron?: string }
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = (await req.json().catch(() => ({}))) as {
      aantal?: number;
      bron?: string;
    };
    const aantal = Math.min(Math.max(body.aantal ?? 1, 1), 5);
    const bron = body.bron ?? "refill";

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

    const client = Anthropic({}, "/api/taken/slim/templates/suggest-and-save");

    const prompt = `Bedenk ${aantal} nieuwe "slimme taak" template(s) voor Autronis (AI-automation bureau, Sem & Syb). Claude voert ze zelf uit in ~5-30 min.

Bestaande templates (NIET dupliceren):
${bestaande.map((t) => `- ${t.naam} (${t.cluster})`).join("\n")}

Actieve projecten: ${actieveProjecten.map((p) => p.naam).join(", ")}

Per template: naam (NL, kort), beschrijving (1 zin), cluster (${VALID_CLUSTERS.join("|")}), geschatteDuur (5-30 min), prompt (concrete Claude instructie), velden (optioneel [{key,label}]).

Alleen JSON array, geen markdown:
[{"naam":"...","beschrijving":"...","cluster":"research","geschatteDuur":15,"prompt":"...","velden":[]}]`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return NextResponse.json({ opgeslagen: 0 });

    interface Suggested {
      naam: string;
      beschrijving: string;
      cluster: string;
      geschatteDuur: number;
      prompt: string;
      velden?: Array<{ key: string; label: string }>;
    }

    let parsed: Suggested[];
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return NextResponse.json({ opgeslagen: 0 });
    }

    const valid = parsed
      .filter((t) => t.naam && t.prompt && t.cluster && (VALID_CLUSTERS as readonly string[]).includes(t.cluster))
      .slice(0, aantal);

    let opgeslagen = 0;
    for (const s of valid) {
      const slug = `suggestie-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await db.insert(slimmeTakenTemplates).values({
        slug,
        naam: s.naam,
        beschrijving: s.beschrijving,
        cluster: s.cluster as typeof VALID_CLUSTERS[number],
        geschatteDuur: s.geschatteDuur,
        prompt: s.prompt,
        velden: s.velden && s.velden.length > 0 ? JSON.stringify(s.velden) : null,
        isSysteem: 0,
        isActief: 0,
        isSuggestie: 1,
        suggestieBron: bron,
      });
      opgeslagen++;
    }

    return NextResponse.json({ opgeslagen });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 500 }
    );
  }
}
