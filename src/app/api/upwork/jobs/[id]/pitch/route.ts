import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { TrackedAnthropic } from "@/lib/ai/tracked-anthropic";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";

interface Body {
  regenerate?: boolean;
}

function parseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === "string");
    }
  } catch {
    // fall through
  }
  return [];
}

function formatBudgetForPrompt(
  budgetType: "fixed" | "hourly" | null,
  budgetMin: number | null,
  budgetMax: number | null,
): string {
  if (!budgetType) return "onbekend";
  if (budgetType === "hourly") {
    if (budgetMin !== null && budgetMax !== null && budgetMax !== budgetMin) {
      return `$${budgetMin}-${budgetMax}/uur`;
    }
    if (budgetMin !== null) return `$${budgetMin}/uur`;
    return "hourly (tarief onbekend)";
  }
  if (budgetMin !== null && budgetMax !== null && budgetMax !== budgetMin) {
    return `$${budgetMin}-${budgetMax} fixed`;
  }
  if (budgetMin !== null) return `$${budgetMin} fixed`;
  return "fixed (budget onbekend)";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
  }

  const { id } = await params;
  const rowId = Number(id);
  if (!Number.isFinite(rowId) || rowId <= 0) {
    return NextResponse.json({ fout: "Ongeldig job id" }, { status: 400 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    // empty body is fine — defaults apply
  }
  const regenerate = body.regenerate === true;

  const rows = await db
    .select()
    .from(schema.upworkJobs)
    .where(eq(schema.upworkJobs.id, rowId))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ fout: "Job niet gevonden" }, { status: 404 });
  }

  const job = rows[0];

  // Return cached pitch if available and not regenerating
  if (!regenerate && job.pitchDraft) {
    return NextResponse.json({
      succes: true,
      pitch: job.pitchDraft,
      cached: true,
      generatedAt: job.pitchGeneratedAt,
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { fout: "ANTHROPIC_API_KEY niet geconfigureerd" },
      { status: 500 },
    );
  }

  const anthropic = TrackedAnthropic({ apiKey }, "/api/upwork/jobs/[id]/pitch");

  // Build prompt
  const screeningQs = parseStringArray(job.screeningQs);
  const categoryLabels = parseStringArray(job.categoryLabels);
  const budget = formatBudgetForPrompt(job.budgetType, job.budgetMin, job.budgetMax);
  const hireRate = job.clientHireRate !== null ? `${Math.round(job.clientHireRate)}%` : "onbekend";
  const rating = job.clientRating !== null ? `${job.clientRating.toFixed(1)}/5` : "onbekend";
  const reviews = job.clientReviews !== null ? `${job.clientReviews} reviews` : "geen reviews";
  const spent = job.clientSpent !== null ? `$${Math.round(job.clientSpent)}` : "onbekend";
  const proposalsRange =
    job.proposalsRangeMin !== null
      ? `${job.proposalsRangeMin}${
          job.proposalsRangeMax !== null && job.proposalsRangeMax !== job.proposalsRangeMin
            ? `-${job.proposalsRangeMax}`
            : ""
        }`
      : "onbekend";

  const screeningSection =
    screeningQs.length > 0
      ? `\n\nScreening questions:\n${screeningQs.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
      : "";

  const prompt = `Je schrijft een Upwork proposal namens Autronis — een Nederlands AI & automation agency gerund door Sem Gijsberts en Syb. Specialisatie: n8n workflows, Claude/OpenAI agents, Next.js + Supabase dashboards, data pipelines, web scraping.

JOB:
Titel: ${job.titel ?? "(geen titel)"}
Budget: ${budget}
Land: ${job.country ?? "onbekend"}
Client: ${job.clientNaam ?? "onbekend"} — ${spent} spent, ${hireRate} hire rate, ${rating} stars (${reviews})
Proposals zover: ${proposalsRange}
Categorieën: ${categoryLabels.join(", ") || "geen"}

Beschrijving:
${job.beschrijving ?? "(geen beschrijving)"}${screeningSection}

OUTPUT (markdown):
1. **Opener** (1 zin) — persoonlijke herkenning van het concrete probleem. Geen "I hope this finds you well".
2. **Waarom wij** (2-3 zinnen) — specifieke, relevante ervaring. Noem 1 eerdere case kort (verzin iets plausibels op basis van Autronis' stack als geen case data beschikbaar).
3. **Aanpak** (3-5 bullets) — concrete technische stappen die bij deze specifieke job passen, in hun terminologie.
4. **Vraag** (1 vraag) — een intelligente follow-up die laat zien dat je de requirements snapt.
5. ${screeningQs.length > 0 ? `Draft antwoorden onder kopje "Screening answers" — kort, direct.` : "(geen screening questions — sla deze sectie over)"}
6. **Prijs** — als fixed budget genoemd: voorstel iets onder het max (bv 80-90%). Als hourly: voorstel een fair rate in dat bereik.

Regels:
- Engels (Upwork is international)
- Max 250 woorden (exclusief screening answers)
- Geen cliché openers ("I am excited to...", "I hope this finds you well")
- Geen passieve formuleringen
- Wees specifiek, niet generiek
- Toon dat je de job beschrijving hebt gelezen (quote 1 concreet detail)`;

  let pitch = "";
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });
    pitch = response.content[0].type === "text" ? response.content[0].text : "";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: `Pitch genereren mislukt: ${message}` },
      { status: 502 },
    );
  }

  if (!pitch.trim()) {
    return NextResponse.json(
      { fout: "Pitch genereren mislukt: lege respons van Claude" },
      { status: 502 },
    );
  }

  const now = new Date().toISOString();
  await db
    .update(schema.upworkJobs)
    .set({
      pitchDraft: pitch,
      pitchGeneratedAt: now,
      bijgewerktOp: now,
    })
    .where(eq(schema.upworkJobs.id, rowId));

  return NextResponse.json({
    succes: true,
    pitch,
    cached: false,
    generatedAt: now,
  });
}
