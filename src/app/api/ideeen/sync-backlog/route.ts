// @ts-nocheck
import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { ideeen, klanten, projecten, taken } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, isNull, like } from "drizzle-orm";
import { createEnrichedNotionPlan } from "@/lib/notion-plan-generator";

const BACKLOG_PATH = "c:/Users/semmi/OneDrive/Claude AI/Business-ideas/IDEAS_BACKLOG.md";

const STATUS_MAP: Record<string, "idee" | "uitgewerkt" | "actief" | "gebouwd"> = {
  "✅": "gebouwd",
  "🟢": "actief",
  "🟡": "uitgewerkt",
  "⚪": "idee",
};

const CATEGORIE_MAP: Record<string, string> = {
  "Dashboard Features": "dashboard",
  "Dashboard": "dashboard",
  "Klant/Verkoop": "klant_verkoop",
  "SaaS & Producten": "klant_verkoop",
  "Automation Templates": "klant_verkoop",
  "Productized Services": "klant_verkoop",
  "Intern": "intern",
  "Persoonlijke Tools": "intern",
  "Interne Tools & Persoonlijk": "intern",
  "Dev Tools": "dev_tools",
  "Claude Code & Development": "dev_tools",
  "Claude Code & Dev Tools": "dev_tools",
  "Content & Media": "content_media",
  "Video & Visual Content": "content_media",
  "Image & Design Automation": "content_media",
  "Geld & Groei": "geld_groei",
  "Experimenteel": "experimenteel",
  "Website & Branding": "website",
};

interface ParsedIdee {
  nummer: number;
  naam: string;
  status: "idee" | "uitgewerkt" | "actief" | "gebouwd";
  omschrijving: string;
  categorie: string;
}

function parseBacklog(content: string): ParsedIdee[] {
  const parsed: ParsedIdee[] = [];
  let currentCategorie = "intern";

  const lines = content.split("\n");

  for (const line of lines) {
    // Detect section headers for category
    for (const [header, cat] of Object.entries(CATEGORIE_MAP)) {
      if (line.includes(header)) {
        currentCategorie = cat;
        break;
      }
    }

    // Parse table rows: | # | Naam | Cat | Status | Omschrijving |
    // Split by pipe and filter empty segments
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim()).filter((c) => c.length > 0);
    if (cells.length < 4) continue;

    const nummerStr = cells[0];
    const nummer = parseInt(nummerStr, 10);
    if (isNaN(nummer)) continue; // Skip header/separator rows

    const naam = cells[1];
    if (naam === "Naam" || naam.startsWith("-")) continue;

    // Determine which cell is status (contains emoji) and which is omschrijving
    // Format can be 4 cols (# | Naam | Status | Omschrijving) or 5 cols (# | Naam | Cat | Status | Omschrijving)
    let statusCell: string;
    let omschrijving: string;

    if (cells.length >= 5) {
      // 5-column format: # | Naam | Cat | Status | Omschrijving
      statusCell = cells[3];
      omschrijving = cells[4] || "";
    } else {
      // 4-column format: # | Naam | Status | Omschrijving
      statusCell = cells[2];
      omschrijving = cells[3] || "";
    }

    // Map status emoji
    let status: "idee" | "uitgewerkt" | "actief" | "gebouwd" = "idee";
    for (const [emoji, mapped] of Object.entries(STATUS_MAP)) {
      if (statusCell.includes(emoji)) {
        status = mapped;
        break;
      }
    }

    // Filter out emoji-only omschrijvingen (leftover status emojis)
    const cleanOmschrijving = omschrijving.replace(/^[⚪🟡🟢✅🔵🔴☑️✔️\s]+$/, "").trim();

    parsed.push({
      nummer,
      naam,
      status,
      omschrijving: cleanOmschrijving,
      categorie: currentCategorie,
    });
  }

  return parsed;
}

const PROJECTS_DIR = "c:/Users/semmi/OneDrive/Claude AI/Projects";

function parseBriefGoal(brief: string): string {
  const goalMatch = brief.match(/Goal:\s*\n([\s\S]*?)(?=\n\w+:|$)/i);
  return goalMatch ? goalMatch[1].trim() : brief.substring(0, 200);
}

function parseTodos(todoContent: string, projectId: number, userId: number): number {
  const lines = todoContent.split("\n");
  let count = 0;
  for (const line of lines) {
    const taskMatch = line.match(/^\s*\[[ x]?\]\s*(.+)/);
    if (taskMatch) {
      db.insert(taken)
        .values({
          titel: taskMatch[1].trim(),
          projectId,
          toegewezenAan: userId,
          status: "open",
          prioriteit: "normaal",
          aangemaaktDoor: userId,
        })
        .run();
      count++;
    }
  }
  return count;
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const s = await stat(dirPath);
    return s.isDirectory();
  } catch {
    return false;
  }
}

// POST /api/ideeen/sync-backlog — sync vanuit IDEAS_BACKLOG.md
export async function POST() {
  try {
    const gebruiker = await requireAuth();

    let content: string;
    try {
      content = await readFile(BACKLOG_PATH, "utf-8");
    } catch {
      return NextResponse.json(
        { fout: `Backlog bestand niet gevonden: ${BACKLOG_PATH}` },
        { status: 404 }
      );
    }

    const parsed = parseBacklog(content);
    let nieuw = 0;
    let bijgewerkt = 0;

    for (const item of parsed) {
      const bestaand = db
        .select()
        .from(ideeen)
        .where(eq(ideeen.nummer, item.nummer))
        .get();

      if (bestaand) {
        db.update(ideeen)
          .set({
            status: item.status,
            omschrijving: item.omschrijving || bestaand.omschrijving,
            categorie: item.categorie as "dashboard" | "klant_verkoop" | "intern" | "dev_tools" | "content_media" | "geld_groei" | "experimenteel" | "website",
            naam: item.naam,
            bijgewerktOp: new Date().toISOString(),
          })
          .where(eq(ideeen.id, bestaand.id))
          .run();
        bijgewerkt++;
      } else {
        db.insert(ideeen)
          .values({
            nummer: item.nummer,
            naam: item.naam,
            status: item.status,
            omschrijving: item.omschrijving || null,
            categorie: item.categorie as "dashboard" | "klant_verkoop" | "intern" | "dev_tools" | "content_media" | "geld_groei" | "experimenteel" | "website",
            prioriteit: "normaal",
            aangemaaktDoor: gebruiker.id,
          })
          .run();
        nieuw++;
      }
    }

    // === Auto project creation for active ideas ===
    let projectenAangemaakt = 0;
    let notionDocumenten = 0;

    const actieveZonderProject = db
      .select()
      .from(ideeen)
      .where(and(eq(ideeen.status, "actief"), isNull(ideeen.projectId)))
      .all();

    for (const idee of actieveZonderProject) {
      const slug = idee.naam
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      const projectDir = path.join(PROJECTS_DIR, slug);

      if (!(await directoryExists(projectDir))) continue;

      // Read PROJECT_BRIEF.md and TODO.md
      const brief = await readFile(path.join(projectDir, "PROJECT_BRIEF.md"), "utf-8").catch(() => null);
      const todo = await readFile(path.join(projectDir, "TODO.md"), "utf-8").catch(() => null);

      // Ensure "Autronis (intern)" klant exists
      let autronisKlant = db
        .select()
        .from(klanten)
        .where(like(klanten.bedrijfsnaam, "%Autronis%"))
        .get();

      if (!autronisKlant) {
        const inserted = db
          .insert(klanten)
          .values({
            bedrijfsnaam: "Autronis (intern)",
            contactpersoon: "Sem",
            isActief: 1,
            aangemaaktDoor: gebruiker.id,
          })
          .returning()
          .get();
        autronisKlant = inserted;
      }

      // Create project
      const project = db
        .insert(projecten)
        .values({
          klantId: autronisKlant.id,
          naam: idee.naam,
          omschrijving: brief ? parseBriefGoal(brief) : idee.omschrijving,
          status: "actief",
          voortgangPercentage: 0,
          aangemaaktDoor: gebruiker.id,
        })
        .returning()
        .get();

      projectenAangemaakt++;

      // Create taken from TODO.md
      if (todo) {
        parseTodos(todo, project.id, gebruiker.id);
      }

      // Create Notion plan document
      try {
        const notionResult = await createEnrichedNotionPlan({
          projectNaam: idee.naam,
          briefContent: brief,
          todoContent: todo,
          status: "In Development",
          klantNaam: "Autronis (intern)",
        });

        db.update(ideeen)
          .set({ notionPageId: notionResult.notionId })
          .where(eq(ideeen.id, idee.id))
          .run();

        notionDocumenten++;
      } catch {
        // Non-critical: Notion sync failure should not block project creation
      }

      // Update idee with projectId
      db.update(ideeen)
        .set({
          projectId: project.id,
          bijgewerktOp: new Date().toISOString(),
        })
        .where(eq(ideeen.id, idee.id))
        .run();
    }

    return NextResponse.json({
      resultaat: {
        totaal: parsed.length,
        nieuw,
        bijgewerkt,
        projectenAangemaakt,
        notionDocumenten,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
