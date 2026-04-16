import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { slimmeTakenTemplates, projecten } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";

const VALID_CLUSTERS = ["backend-infra", "frontend", "klantcontact", "content", "admin", "research"];

// GET /api/cron/slimme-taken-suggest
// Draait wekelijks op maandag via Vercel cron. Genereert 3-5 nieuwe template
// suggesties via Claude en slaat ze op als is_suggestie=1.
// Optioneel: ?bron=project:NaamHier voor project-triggered suggesties.
export async function GET(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ fout: "Unauthorized" }, { status: 401 });
    }

    const bron = req.nextUrl.searchParams.get("bron") ?? "weekly-cron";
    const projectContext = req.nextUrl.searchParams.get("projectContext") ?? "";
    const aantal = Math.min(parseInt(req.nextUrl.searchParams.get("aantal") ?? "5"), 10);

    // Verwijder oude ongeaccepteerde suggesties van dezelfde bron (voorkom ophoping)
    if (bron === "weekly-cron") {
      await db
        .delete(slimmeTakenTemplates)
        .where(
          and(
            eq(slimmeTakenTemplates.isSuggestie, 1),
            eq(slimmeTakenTemplates.suggestieBron, "weekly-cron")
          )
        );
    }

    // Laad bestaande templates als context
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
    const client = Anthropic({ apiKey }, "/api/cron/slimme-taken-suggest");

    const extraContext = projectContext
      ? `\n\nNIEUW PROJECT — genereer templates die specifiek relevant zijn voor dit project:\n${projectContext}`
      : "";

    const prompt = `Je bent een productivity assistant voor Autronis (Sem & Syb's AI-automation bureau). Bedenk ${aantal} nieuwe "slimme taak" templates die Claude (AI) zelf kan uitvoeren binnen ~5-30 min.

CONTEXT — bestaande templates (NIET dupliceren):
${bestaande.map((t) => `- ${t.naam} (${t.cluster}): ${t.beschrijving || "-"}`).join("\n")}

CONTEXT — actieve projecten:
${actieveProjecten.map((p) => `- ${p.naam}`).join("\n")}${extraContext}

EISEN per template:
- naam: korte action-titel, NL, mag {variabele} bevatten
- beschrijving: 1 zin wat het oplevert
- cluster: EXACT een van: ${VALID_CLUSTERS.join(", ")}
- geschatteDuur: minuten (5/10/15/20/25/30)
- prompt: letterlijke Claude instructie, concreet uitvoerbaar
- velden: optioneel array { key, label } voor user input

EISEN voor de set:
- Diversiteit: spreid over clusters
- Geen duplicaten van bestaande templates
- Concrete acties die echt waarde leveren
- Varieer: research, klantretentie, lead gen, content audits, financial checks, competitor monitoring

OUTPUT: alleen JSON array, geen markdown:
[{"naam":"...","beschrijving":"...","cluster":"research","geschatteDuur":15,"prompt":"...","velden":[]}]`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ fout: "Geen geldige JSON van Claude", text }, { status: 500 });
    }

    interface SuggestedTemplate {
      naam: string;
      beschrijving: string;
      cluster: string;
      geschatteDuur: number;
      prompt: string;
      velden?: Array<{ key: string; label: string }>;
    }

    let parsed: SuggestedTemplate[];
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return NextResponse.json({ fout: "JSON parse error" }, { status: 500 });
    }

    const valid = parsed
      .filter((t) => t.naam && t.prompt && t.cluster && VALID_CLUSTERS.includes(t.cluster))
      .slice(0, aantal);

    // Sla suggesties op als templates met is_suggestie=1
    const opgeslagen: string[] = [];
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
      opgeslagen.push(s.naam);
    }

    return NextResponse.json({
      ok: true,
      bron,
      gegenereerd: valid.length,
      opgeslagen,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 500 }
    );
  }
}
