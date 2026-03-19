import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createNotionDocument, searchNotionDocuments } from "@/lib/notion";
import { db } from "@/lib/db";
import { projecten, klanten } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DocumentPayload } from "@/types/documenten";
import fs from "fs";
import path from "path";

const PROJECTS_DIR = path.resolve(process.cwd(), "..");

interface ProjectPlanInput {
  projectId?: number;
  projectNaam?: string;
  forceCreate?: boolean;
}

// Generate plan content from PROJECT_BRIEF.md + TODO.md
function generatePlanContent(projectNaam: string, brief: string | null, todo: string | null): string {
  const sections: string[] = [];

  sections.push(`Projectplan: ${projectNaam}`);
  sections.push("");

  if (brief) {
    // Extract goal from brief
    const goalMatch = brief.match(/Goal:\s*\n([\s\S]+?)(?:\n\n|\nUsers:)/);
    const goal = goalMatch?.[1]?.trim();
    if (goal) {
      sections.push("Doel");
      sections.push(goal);
      sections.push("");
    }

    // Extract core features
    const featuresMatch = brief.match(/CORE FEATURES:\s*\n([\s\S]+?)(?:\n---|\nTech Stack:)/);
    if (featuresMatch) {
      sections.push("Belangrijkste features");
      const features = featuresMatch[1]
        .split(/\n\d+\.\s+/)
        .filter(Boolean)
        .map((f) => f.split("\n")[0].trim())
        .filter(Boolean);
      sections.push(features.map((f) => `- ${f}`).join("\n"));
      sections.push("");
    }

    // Extract tech stack
    const techMatch = brief.match(/Tech Stack:\s*\n([\s\S]+?)(?:\n\n|\nIntegrations:|$)/);
    if (techMatch) {
      sections.push("Tech Stack");
      const techs = techMatch[1]
        .split("\n")
        .map((l) => l.replace(/^[-*]\s*/, "").trim())
        .filter(Boolean);
      sections.push(techs.map((t) => `- ${t}`).join("\n"));
      sections.push("");
    }

    // Extract constraints
    const constraintsMatch = brief.match(/Constraints:\s*\n([\s\S]+?)$/);
    if (constraintsMatch) {
      sections.push("Beperkingen");
      const constraints = constraintsMatch[1]
        .split("\n")
        .map((l) => l.replace(/^[-*]\s*/, "").trim())
        .filter(Boolean);
      sections.push(constraints.map((c) => `- ${c}`).join("\n"));
      sections.push("");
    }
  }

  if (todo) {
    sections.push("Fases & taken");
    sections.push("");

    const lines = todo.split("\n");
    let currentPhase = "";

    for (const line of lines) {
      const phaseMatch = line.match(/^(?:Phase|Fase)\s+\d+\s*[-–:]\s*(.+)/i);
      if (phaseMatch) {
        if (currentPhase) sections.push("");
        currentPhase = line.trim().replace(/^Phase/i, "Fase");
        sections.push(currentPhase);
        continue;
      }

      const taskMatch = line.match(/^[-*]?\s*\[([xX ])\]\s*(.+)/);
      if (taskMatch) {
        const done = taskMatch[1].toLowerCase() === "x";
        const titel = taskMatch[2].trim();
        sections.push(`${done ? "✅" : "⬜"} ${titel}`);
      }
    }

    // Calculate progress
    const allTasks = lines.filter((l) => l.match(/^\s*[-*]?\s*\[[xX ]\]/));
    const doneTasks = lines.filter((l) => l.match(/^\s*[-*]?\s*\[[xX]\]/));
    if (allTasks.length > 0) {
      const pct = Math.round((doneTasks.length / allTasks.length) * 100);
      sections.push("");
      sections.push(`Voortgang: ${doneTasks.length}/${allTasks.length} taken (${pct}%)`);
    }
  }

  if (!brief && !todo) {
    sections.push("Dit projectplan wordt automatisch bijgewerkt wanneer PROJECT_BRIEF.md en TODO.md worden aangemaakt in de projectmap.");
  }

  return sections.join("\n");
}

// Generate summary for the plan document
function generateSummary(projectNaam: string, brief: string | null, todo: string | null): string {
  const parts: string[] = [`Projectplan voor ${projectNaam}.`];

  if (todo) {
    const allTasks = todo.split("\n").filter((l) => l.match(/^\s*[-*]?\s*\[[xX ]\]/));
    const doneTasks = todo.split("\n").filter((l) => l.match(/^\s*[-*]?\s*\[[xX]\]/));
    if (allTasks.length > 0) {
      const pct = Math.round((doneTasks.length / allTasks.length) * 100);
      parts.push(`${doneTasks.length}/${allTasks.length} taken afgerond (${pct}%).`);
    }
  }

  if (brief) {
    const goalMatch = brief.match(/Goal:\s*\n(.+?)(?:\n|$)/);
    if (goalMatch) {
      const shortGoal = goalMatch[1].trim().substring(0, 100);
      parts.push(shortGoal + (goalMatch[1].trim().length > 100 ? "..." : ""));
    }
  }

  return parts.join(" ");
}

// Check if a plan document already exists for this project
async function planExists(projectNaam: string): Promise<boolean> {
  try {
    const results = await searchNotionDocuments(projectNaam + " Projectplan");
    return results.some(
      (doc) =>
        doc.type === "plan" &&
        doc.titel.toLowerCase().includes(projectNaam.toLowerCase()) &&
        doc.titel.toLowerCase().includes("projectplan")
    );
  } catch {
    return false;
  }
}

// Find project directory by name
function findProjectDir(projectNaam: string): string | null {
  const nameVariants = [
    projectNaam.toLowerCase().replace(/\s+/g, "-"),
    projectNaam.toLowerCase().replace(/\s+/g, "_"),
    projectNaam.toLowerCase(),
  ];

  try {
    const dirs = fs.readdirSync(PROJECTS_DIR);
    for (const dir of dirs) {
      const dirLower = dir.toLowerCase();
      if (nameVariants.some((v) => dirLower === v || dirLower.includes(v))) {
        const fullPath = path.join(PROJECTS_DIR, dir);
        if (fs.statSync(fullPath).isDirectory()) return fullPath;
      }
    }
  } catch {
    // Can't read projects dir
  }

  return null;
}

// POST /api/documenten/auto-plan — Create project plan documents
// Body: { projectId?: number, projectNaam?: string, forceCreate?: boolean }
// If neither projectId nor projectNaam specified, creates plans for ALL projects missing one
export async function POST(request: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = (await request.json()) as ProjectPlanInput;

    const results: { project: string; status: "aangemaakt" | "bestaat_al" | "fout"; notionUrl?: string; fout?: string }[] = [];

    // Determine which projects to process
    let projectList: { id: number; naam: string; klantNaam?: string }[] = [];

    if (body.projectId) {
      const project = db
        .select({ id: projecten.id, naam: projecten.naam, klantId: projecten.klantId })
        .from(projecten)
        .where(eq(projecten.id, body.projectId))
        .get();

      if (!project) {
        return NextResponse.json({ fout: "Project niet gevonden" }, { status: 404 });
      }

      let klantNaam: string | undefined;
      if (project.klantId) {
        const klant = db.select({ bedrijfsnaam: klanten.bedrijfsnaam }).from(klanten).where(eq(klanten.id, project.klantId)).get();
        klantNaam = klant?.bedrijfsnaam;
      }

      projectList = [{ id: project.id, naam: project.naam, klantNaam }];
    } else if (body.projectNaam) {
      // Find project by name (case-insensitive)
      const allProjects = db
        .select({ id: projecten.id, naam: projecten.naam, klantId: projecten.klantId })
        .from(projecten)
        .where(eq(projecten.isActief, 1))
        .all();

      const match = allProjects.find((p) => p.naam.toLowerCase() === body.projectNaam!.toLowerCase());
      if (!match) {
        return NextResponse.json({ fout: `Project "${body.projectNaam}" niet gevonden` }, { status: 404 });
      }

      let klantNaam: string | undefined;
      if (match.klantId) {
        const klant = db.select({ bedrijfsnaam: klanten.bedrijfsnaam }).from(klanten).where(eq(klanten.id, match.klantId)).get();
        klantNaam = klant?.bedrijfsnaam;
      }

      projectList = [{ id: match.id, naam: match.naam, klantNaam }];
    } else {
      // All active projects
      const allProjects = db
        .select({ id: projecten.id, naam: projecten.naam, klantId: projecten.klantId })
        .from(projecten)
        .where(eq(projecten.isActief, 1))
        .all();

      for (const p of allProjects) {
        let klantNaam: string | undefined;
        if (p.klantId) {
          const klant = db.select({ bedrijfsnaam: klanten.bedrijfsnaam }).from(klanten).where(eq(klanten.id, p.klantId)).get();
          klantNaam = klant?.bedrijfsnaam;
        }
        projectList.push({ id: p.id, naam: p.naam, klantNaam });
      }
    }

    for (const project of projectList) {
      try {
        // Check if plan already exists (skip if not forced)
        if (!body.forceCreate) {
          const exists = await planExists(project.naam);
          if (exists) {
            results.push({ project: project.naam, status: "bestaat_al" });
            continue;
          }
        }

        // Find project directory and read files
        const dirPath = findProjectDir(project.naam);
        let brief: string | null = null;
        let todo: string | null = null;

        if (dirPath) {
          const briefPath = path.join(dirPath, "PROJECT_BRIEF.md");
          const todoPath = path.join(dirPath, "TODO.md");

          if (fs.existsSync(briefPath)) {
            brief = fs.readFileSync(briefPath, "utf8");
          }
          if (fs.existsSync(todoPath)) {
            todo = fs.readFileSync(todoPath, "utf8");
          }
        }

        // Generate content
        const content = generatePlanContent(project.naam, brief, todo);
        const samenvatting = generateSummary(project.naam, brief, todo);

        // Create Notion document
        const payload: DocumentPayload = {
          type: "plan",
          titel: `${project.naam} Projectplan`,
          projectId: project.id,
          status: "concept",
          content,
        };

        const result = await createNotionDocument(
          payload,
          samenvatting,
          gebruiker.naam,
          project.klantNaam,
          project.naam
        );

        results.push({
          project: project.naam,
          status: "aangemaakt",
          notionUrl: result.notionUrl,
        });
      } catch (err) {
        results.push({
          project: project.naam,
          status: "fout",
          fout: err instanceof Error ? err.message : "Onbekende fout",
        });
      }
    }

    return NextResponse.json({
      succes: true,
      resultaten: results,
      aangemaakt: results.filter((r) => r.status === "aangemaakt").length,
      overgeslagen: results.filter((r) => r.status === "bestaat_al").length,
      fouten: results.filter((r) => r.status === "fout").length,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
