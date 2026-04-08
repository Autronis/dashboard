import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, projecten, gebruikers } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireApiKey } from "@/lib/auth";

// POST /api/projecten/sync-taken
// Body: { projectNaam: string, voltooide_taken: string[], nieuwe_taken: string[] }
// Auth: session cookie OR Bearer API key
export async function POST(req: NextRequest) {
  try {
    // Support both session auth and API key auth (for Claude Code)
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      await requireApiKey(req);
    } else {
      await requireAuth();
    }

    const body = await req.json();
    const { projectNaam, voltooide_taken, nieuwe_taken, replace_all: replaceAll, alle_taken } = body as {
      projectNaam: string;
      voltooide_taken?: string[];
      nieuwe_taken?: string[];
      replace_all?: boolean;
      alle_taken?: Array<{ titel: string; status: string; fase?: string; volgorde?: number }>;
    };

    if (!projectNaam) {
      return NextResponse.json({ fout: "projectNaam is verplicht" }, { status: 400 });
    }

    const errors: string[] = [];

    // Find project (case-insensitive)
    const project = await db
      .select()
      .from(projecten)
      .where(sql`LOWER(${projecten.naam}) = LOWER(${projectNaam})`)
      .get();

    if (!project) {
      return NextResponse.json({ fout: `Project "${projectNaam}" niet gevonden` }, { status: 404 });
    }

    // Get default user
    const defaultUser = await db.select().from(gebruikers).limit(1).get();
    const userId = defaultUser?.id ?? 1;

    // Replace all mode: delete all tasks and re-insert from payload
    if (replaceAll && alle_taken && alle_taken.length > 0) {
      await db.delete(taken).where(eq(taken.projectId, project.id));

      const HANDMATIG_PATTERNS = [
        /account aanmaken/i, /api.?key/i, /domein/i, /hosting/i, /betaling/i,
        /registr/i, /meeting/i, /contract/i, /offerte versturen/i, /factur.*versturen/i,
        /klant.*contact/i, /content.*schrijven/i, /logo/i, /branding/i, /kvk/i,
        /deploy.*productie/i, /live.*zetten/i, /handmatig/i, /uitprinten/i, /opsturen/i,
      ];

      for (const t of alle_taken) {
        const uitvoerder = HANDMATIG_PATTERNS.some((p) => p.test(t.titel)) ? "handmatig" : "claude";
        await db.insert(taken).values({
          projectId: project.id,
          toegewezenAan: userId,
          aangemaaktDoor: userId,
          titel: t.titel,
          status: t.status === "afgerond" ? "afgerond" : "open",
          prioriteit: "normaal",
          fase: t.fase || null,
          volgorde: t.volgorde ?? 0,
          uitvoerder,
        });
      }

      // Recalculate voortgang
      const stats = await db
        .select({
          totaal: sql<number>`COUNT(*)`,
          afgerond: sql<number>`SUM(CASE WHEN ${taken.status} = 'afgerond' THEN 1 ELSE 0 END)`,
        })
        .from(taken)
        .where(eq(taken.projectId, project.id))
        .get();

      const voortgang = stats && stats.totaal > 0
        ? Math.round(((stats.afgerond ?? 0) / stats.totaal) * 100)
        : 0;

      const heeftOpenTaken = stats && stats.totaal > (stats.afgerond ?? 0);

      await db.update(projecten)
        .set({
          voortgangPercentage: voortgang,
          ...(heeftOpenTaken ? { status: "actief" } : {}),
          bijgewerktOp: sql`(datetime('now'))`,
        })
        .where(eq(projecten.id, project.id));

      return NextResponse.json({
        replaced: alle_taken.length,
        voortgang,
      });
    }

    let matched = 0;
    let added = 0;

    // Mark completed tasks (fuzzy: case-insensitive substring match)
    if (voltooide_taken && voltooide_taken.length > 0) {
      // Get all non-completed tasks for this project
      const openTaken = await db
        .select()
        .from(taken)
        .where(
          and(
            eq(taken.projectId, project.id),
            sql`${taken.status} != 'afgerond'`
          )
        )
        .all();

      for (const titel of voltooide_taken) {
        const trimmed = titel.trim();
        if (!trimmed) continue;

        const lower = trimmed.toLowerCase();

        // Fuzzy match: case-insensitive substring match
        const match = openTaken.find(
          (t) =>
            t.titel.toLowerCase().includes(lower) ||
            lower.includes(t.titel.toLowerCase())
        );

        if (match) {
          await db.update(taken)
            .set({
              status: "afgerond",
              bijgewerktOp: sql`(datetime('now'))`,
            })
            .where(eq(taken.id, match.id))
            .run();
          matched++;
        } else {
          errors.push(`Geen match gevonden voor: "${trimmed}"`);
        }
      }
    }

    // Add new tasks
    if (nieuwe_taken && nieuwe_taken.length > 0) {
      const maxVolgorde = await db
        .select({ max: sql<number>`MAX(${taken.volgorde})` })
        .from(taken)
        .where(eq(taken.projectId, project.id))
        .get();
      let volgorde = (maxVolgorde?.max ?? 0) + 1;

      for (const titel of nieuwe_taken) {
        const trimmed = titel.trim();
        if (!trimmed) continue;

        // Check if task already exists (case-insensitive)
        const bestaat = await db
          .select({ id: taken.id })
          .from(taken)
          .where(
            and(
              eq(taken.projectId, project.id),
              sql`LOWER(${taken.titel}) = LOWER(${trimmed})`
            )
          )
          .get();

        if (!bestaat) {
          await db.insert(taken).values({
            projectId: project.id,
            toegewezenAan: userId,
            aangemaaktDoor: userId,
            titel: trimmed,
            status: "open",
            prioriteit: "normaal",
            uitvoerder: "claude",
            volgorde,
          }).run();
          added++;
          volgorde++;
        } else {
          errors.push(`Taak bestaat al: "${trimmed}"`);
        }
      }
    }

    // Recalculate project voortgang_percentage
    const takenStats = await db
      .select({
        totaal: sql<number>`COUNT(*)`,
        afgerond: sql<number>`SUM(CASE WHEN ${taken.status} = 'afgerond' THEN 1 ELSE 0 END)`,
      })
      .from(taken)
      .where(eq(taken.projectId, project.id))
      .get();

    const voortgang = takenStats && takenStats.totaal > 0
      ? Math.round(((takenStats.afgerond ?? 0) / takenStats.totaal) * 100)
      : 0;

    await db.update(projecten)
      .set({
        voortgangPercentage: voortgang,
        bijgewerktOp: sql`(datetime('now'))`,
      })
      .where(eq(projecten.id, project.id))
      .run();

    return NextResponse.json({ matched, added, errors });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
