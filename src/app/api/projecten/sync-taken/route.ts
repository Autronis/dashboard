import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, projecten, gebruikers } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireApiKey } from "@/lib/auth";
import { createNotionDocument } from "@/lib/notion";
import { categorizeDocument } from "@/lib/ai/documenten";
import type { PlanPayload } from "@/types/documenten";

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

    // Get default user
    const defaultUser = await db.select().from(gebruikers).limit(1).get();
    const userId = defaultUser?.id ?? 1;

    // Strict normalization: lowercase, strip all non-alphanumeric, collapse whitespace
    function normalize(s: string): string {
      return s
        .trim()
        .toLowerCase()
        .replace(/[-_./\\]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
    const normalized = normalize(projectNaam);
    const compact = normalized.replace(/\s/g, "");

    // Fetch ALL active projects and match in JS (more reliable than SQL REPLACE across dialects)
    const alleProjecten = await db
      .select()
      .from(projecten)
      .where(eq(projecten.isActief, 1))
      .all();

    let project = alleProjecten.find((p) => {
      const pNorm = normalize(p.naam);
      const pCompact = pNorm.replace(/\s/g, "");
      return pNorm === normalized || pCompact === compact;
    });

    // Fallback: fuzzy substring match (when one name is contained in the other)
    if (!project && compact.length >= 5) {
      const matches = alleProjecten.filter((p) => {
        const pCompact = normalize(p.naam).replace(/\s/g, "");
        return pCompact.includes(compact) || compact.includes(pCompact);
      });
      // Only auto-pick if there is exactly ONE fuzzy match (avoid ambiguity)
      if (matches.length === 1) {
        project = matches[0];
      }
    }

    if (!project) {
      // Auto-create project if it doesn't exist
      const [nieuwProject] = await db
        .insert(projecten)
        .values({
          naam: projectNaam.trim(),
          status: "actief",
          isActief: 1,
          voortgangPercentage: 0,
          aangemaaktDoor: userId,
        })
        .returning();
      project = nieuwProject;

      // Auto-create a Plan / Roadmap document for new projects
      try {
        const user = defaultUser?.naam ?? "Claude";
        const planContent = `# ${projectNaam.trim()} — Plan & Roadmap\n\n## Doel\n_Beschrijf het doel van dit project._\n\n## Scope\n_Wat valt er binnen en buiten scope?_\n\n## Fases\n1. **Fase 1:** _..._\n2. **Fase 2:** _..._\n3. **Fase 3:** _..._\n\n## Tijdlijn\n_Wanneer moet wat af?_\n\n## Beslissingen\n_Belangrijke keuzes en waarom._`;
        const planPayload: PlanPayload = {
          type: "plan",
          titel: `${projectNaam.trim()} — Roadmap`,
          projectId: nieuwProject.id,
          status: "concept",
          content: planContent,
        };
        const samenvatting = `Plan/roadmap voor project ${projectNaam.trim()}`;
        await createNotionDocument(planPayload, samenvatting, user, undefined, projectNaam.trim());
      } catch {
        // Non-critical: don't block sync if document creation fails
      }
    }

    // Replace all mode: sync tasks from payload, respecting existing statuses
    if (replaceAll && alle_taken && alle_taken.length > 0) {
      // Get existing tasks to preserve their status
      const existing = await db
        .select({ id: taken.id, titel: taken.titel, status: taken.status })
        .from(taken)
        .where(eq(taken.projectId, project.id))
        .all();

      const existingByTitle = new Map(
        existing.map((t) => [t.titel.toLowerCase().trim(), t])
      );

      // Delete tasks not in the new payload
      const newTitles = new Set(alle_taken.map((t) => t.titel.toLowerCase().trim()));
      for (const ex of existing) {
        if (!newTitles.has(ex.titel.toLowerCase().trim())) {
          await db.delete(taken).where(eq(taken.id, ex.id));
        }
      }

      const HANDMATIG_PATTERNS = [
        /account aanmaken/i, /api.?key/i, /domein/i, /hosting/i, /betaling/i,
        /registr/i, /meeting/i, /contract/i, /offerte versturen/i, /factur.*versturen/i,
        /klant.*contact/i, /content.*schrijven/i, /logo/i, /branding/i, /kvk/i,
        /deploy.*productie/i, /live.*zetten/i, /handmatig/i, /uitprinten/i, /opsturen/i,
      ];

      for (const t of alle_taken) {
        const key = t.titel.toLowerCase().trim();
        const ex = existingByTitle.get(key);
        const uitvoerder = HANDMATIG_PATTERNS.some((p) => p.test(t.titel)) ? "handmatig" : "claude";

        // Determine status: never downgrade afgerond → open
        const payloadStatus = t.status === "afgerond" ? "afgerond" : "open";
        const finalStatus = ex?.status === "afgerond" ? "afgerond" : payloadStatus;

        if (ex) {
          // Update existing task (preserve afgerond status)
          await db.update(taken).set({
            status: finalStatus,
            fase: t.fase || null,
            volgorde: t.volgorde ?? 0,
            bijgewerktOp: sql`(datetime('now'))`,
          }).where(eq(taken.id, ex.id));
        } else {
          // Insert new task
          await db.insert(taken).values({
            projectId: project.id,
            toegewezenAan: userId,
            aangemaaktDoor: userId,
            titel: t.titel,
            status: finalStatus,
            prioriteit: "normaal",
            fase: t.fase || null,
            volgorde: t.volgorde ?? 0,
            uitvoerder,
          });
        }
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

      await db.update(projecten)
        .set({
          voortgangPercentage: voortgang,
          status: voortgang >= 100 ? "afgerond" : "actief",
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

        // Check if task already exists (case-insensitive, also check substring match)
        const bestaat = await db
          .select({ id: taken.id, titel: taken.titel })
          .from(taken)
          .where(
            and(
              eq(taken.projectId, project.id),
              sql`(LOWER(TRIM(${taken.titel})) = LOWER(TRIM(${trimmed}))
                OR LOWER(TRIM(${taken.titel})) LIKE '%' || LOWER(TRIM(${trimmed})) || '%'
                OR LOWER(TRIM(${trimmed})) LIKE '%' || LOWER(TRIM(${taken.titel})) || '%')`
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
        status: voortgang >= 100 ? "afgerond" : "actief",
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
