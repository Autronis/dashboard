import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, projecten, gebruikers } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireApiKey } from "@/lib/auth";

interface SyncTask {
  titel: string;
  fase?: string;
  done: boolean;
  volgorde: number;
  uitvoerder?: "claude" | "handmatig";
}

interface SyncProject {
  projectNaam: string;
  taken: SyncTask[];
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

// POST /api/v1/sync
// Auth: Bearer API key
// Body: { projecten: [{ projectNaam, taken: [{ titel, fase, done, volgorde }] }] }
export async function POST(req: NextRequest) {
  try {
    const userId = await requireApiKey(req);

    const body = await req.json();
    const { projecten: syncProjecten } = body as { projecten: SyncProject[] };

    if (!syncProjecten || !Array.isArray(syncProjecten)) {
      return NextResponse.json({ fout: "projecten array is verplicht" }, { status: 400 });
    }

    const results: Array<{
      project: string;
      toegevoegd: number;
      bijgewerkt: number;
      verwijderd: number;
      voortgang: number;
    }> = [];

    for (const syncProject of syncProjecten) {
      const { projectNaam, taken: syncTaken } = syncProject;

      if (!projectNaam || !Array.isArray(syncTaken)) continue;

      // Find project (case-insensitive)
      const project = await db
        .select({ id: projecten.id })
        .from(projecten)
        .where(sql`LOWER(${projecten.naam}) = LOWER(${projectNaam})`)
        .get();

      if (!project) continue;

      // Get existing tasks
      const existingTaken = await db
        .select({ id: taken.id, titel: taken.titel, status: taken.status })
        .from(taken)
        .where(eq(taken.projectId, project.id));

      const existingMap = new Map(existingTaken.map((t) => [t.titel, t]));
      const syncTitles = new Set(syncTaken.map((t) => t.titel));

      let toegevoegd = 0;
      let bijgewerkt = 0;
      let verwijderd = 0;

      // Add/update tasks
      for (const task of syncTaken) {
        const existing = existingMap.get(task.titel);
        const uitvoerder = task.uitvoerder ?? classifyUitvoerder(task.titel);

        if (!existing) {
          await db.insert(taken).values({
            projectId: project.id,
            toegewezenAan: userId,
            aangemaaktDoor: userId,
            titel: task.titel,
            status: task.done ? "afgerond" : "open",
            prioriteit: "normaal",
            fase: task.fase || null,
            volgorde: task.volgorde,
            uitvoerder,
          });
          toegevoegd++;
        } else {
          const newStatus = task.done ? "afgerond" : "open";
          if (
            (task.done && existing.status !== "afgerond") ||
            (!task.done && existing.status === "afgerond")
          ) {
            bijgewerkt++;
          }
          await db
            .update(taken)
            .set({
              status: newStatus,
              fase: task.fase || null,
              volgorde: task.volgorde,
              uitvoerder,
              bijgewerktOp: sql`(datetime('now'))`,
            })
            .where(eq(taken.id, existing.id));
        }
      }

      // Remove tasks not in TODO.md anymore
      if (syncTaken.length > 0) {
        for (const existing of existingTaken) {
          if (!syncTitles.has(existing.titel)) {
            await db.delete(taken).where(eq(taken.id, existing.id));
            verwijderd++;
          }
        }
      }

      // Recalculate progress
      const stats = await db
        .select({
          totaal: sql<number>`COUNT(*)`,
          af: sql<number>`SUM(CASE WHEN ${taken.status} = 'afgerond' THEN 1 ELSE 0 END)`,
        })
        .from(taken)
        .where(eq(taken.projectId, project.id))
        .get();

      const voortgang = stats && stats.totaal > 0 ? Math.round(((stats.af ?? 0) / stats.totaal) * 100) : 0;
      await db
        .update(projecten)
        .set({ voortgangPercentage: voortgang, bijgewerktOp: sql`(datetime('now'))` })
        .where(eq(projecten.id, project.id));

      results.push({ project: projectNaam, toegevoegd, bijgewerkt, verwijderd, voortgang });
    }

    return NextResponse.json({ succes: true, resultaten: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    const status = message === "API key vereist" || message === "Ongeldige API key" ? 401 : 500;
    return NextResponse.json({ fout: message }, { status });
  }
}
