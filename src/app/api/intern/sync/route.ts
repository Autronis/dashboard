import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, projecten, klanten, gebruikers } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

const PROJECTS_DIR = path.resolve(process.cwd(), "..");

// Only allow from localhost
function isLocalRequest(req: NextRequest): boolean {
  const host = req.headers.get("host") ?? "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
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

interface ParsedTask {
  titel: string;
  fase: string;
  done: boolean;
  volgorde: number;
}

function parseTodoMd(content: string): ParsedTask[] {
  const lines = content.split("\n");
  let currentFase = "";
  const tasks: ParsedTask[] = [];
  let order = 0;

  for (const line of lines) {
    const phaseMatch = line.match(/^(?:Phase|Fase)\s+\d+\s*[-–:]\s*(.+)/i);
    if (phaseMatch) {
      currentFase = line.trim().replace(/^Phase/i, "Fase");
      continue;
    }
    const headerMatch = line.match(/^#{2,3}\s+(.+)/);
    if (headerMatch && !line.match(/^#\s/)) {
      currentFase = headerMatch[1].trim();
      continue;
    }
    const taskMatch = line.match(/^[-*]?\s*\[([xX ])\]\s*(.+)/);
    if (taskMatch) {
      tasks.push({
        done: taskMatch[1].toLowerCase() === "x",
        titel: taskMatch[2].trim(),
        fase: currentFase,
        volgorde: order++,
      });
    }
  }
  return tasks;
}

// POST /api/intern/sync — Sync all project TODO.md files without auth
// Only accessible from localhost
export async function POST(req: NextRequest) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ fout: "Alleen lokaal toegankelijk" }, { status: 403 });
  }

  try {
    const defaultUser = await db.select().from(gebruikers).limit(1).get();
    const userId = defaultUser?.id ?? 1;

    // Find Autronis klant
    const autronisKlant = await db
      .select({ id: klanten.id })
      .from(klanten)
      .where(sql`LOWER(${klanten.bedrijfsnaam}) LIKE '%autronis%'`)
      .get();
    const klantId = autronisKlant?.id ?? 1;

    const results: Array<{
      project: string;
      nieuw: boolean;
      toegevoegd: number;
      bijgewerkt: number;
      verwijderd: number;
      voortgang: number;
    }> = [];

    // Scan project directories
    let dirs: string[];
    try {
      dirs = fs.readdirSync(PROJECTS_DIR).filter((d) => {
        const fullPath = path.join(PROJECTS_DIR, d);
        try {
          return (
            fs.statSync(fullPath).isDirectory() &&
            fs.existsSync(path.join(fullPath, "TODO.md"))
          );
        } catch {
          return false;
        }
      });
    } catch {
      return NextResponse.json({ fout: "Kan projectmappen niet lezen" }, { status: 500 });
    }

    // Also handle specific project from body (for single-project sync)
    const body = await req.json().catch(() => null);
    const singleProject = body?.projectNaam as string | undefined;
    const nieuweTaken = body?.nieuwe_taken as string[] | undefined;
    const voltooideTaken = body?.voltooide_taken as string[] | undefined;

    // If single project sync requested via body, handle that first
    if (singleProject && (nieuweTaken || voltooideTaken)) {
      const project = await db
        .select()
        .from(projecten)
        .where(sql`LOWER(${projecten.naam}) = LOWER(${singleProject})`)
        .get();

      if (project) {
        let matched = 0;
        let added = 0;

        if (voltooideTaken) {
          const openTaken = await db
            .select()
            .from(taken)
            .where(and(eq(taken.projectId, project.id), sql`${taken.status} != 'afgerond'`))
            .all();

          for (const titel of voltooideTaken) {
            const lower = titel.trim().toLowerCase();
            if (!lower) continue;
            const match = openTaken.find(
              (t) => t.titel.toLowerCase().includes(lower) || lower.includes(t.titel.toLowerCase())
            );
            if (match) {
              await db
                .update(taken)
                .set({ status: "afgerond", bijgewerktOp: sql`(datetime('now'))` })
                .where(eq(taken.id, match.id));
              matched++;
            }
          }
        }

        if (nieuweTaken) {
          const maxV = await db
            .select({ max: sql<number>`MAX(${taken.volgorde})` })
            .from(taken)
            .where(eq(taken.projectId, project.id))
            .get();
          let volgorde = (maxV?.max ?? 0) + 1;

          for (const titel of nieuweTaken) {
            const trimmed = titel.trim();
            if (!trimmed) continue;
            const bestaat = await db
              .select({ id: taken.id })
              .from(taken)
              .where(and(eq(taken.projectId, project.id), sql`LOWER(${taken.titel}) = LOWER(${trimmed})`))
              .get();

            if (!bestaat) {
              await db.insert(taken).values({
                projectId: project.id,
                toegewezenAan: userId,
                aangemaaktDoor: userId,
                titel: trimmed,
                status: "open",
                prioriteit: "normaal",
                uitvoerder: classifyUitvoerder(trimmed),
                volgorde,
              });
              added++;
              volgorde++;
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
        await db.update(projecten).set({ voortgangPercentage: voortgang, bijgewerktOp: sql`(datetime('now'))` }).where(eq(projecten.id, project.id));

        return NextResponse.json({ matched, added, voortgang });
      }
    }

    // Full TODO.md scan for all projects
    const DIR_TO_PROJECT: Record<string, string> = {
      "sales-engine": "Sales Engine",
      "investment-engine": "Investment Engine",
      "case-study-generator": "Case Study Generator",
      "learning-radar": "Learning Radar",
      "autronis-dashboard": "Autronis Dashboard",
      "agent-office--ops-room": "Agent Office / Ops Room",
    };

    for (const dir of dirs) {
      const dirPath = path.join(PROJECTS_DIR, dir);
      const todoPath = path.join(dirPath, "TODO.md");

      const projectNaam = DIR_TO_PROJECT[dir] || dir.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

      // Find or create project
      let project = await db
        .select({ id: projecten.id })
        .from(projecten)
        .where(sql`LOWER(${projecten.naam}) = LOWER(${projectNaam})`)
        .get();

      let isNieuw = false;
      if (!project) {
        const briefPath = path.join(dirPath, "PROJECT_BRIEF.md");
        let omschrijving = "";
        if (fs.existsSync(briefPath)) {
          const brief = fs.readFileSync(briefPath, "utf8");
          const descLine = brief.split("\n").find((l) => l.trim() && !l.startsWith("#"));
          if (descLine) omschrijving = descLine.trim();
        }

        const [created] = await db
          .insert(projecten)
          .values({
            klantId: klantId,
            naam: projectNaam,
            omschrijving: omschrijving || `Project uit ${dir}/`,
            status: "actief",
            aangemaaktDoor: userId,
          })
          .returning({ id: projecten.id });
        project = created;
        isNieuw = true;
      }

      // Parse TODO.md
      const todoContent = fs.readFileSync(todoPath, "utf8");
      const tasks = parseTodoMd(todoContent);

      // Get existing tasks
      const existingTaken = await db
        .select({ id: taken.id, titel: taken.titel, status: taken.status })
        .from(taken)
        .where(eq(taken.projectId, project.id));

      const existingMap = new Map(existingTaken.map((t) => [t.titel, t]));
      const todoTitles = new Set(tasks.map((t) => t.titel));

      let toegevoegd = 0;
      let bijgewerkt = 0;
      let verwijderd = 0;

      for (const task of tasks) {
        const existing = existingMap.get(task.titel);
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
            uitvoerder: classifyUitvoerder(task.titel),
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
              uitvoerder: classifyUitvoerder(task.titel),
              bijgewerktOp: sql`(datetime('now'))`,
            })
            .where(eq(taken.id, existing.id));
        }
      }

      // Remove tasks not in TODO.md anymore
      if (tasks.length > 0) {
        for (const existing of existingTaken) {
          if (!todoTitles.has(existing.titel)) {
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
      await db.update(projecten).set({ voortgangPercentage: voortgang, bijgewerktOp: sql`(datetime('now'))` }).where(eq(projecten.id, project.id));

      results.push({ project: projectNaam, nieuw: isNieuw, toegevoegd, bijgewerkt, verwijderd, voortgang });
    }

    return NextResponse.json({
      succes: true,
      resultaten: results,
      totaalProjecten: results.length,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 500 }
    );
  }
}
