import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projecten, taken, klanten } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuthOrApiKey } from "@/lib/auth";

const AUTRONIS_KLANT_ID = 4;

interface AgentTask {
  titel: string;
  fase: string;
  done: boolean;
  volgorde: number;
}

interface AgentProject {
  naam: string;
  dir: string;
  omschrijving: string;
  techStack: string[];
  taken: AgentTask[];
}

interface SyncResult {
  project: string;
  nieuw: boolean;
  takenToegevoegd: number;
  takenBijgewerkt: number;
  takenVerwijderd: number;
  totaalTaken: number;
  voortgang: number;
}

const HANDMATIG_PATTERNS = [
  /account aanmaken/i, /api.?key ophalen/i, /domein/i, /dns/i, /hosting/i,
  /betaling/i, /abonnement/i, /registr/i, /aanmeld/i,
  /design review/i, /goedkeur/i, /beslis/i,
  /meeting/i, /afspraak/i, /overleg/i,
  /contract/i, /offerte versturen/i, /factur.*versturen/i,
  /klant.*contact/i, /klant.*gesprek/i,
  /content.*schrijven/i, /blog.*schrijven/i, /tekst.*schrijven/i,
  /social media/i, /linkedin.*post/i,
  /logo/i, /branding/i, /huisstijl/i,
  /kvk/i, /btw.*nummer/i, /iban/i,
  /deploy.*productie/i, /live.*zetten/i,
  /app store/i, /play store/i, /publiceer/i,
  /wachtwoord/i, /credential/i,
  /handmatig/i, /fysiek/i, /printen/i,
];

function classifyUitvoerder(titel: string): "claude" | "handmatig" {
  return HANDMATIG_PATTERNS.some((p) => p.test(titel)) ? "handmatig" : "claude";
}

// POST /api/projecten/sync-from-agent
// Body: { projects: AgentProject[] }
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuthOrApiKey(req);
    const body = await req.json();
    const { projects } = body as { projects: AgentProject[] };

    if (!projects || !Array.isArray(projects)) {
      return NextResponse.json({ fout: "projects array is verplicht" }, { status: 400 });
    }

    const results: SyncResult[] = [];

    for (const proj of projects) {
      // Find or create project
      let project = await db
        .select({ id: projecten.id })
        .from(projecten)
        .where(eq(projecten.naam, proj.naam))
        .then((rows) => rows[0]);

      let isNieuw = false;

      if (!project) {
        const techNote = proj.techStack.length > 0 ? `\n\nTech stack: ${proj.techStack.join(", ")}` : "";
        const [created] = await db
          .insert(projecten)
          .values({
            klantId: AUTRONIS_KLANT_ID,
            naam: proj.naam,
            omschrijving: (proj.omschrijving || `Project uit ${proj.dir}/`) + techNote,
            status: "actief",
            aangemaaktDoor: gebruiker.id,
          })
          .returning({ id: projecten.id });
        project = created;
        isNieuw = true;
      }

      // Get existing tasks
      const existingTaken = await db
        .select({ id: taken.id, titel: taken.titel, status: taken.status })
        .from(taken)
        .where(eq(taken.projectId, project.id));

      const existingMap = new Map(existingTaken.map((t) => [t.titel, t]));
      const todoTitles = new Set(proj.taken.map((t) => t.titel));

      let toegevoegd = 0;
      let bijgewerkt = 0;
      let verwijderd = 0;

      // Add/update tasks
      for (const task of proj.taken) {
        const existing = existingMap.get(task.titel);
        if (!existing) {
          await db.insert(taken).values({
            projectId: project.id,
            toegewezenAan: gebruiker.id,
            aangemaaktDoor: gebruiker.id,
            titel: task.titel,
            status: task.done ? "afgerond" : "open",
            prioriteit: "normaal",
            fase: task.fase || null,
            volgorde: task.volgorde,
            uitvoerder: classifyUitvoerder(task.titel),
          });
          toegevoegd++;
        } else {
          if (task.done && existing.status !== "afgerond") {
            await db.update(taken).set({ status: "afgerond" }).where(eq(taken.id, existing.id));
            bijgewerkt++;
          } else if (!task.done && existing.status === "afgerond") {
            await db.update(taken).set({ status: "open" }).where(eq(taken.id, existing.id));
            bijgewerkt++;
          }
          await db
            .update(taken)
            .set({
              fase: task.fase || null,
              volgorde: task.volgorde,
              uitvoerder: classifyUitvoerder(task.titel),
            })
            .where(eq(taken.id, existing.id));
        }
      }

      // Remove tasks no longer in TODO.md
      if (proj.taken.length > 0) {
        for (const existing of existingTaken) {
          if (!todoTitles.has(existing.titel)) {
            await db.delete(taken).where(eq(taken.id, existing.id));
            verwijderd++;
          }
        }
      }

      // Recalculate progress
      const statsResult = await db
        .select({
          totaal: sql<number>`COUNT(*)`,
          af: sql<number>`SUM(CASE WHEN ${taken.status} = 'afgerond' THEN 1 ELSE 0 END)`,
        })
        .from(taken)
        .where(eq(taken.projectId, project.id))
        .get();
      const stats = { totaal: statsResult?.totaal ?? 0, af: statsResult?.af ?? 0 };
      const voortgang = stats.totaal > 0 ? Math.round((stats.af / stats.totaal) * 100) : 0;

      await db.update(projecten).set({ voortgangPercentage: voortgang }).where(eq(projecten.id, project.id));

      results.push({
        project: proj.naam,
        nieuw: isNieuw,
        takenToegevoegd: toegevoegd,
        takenBijgewerkt: bijgewerkt,
        takenVerwijderd: verwijderd,
        totaalTaken: stats.totaal,
        voortgang,
      });
    }

    // Trigger Notion sync for projects that have a notionPageId (fire-and-forget)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const opsToken = process.env.OPS_INTERNAL_TOKEN || "autronis-ops-2026";
    for (const result of results) {
      if (result.takenBijgewerkt > 0 || result.takenToegevoegd > 0) {
        // Find the project and check for notionPageId
        const proj = await db.select({ id: projecten.id, notionPageId: projecten.notionPageId })
          .from(projecten).where(eq(projecten.naam, result.project)).get();
        if (proj?.notionPageId) {
          fetch(`${baseUrl}/api/projecten/${proj.id}/sync-notion`, {
            method: "POST",
            headers: { "x-ops-token": opsToken },
          }).catch(() => {/* best effort */});
        }
      }
    }

    return NextResponse.json({
      succes: true,
      resultaten: results,
      totaalProjecten: results.length,
      nieuweProjecten: results.filter((r) => r.nieuw).length,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
