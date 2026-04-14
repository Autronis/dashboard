import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";

// POST /api/taken/auto-cluster
// Stuurt alle open taken (of alleen taken zonder cluster) naar Claude
// en vraagt hem ze te groeperen in standaard Autronis clusters:
// backend-infra / frontend / klantcontact / content / admin / research.
//
// Body: { projectId?: number, onlyMissing?: boolean }
//   projectId    — beperk tot 1 project, anders alle projecten
//   onlyMissing  — als true, alleen taken zonder cluster (default true)
//
// Response: { totaal, bijgewerkt, perCluster: Record<cluster, aantal> }

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

export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = (await req.json().catch(() => ({}))) as {
      projectId?: number;
      onlyMissing?: boolean;
    };

    const projectIdFilter = body.projectId;
    const onlyMissing = body.onlyMissing !== false; // default true

    // Filter: only open tasks, belonging to visible projects for this user
    // (sem sees sem/team/vrij/null, syb sees syb/team/vrij)
    const visibleCodes: ("sem" | "syb" | "team" | "vrij")[] =
      gebruiker.id === 2 ? ["syb", "team", "vrij"] : ["sem", "team", "vrij"];

    const conditions = [
      eq(taken.status, "open"),
      // task must belong to a project — we need projectId for cluster scoping
      sql`${taken.projectId} IS NOT NULL`,
    ];
    if (onlyMissing) conditions.push(isNull(taken.cluster));
    if (projectIdFilter) conditions.push(eq(taken.projectId, projectIdFilter));

    const visibilityCondition = or(
      sql`${projecten.eigenaar} IN (${sql.join(visibleCodes.map((c) => sql`${c}`), sql`, `)})`,
      gebruiker.id === 1 ? sql`${projecten.eigenaar} IS NULL` : sql`1=0`
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
      .limit(500); // safety cap

    if (rows.length === 0) {
      return NextResponse.json({
        totaal: 0,
        bijgewerkt: 0,
        perCluster: {},
        bericht: onlyMissing
          ? "Alle open taken hebben al een cluster."
          : "Geen open taken gevonden.",
      });
    }

    // Chunk into batches of ~100 tasks per Claude call to stay within
    // context + keep responses manageable.
    const BATCH_SIZE = 100;
    const allAssignments: ClusterAssignment[] = [];
    const batches: TaakVoorAI[][] = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      batches.push(rows.slice(i, i + BATCH_SIZE));
    }

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
        // Batch parse fail — skip and continue. We log the full response in
        // tracked-anthropic so Sem kan het handmatig nakijken in de token log.
      }
    }

    // Apply assignments — update each task's cluster field
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
      }
    }

    return NextResponse.json({
      totaal: rows.length,
      bijgewerkt,
      perCluster,
      ongemapt: rows.length - bijgewerkt,
    });
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
