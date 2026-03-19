// @ts-nocheck
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { klanten, projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { like } from "drizzle-orm";
import { createEnrichedNotionPlan } from "@/lib/notion-plan-generator";
import { readdir, readFile, stat } from "fs/promises";
import path from "path";

const PROJECTS_DIR = "c:/Users/semmi/OneDrive/Claude AI/Projects";
const SKIP_DIRS = ["Claude AI", "autronis-dashboard"];

interface ParsedBrief {
  naam: string;
  doel: string;
  features: string;
  techStack: string;
}

function parseBrief(content: string): ParsedBrief {
  const lines = content.split("\n");
  const sections: Record<string, string[]> = {};
  let currentKey = "";

  for (const line of lines) {
    if (line.startsWith("Project Name:")) {
      currentKey = "naam";
      sections[currentKey] = [line.replace("Project Name:", "").trim()];
    } else if (line.startsWith("Goal:")) {
      currentKey = "doel";
      sections[currentKey] = [line.replace("Goal:", "").trim()];
    } else if (line.startsWith("Core Features:")) {
      currentKey = "features";
      sections[currentKey] = [line.replace("Core Features:", "").trim()];
    } else if (line.startsWith("Tech Stack:")) {
      currentKey = "techStack";
      sections[currentKey] = [line.replace("Tech Stack:", "").trim()];
    } else if (currentKey && line.trim()) {
      sections[currentKey].push(line.trim());
    }
  }

  return {
    naam: sections["naam"]?.join(" ") ?? "",
    doel: sections["doel"]?.join(" ") ?? "",
    features: sections["features"]?.join("\n") ?? "",
    techStack: sections["techStack"]?.join("\n") ?? "",
  };
}

export async function POST() {
  const gebruiker = await requireAuth();

  // 1. Ensure Autronis klant exists
  let autronisId: number;
  const autronis = await db
    .select()
    .from(klanten)
    .where(like(klanten.bedrijfsnaam, "%Autronis%"))
    .get();

  if (!autronis) {
    const result = await db
      .insert(klanten)
      .values({
        bedrijfsnaam: "Autronis (intern)",
        contactpersoon: "Sem",
        email: "sem@autronis.nl",
        isActief: 1,
      })
      .returning()
      .get();
    autronisId = result.id;
  } else {
    autronisId = autronis.id;
  }

  // 2. Scan projects directory
  const entries = await readdir(PROJECTS_DIR);
  const resultaten: Array<{ naam: string; status: string }> = [];
  let aangemaakt = 0;
  let overgeslagen = 0;

  for (const entry of entries) {
    if (SKIP_DIRS.includes(entry)) continue;

    const fullPath = path.join(PROJECTS_DIR, entry);
    const stats = await stat(fullPath);
    if (!stats.isDirectory()) continue;

    const briefPath = path.join(fullPath, "PROJECT_BRIEF.md");
    let briefContent: string;
    try {
      briefContent = await readFile(briefPath, "utf-8");
    } catch {
      continue; // No PROJECT_BRIEF.md, skip
    }

    // 3. Parse brief
    const parsed = parseBrief(briefContent);
    if (!parsed.naam) {
      parsed.naam = entry; // Fallback to directory name
    }

    // 4. Check if project already exists
    const bestaand = await db
      .select()
      .from(projecten)
      .where(like(projecten.naam, parsed.naam))
      .get();

    if (bestaand) {
      overgeslagen++;
      resultaten.push({ naam: parsed.naam, status: "al aanwezig" });
      continue;
    }

    // 5. Create project in dashboard
    await db.insert(projecten)
      .values({
        klantId: autronisId,
        naam: parsed.naam,
        omschrijving: parsed.doel,
        status: "actief",
        voortgangPercentage: 0,
        aangemaaktDoor: gebruiker.id,
      })
      .run();

    // 6. Create plan in Notion
    try {
      const briefContent = await readFile(path.join(PROJECTS_DIR, entry, "PROJECT_BRIEF.md"), "utf-8").catch(() => null);
      const todoContent = await readFile(path.join(PROJECTS_DIR, entry, "TODO.md"), "utf-8").catch(() => null);

      await createEnrichedNotionPlan({
        projectNaam: parsed.naam,
        briefContent: briefContent,
        todoContent: todoContent,
        status: "In Planning",
        klantNaam: "Autronis (intern)",
      });
    } catch {
      // Notion failure should not block project creation
    }

    aangemaakt++;
    resultaten.push({ naam: parsed.naam, status: "aangemaakt" });
  }

  return NextResponse.json({
    resultaat: {
      gescand: resultaten.length,
      aangemaakt,
      overgeslagen,
      projecten: resultaten,
    },
  });
}
