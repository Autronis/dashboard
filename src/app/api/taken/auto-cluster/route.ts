import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";
import {
  createJob,
  markJobDone,
  markJobError,
  updateJob,
} from "@/lib/auto-cluster-jobs";

// POST /api/taken/auto-cluster
// Start een auto-cluster job asynchroon en returnt direct een jobId.
// De verwerking loopt door op de server ook als de client wegnavigeert.
// Gebruik GET /api/taken/auto-cluster/status?jobId=X om voortgang te
// peilen.
//
// Body: { projectId?: number, onlyMissing?: boolean }
//   projectId    — beperk tot 1 project, anders alle projecten
//   onlyMissing  — als true, alleen taken zonder cluster (default true)
//
// Response: { jobId: string, status: "started" }

const CLUSTER_DEFINITIES = `
- backend-infra: Supabase (schemas, edge functions, RLS), n8n workflows, scripts, API routes, database migraties, server-side integraties, DevOps, hosting, webhooks
- frontend: Lovable prototypes, dashboard widgets, UI componenten, Next.js pages, HTML email templates, React code, Tailwind styling, animaties
- klantcontact: Intake calls, offerte opstellen, klant onboarden, follow-up mails, afspraken, presentaties, klantenservice, demo's
- content: Copy schrijven, blog posts, social media content, video scripts, design werk, branding assets, images, SEO content
- admin: Facturen, financiën, planning, belasting, administratie, documentatie updates, interne organisatie, urenregistratie
- research: Concurrentie analyse, tool vergelijk, YouTube research, markt onderzoek, feature discovery, technische spikes
`.trim();

const SYSTEM_PROMPT = `Je bent een expert in het groeperen van taken voor een softwarebedrijf (Autronis).
Het bedrijf heeft twee mensen: Sem (frontend + klantcontact + content) en Syb (backend + infrastructuur).

Je krijgt een lijst taken en moet elke taak indelen in één van deze clusters:

${CLUSTER_DEFINITIES}

REGELS:
1. Kies voor elke taak precies ÉÉN cluster. Geen "diversen" of "overig".
2. Kijk naar titel + omschrijving + fase naam. De fase is vaak misleidend — negeer 'm als de titel iets anders zegt.
3. Als een taak echt niet in één categorie past, kies de dichtstbijzijnde. Wees niet bang om te kiezen.
4. Wees consistent: vergelijkbare taken moeten dezelfde cluster krijgen.

OUTPUT FORMAT: ALLEEN een JSON object, niks anders. Structuur:
{
  "assignments": [
    { "id": 123, "cluster": "backend-infra" },
    { "id": 124, "cluster": "frontend" }
  ]
}

Geen markdown code fences, geen uitleg, alleen pure JSON.`;

const VALID_CLUSTERS = new Set([
  "backend-infra",
  "frontend",
  "klantcontact",
  "content",
  "admin",
  "research",
]);

interface TaakVoorAI {
  id: number;
  titel: string;
  omschrijving: string | null;
  fase: string | null;
  projectNaam: string | null;
}

interface ClusterAssignment {
  id: number;
  cluster: string;
}

async function runJob(
  jobId: string,
  gebruikerId: number,
  projectIdFilter: number | undefined,
  onlyMissing: boolean
): Promise<void> {
  try {
    // Filter: only open tasks, belonging to visible projects for this user
    const visibleCodes: ("sem" | "syb" | "team" | "vrij")[] =
      gebruikerId === 2 ? ["syb", "team", "vrij"] : ["sem", "team", "vrij"];

    const conditions = [
      eq(taken.status, "open"),
      sql`${taken.projectId} IS NOT NULL`,
    ];
    if (onlyMissing) conditions.push(isNull(taken.cluster));
    if (projectIdFilter) conditions.push(eq(taken.projectId, projectIdFilter));

    const visibilityCondition = or(
      sql`${projecten.eigenaar} IN (${sql.join(
        visibleCodes.map((c) => sql`${c}`),
        sql`, `
      )})`,
      gebruikerId === 1 ? sql`${projecten.eigenaar} IS NULL` : sql`1=0`
    );
    if (visibilityCondition) conditions.push(visibilityCondition);

    const rows = await db
      .select({
        id: taken.id,
        titel: taken.titel,
        omschrijving: taken.omschrijving,
        fase: taken.fase,
        projectNaam: projecten.naam,
      })
      .from(taken)
      .leftJoin(projecten, eq(taken.projectId, projecten.id))
      .where(and(...conditions))
      .limit(500);

    updateJob(jobId, { totaal: rows.length });

    if (rows.length === 0) {
      markJobDone(jobId, { totaal: 0, bijgewerkt: 0, perCluster: {} });
      return;
    }

    const BATCH_SIZE = 100;
    const batches: TaakVoorAI[][] = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      batches.push(rows.slice(i, i + BATCH_SIZE));
    }

    const allAssignments: ClusterAssignment[] = [];
    const anthropic = Anthropic(undefined, "/api/taken/auto-cluster");

    for (const batch of batches) {
      const userMessage = `Groepeer deze taken in clusters. Output ALLEEN de JSON.\n\n${JSON.stringify(
        batch.map((t) => ({
          id: t.id,
          titel: t.titel,
          omschrijving: t.omschrijving?.slice(0, 300) ?? null,
          fase: t.fase,
          project: t.projectNaam,
        })),
        null,
        2
      )}`;

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const cleaned = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

      try {
        const parsed = JSON.parse(cleaned) as { assignments?: ClusterAssignment[] };
        if (Array.isArray(parsed.assignments)) {
          for (const a of parsed.assignments) {
            if (typeof a.id === "number" && VALID_CLUSTERS.has(a.cluster)) {
              allAssignments.push(a);
            }
          }
        }
      } catch {
        // Batch parse fail — skip this batch
      }
    }

    // Apply assignments + live update progress per write
    let bijgewerkt = 0;
    const perCluster: Record<string, number> = {};

    for (const assignment of allAssignments) {
      const res = await db
        .update(taken)
        .set({
          cluster: assignment.cluster,
          bijgewerktOp: new Date().toISOString(),
        })
        .where(eq(taken.id, assignment.id))
        .returning({ id: taken.id });
      if (res.length > 0) {
        bijgewerkt++;
        perCluster[assignment.cluster] = (perCluster[assignment.cluster] ?? 0) + 1;
        // Live update every 20 writes so de UI ziet progress
        if (bijgewerkt % 20 === 0) {
          updateJob(jobId, { bijgewerkt, perCluster: { ...perCluster } });
        }
      }
    }

    markJobDone(jobId, { totaal: rows.length, bijgewerkt, perCluster });
  } catch (error) {
    markJobError(jobId, error instanceof Error ? error.message : "Onbekende fout");
  }
}

export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = (await req.json().catch(() => ({}))) as {
      projectId?: number;
      onlyMissing?: boolean;
    };

    const job = createJob(gebruiker.id);

    // Fire-and-forget: run het job async. We awaiten 'm niet zodat de
    // response direct terug gaat.
    void runJob(
      job.id,
      gebruiker.id,
      body.projectId,
      body.onlyMissing !== false // default true
    );

    return NextResponse.json({ jobId: job.id, status: "started" });
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
