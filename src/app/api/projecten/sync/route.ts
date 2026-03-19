import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db, sqlite } from "@/lib/db";
import { projecten, taken, klanten } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createNotionDocument, searchNotionDocuments } from "@/lib/notion";
import { DocumentPayload } from "@/types/documenten";
import fs from "fs";
import path from "path";

const PROJECTS_DIR = path.resolve(process.cwd(), "..");
const AUTRONIS_KLANT_ID = 4;

interface ParsedTask {
  titel: string;
  fase: string;
  done: boolean;
  volgorde: number;
}

interface SyncResult {
  project: string;
  nieuw: boolean;
  takenToegevoegd: number;
  takenBijgewerkt: number;
  takenVerwijderd: number;
  totaalTaken: number;
  voortgang: number;
  techStack: string[];
  notionPlanUrl?: string;
}

// Map directory names to friendly project names
const DIR_TO_PROJECT: Record<string, string> = {
  "sales-engine": "Sales Engine",
  "investment-engine": "Investment Engine",
  "case-study-generator": "Case Study Generator",
  "learning-radar": "Learning Radar",
  "autronis-dashboard": "Autronis Dashboard",
};

// Directories to skip during sync
const SKIP_DIRS = new Set(["autronis-website"]);

function parseTodoMd(content: string): ParsedTask[] {
  const lines = content.split("\n");
  let currentFase = "";
  const tasks: ParsedTask[] = [];
  let order = 0;

  for (const line of lines) {
    const phaseMatch = line.match(/^(?:Phase|Fase)\s+\d+\s*[-–:]\s*(.+)/i);
    if (phaseMatch) {
      // Always use "Fase" (Nederlands), never "Phase"
      currentFase = line.trim().replace(/^Phase/i, "Fase");
      continue;
    }
    // Also match ### headers as phases
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

function parseProjectBrief(content: string): { naam: string; omschrijving: string } {
  const lines = content.split("\n");
  let naam = "";
  let omschrijving = "";

  for (const line of lines) {
    const titleMatch = line.match(/^#\s+(.+)/);
    if (titleMatch && !naam) {
      naam = titleMatch[1].trim();
      continue;
    }
    if (naam && !omschrijving && line.trim() && !line.startsWith("#")) {
      omschrijving = line.trim();
      break;
    }
  }
  return { naam, omschrijving };
}

function detectTechStack(dirPath: string): string[] {
  const stack: string[] = [];
  const pkgPath = path.join(dirPath, "package.json");

  if (!fs.existsSync(pkgPath)) return stack;

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    const depNames = Object.keys(allDeps);

    // Framework detection
    if (depNames.includes("next")) stack.push("Next.js");
    if (depNames.includes("vite") || fs.existsSync(path.join(dirPath, "vite.config.ts"))) stack.push("Vite");
    if (depNames.includes("react")) stack.push("React");
    if (depNames.includes("vue")) stack.push("Vue");

    // Language
    if (depNames.includes("typescript") || fs.existsSync(path.join(dirPath, "tsconfig.json"))) stack.push("TypeScript");

    // Styling
    if (depNames.includes("tailwindcss")) stack.push("Tailwind CSS");

    // Database/Backend
    if (depNames.includes("drizzle-orm")) stack.push("Drizzle ORM");
    if (depNames.includes("prisma") || depNames.includes("@prisma/client")) stack.push("Prisma");
    if (depNames.includes("better-sqlite3")) stack.push("SQLite");
    if (depNames.includes("@supabase/supabase-js")) stack.push("Supabase");

    // AI
    if (depNames.includes("@anthropic-ai/sdk")) stack.push("Claude API");
    if (depNames.includes("openai")) stack.push("OpenAI");

    // Other notable
    if (depNames.includes("@react-pdf/renderer")) stack.push("React PDF");
    if (depNames.includes("remotion")) stack.push("Remotion");
    if (depNames.includes("framer-motion")) stack.push("Framer Motion");
    if (depNames.includes("recharts")) stack.push("Recharts");
  } catch {
    // Invalid package.json
  }

  return stack;
}

// Patterns that indicate a task requires human action (not code)
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

// Check if code for a task likely exists by scanning the project directory
function detectTaskCompletion(dirPath: string, taskTitel: string): boolean {
  // Extract keywords from task title for file/code searching
  const keywords = taskTitel
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["voor", "naar", "deze", "alle", "elke", "niet", "moet", "zijn", "wordt", "maken", "toevoegen", "implementatie", "implementeer"].includes(w));

  if (keywords.length === 0) return false;

  // Check for common patterns: API routes, pages, components
  const srcPath = path.join(dirPath, "src");
  if (!fs.existsSync(srcPath)) return false;

  try {
    const allFiles = getAllFiles(srcPath);
    const fileContents = allFiles.map((f) => ({
      path: f.toLowerCase(),
      name: path.basename(f).toLowerCase(),
    }));

    // Check if any source file mentions key terms from the task
    const significantKeywords = keywords.filter((k) =>
      ["api", "page", "route", "component", "database", "schema", "dashboard", "chart", "graph", "widget",
       "login", "auth", "pdf", "email", "notification", "search", "filter", "sort", "export", "import",
       "sync", "webhook", "cron", "schedule", "pipeline", "scraper", "crawler", "parser"].includes(k) ||
      k.length > 5
    );

    if (significantKeywords.length === 0) return false;

    // If at least half the significant keywords appear in file paths, likely done
    let matchCount = 0;
    for (const kw of significantKeywords) {
      if (fileContents.some((f) => f.path.includes(kw) || f.name.includes(kw))) {
        matchCount++;
      }
    }

    return matchCount >= Math.ceil(significantKeywords.length * 0.4);
  } catch {
    return false;
  }
}

function getAllFiles(dirPath: string, files: string[] = []): string[] {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        getAllFiles(fullPath, files);
      } else if (/\.(ts|tsx|js|jsx|py|rs)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  } catch {
    // Permission errors etc
  }
  return files;
}

function isProjectDir(dirPath: string): boolean {
  // A directory is a project if it has any of these
  return (
    fs.existsSync(path.join(dirPath, "PROJECT_BRIEF.md")) ||
    fs.existsSync(path.join(dirPath, "TODO.md")) ||
    fs.existsSync(path.join(dirPath, "package.json"))
  );
}

// --- Auto-create Notion project plan ---
async function autoCreateProjectPlan(
  projectId: number,
  projectNaam: string,
  dirPath: string,
  aangemaaktDoor: string
): Promise<string | null> {
  try {
    // Check if plan already exists in Notion
    const existing = await searchNotionDocuments(projectNaam + " Projectplan");
    const hasplan = existing.some(
      (doc) =>
        doc.type === "plan" &&
        doc.titel.toLowerCase().includes(projectNaam.toLowerCase())
    );
    if (hasplan) return null;

    // Read brief + todo
    const briefPath = path.join(dirPath, "PROJECT_BRIEF.md");
    const todoPath = path.join(dirPath, "TODO.md");
    const brief = fs.existsSync(briefPath) ? fs.readFileSync(briefPath, "utf8") : null;
    const todo = fs.existsSync(todoPath) ? fs.readFileSync(todoPath, "utf8") : null;

    if (!brief && !todo) return null;

    // Build plan content
    const sections: string[] = [`Projectplan: ${projectNaam}`, ""];

    if (brief) {
      const goalMatch = brief.match(/Goal:\s*\n([\s\S]+?)(?:\n\n|\nUsers:)/);
      if (goalMatch) {
        sections.push("Doel", goalMatch[1].trim(), "");
      }
      const techMatch = brief.match(/Tech Stack:\s*\n([\s\S]+?)(?:\n\n|\nIntegrations:|$)/);
      if (techMatch) {
        sections.push("Tech Stack");
        sections.push(
          techMatch[1].split("\n").map((l) => l.replace(/^[-*]\s*/, "").trim()).filter(Boolean).map((t) => `- ${t}`).join("\n")
        );
        sections.push("");
      }
    }

    if (todo) {
      sections.push("Fases & taken", "");
      const lines = todo.split("\n");
      for (const line of lines) {
        const phaseMatch = line.match(/^(?:Phase|Fase)\s+\d+\s*[-–:]\s*(.+)/i);
        if (phaseMatch) {
          sections.push(line.trim().replace(/^Phase/i, "Fase"));
          continue;
        }
        const taskMatch = line.match(/^[-*]?\s*\[([xX ])\]\s*(.+)/);
        if (taskMatch) {
          sections.push(`${taskMatch[1].toLowerCase() === "x" ? "✅" : "⬜"} ${taskMatch[2].trim()}`);
        }
      }
      const allTasks = lines.filter((l) => l.match(/^\s*[-*]?\s*\[[xX ]\]/));
      const doneTasks = lines.filter((l) => l.match(/^\s*[-*]?\s*\[[xX]\]/));
      if (allTasks.length > 0) {
        sections.push("", `Voortgang: ${doneTasks.length}/${allTasks.length} taken (${Math.round((doneTasks.length / allTasks.length) * 100)}%)`);
      }
    }

    const content = sections.join("\n");
    const samenvatting = `Projectplan voor ${projectNaam}. Automatisch gegenereerd uit PROJECT_BRIEF.md en TODO.md.`;

    // Get klant name
    const klant = db.select({ bedrijfsnaam: klanten.bedrijfsnaam }).from(klanten).where(eq(klanten.id, AUTRONIS_KLANT_ID)).get();

    const payload: DocumentPayload = {
      type: "plan",
      titel: `${projectNaam} Projectplan`,
      projectId,
      status: "concept",
      content,
    };

    const result = await createNotionDocument(payload, samenvatting, aangemaaktDoor, klant?.bedrijfsnaam, projectNaam);
    return result.notionUrl;
  } catch {
    // Don't fail the sync if plan creation fails
    return null;
  }
}

// POST /api/projecten/sync — Scan project directories and sync to DB
export async function POST() {
  try {
    const gebruiker = await requireAuth();
    const results: SyncResult[] = [];

    // Scan all directories in Projects/
    let dirs: string[] = [];
    try {
      dirs = fs.readdirSync(PROJECTS_DIR).filter((d) => {
        if (SKIP_DIRS.has(d)) return false;
        const fullPath = path.join(PROJECTS_DIR, d);
        try {
          return fs.statSync(fullPath).isDirectory() && isProjectDir(fullPath);
        } catch {
          return false;
        }
      });
    } catch {
      return NextResponse.json({ fout: "Kan projectmappen niet lezen" }, { status: 500 });
    }

    for (const dir of dirs) {
      const dirPath = path.join(PROJECTS_DIR, dir);
      const todoPath = path.join(dirPath, "TODO.md");
      const briefPath = path.join(dirPath, "PROJECT_BRIEF.md");

      // Determine project name
      let projectNaam = DIR_TO_PROJECT[dir] || dir.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

      // Read brief for description + name override
      let omschrijving = "";
      if (fs.existsSync(briefPath)) {
        const briefContent = fs.readFileSync(briefPath, "utf8");
        const parsed = parseProjectBrief(briefContent);
        if (parsed.naam) projectNaam = parsed.naam;
        omschrijving = parsed.omschrijving;
      }

      // Detect tech stack
      const techStack = detectTechStack(dirPath);

      // Find or create project
      let isNieuw = false;
      let project = await db
        .select({ id: projecten.id })
        .from(projecten)
        .where(eq(projecten.naam, projectNaam))
        .then((rows) => rows[0]);

      if (!project) {
        const techNote = techStack.length > 0 ? `\n\nTech stack: ${techStack.join(", ")}` : "";
        const [created] = await db
          .insert(projecten)
          .values({
            klantId: AUTRONIS_KLANT_ID,
            naam: projectNaam,
            omschrijving: (omschrijving || `Project uit ${dir}/`) + techNote,
            status: "actief",
            aangemaaktDoor: gebruiker.id,
          })
          .returning({ id: projecten.id });
        project = created;
        isNieuw = true;
      }

      // Parse tasks from TODO.md
      let tasks: ParsedTask[] = [];
      if (fs.existsSync(todoPath)) {
        const todoContent = fs.readFileSync(todoPath, "utf8");
        tasks = parseTodoMd(todoContent);
      }

      // Get existing tasks for this project
      const existingTaken = await db
        .select({ id: taken.id, titel: taken.titel, status: taken.status })
        .from(taken)
        .where(eq(taken.projectId, project.id));

      const existingMap = new Map(existingTaken.map((t) => [t.titel, t]));
      const todoTitles = new Set(tasks.map((t) => t.titel));

      let toegevoegd = 0;
      let bijgewerkt = 0;
      let verwijderd = 0;

      // Add/update tasks from TODO.md
      for (const task of tasks) {
        const existing = existingMap.get(task.titel);
        if (!existing) {
          // Auto-detect if code exists for this task
          const autoDetected = !task.done && detectTaskCompletion(dirPath, task.titel);
          await db.insert(taken).values({
            projectId: project.id,
            toegewezenAan: gebruiker.id,
            aangemaaktDoor: gebruiker.id,
            titel: task.titel,
            status: task.done || autoDetected ? "afgerond" : "open",
            prioriteit: "normaal",
            fase: task.fase || null,
            volgorde: task.volgorde,
            uitvoerder: classifyUitvoerder(task.titel),
          });
          toegevoegd++;
        } else {
          // Auto-detect completion for open tasks
          const autoDetected = !task.done && existing.status !== "afgerond" && detectTaskCompletion(dirPath, task.titel);

          if ((task.done || autoDetected) && existing.status !== "afgerond") {
            await db.update(taken).set({ status: "afgerond" }).where(eq(taken.id, existing.id));
            bijgewerkt++;
          } else if (!task.done && !autoDetected && existing.status === "afgerond") {
            // Task was un-checked in TODO.md and code doesn't exist
            await db.update(taken).set({ status: "open" }).where(eq(taken.id, existing.id));
            bijgewerkt++;
          }
          // Update fase/volgorde/uitvoerder
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

      // Remove tasks that are no longer in TODO.md (only auto-synced ones)
      if (tasks.length > 0) {
        for (const existing of existingTaken) {
          if (!todoTitles.has(existing.titel)) {
            await db.delete(taken).where(eq(taken.id, existing.id));
            verwijderd++;
          }
        }
      }

      // Recalculate project progress
      const stats = sqlite
        .prepare(
          "SELECT COUNT(*) as totaal, SUM(CASE WHEN status = 'afgerond' THEN 1 ELSE 0 END) as af FROM taken WHERE project_id = ?"
        )
        .get(project.id) as { totaal: number; af: number };

      const voortgang = stats.totaal > 0 ? Math.round((stats.af / stats.totaal) * 100) : 0;
      await db.update(projecten).set({ voortgangPercentage: voortgang }).where(eq(projecten.id, project.id));

      // Auto-create Notion project plan for new projects
      let notionPlanUrl: string | undefined;
      if (isNieuw) {
        const planUrl = await autoCreateProjectPlan(project.id, projectNaam, dirPath, gebruiker.naam);
        if (planUrl) notionPlanUrl = planUrl;
      }

      results.push({
        project: projectNaam,
        nieuw: isNieuw,
        takenToegevoegd: toegevoegd,
        takenBijgewerkt: bijgewerkt,
        takenVerwijderd: verwijderd,
        totaalTaken: stats.totaal,
        voortgang,
        techStack,
        notionPlanUrl,
      });
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
