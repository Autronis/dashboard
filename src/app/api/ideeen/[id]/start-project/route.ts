// @ts-nocheck
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { ideeen, projecten, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, like } from "drizzle-orm";
import { createEnrichedNotionPlan } from "@/lib/notion-plan-generator";

const PROJECTS_BASE = "c:/Users/semmi/OneDrive/Claude AI/Projects";

// POST /api/ideeen/[id]/start-project — idee omzetten naar project
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;

    // 1. Idee ophalen
    const idee = await db
      .select()
      .from(ideeen)
      .where(eq(ideeen.id, Number(id)))
      .get();

    if (!idee) {
      return NextResponse.json({ fout: "Idee niet gevonden." }, { status: 404 });
    }

    if (idee.status !== "idee" && idee.status !== "uitgewerkt") {
      return NextResponse.json(
        { fout: "Alleen ideeën met status 'idee' of 'uitgewerkt' kunnen gestart worden." },
        { status: 400 }
      );
    }

    // 2. Autronis (intern) klant vinden of aanmaken
    let autronisKlant = await db
      .select()
      .from(klanten)
      .where(like(klanten.bedrijfsnaam, "%Autronis%"))
      .get();

    if (!autronisKlant) {
      const [nieuw] = await db
        .insert(klanten)
        .values({
          bedrijfsnaam: "Autronis (intern)",
          contactpersoon: "Sem",
          email: "sem@autronis.nl",
          aangemaaktDoor: gebruiker.id,
        })
        .returning();
      autronisKlant = nieuw;
    }

    if (!autronisKlant) {
      return NextResponse.json({ fout: "Kon Autronis klant niet aanmaken." }, { status: 500 });
    }

    // 3. Project aanmaken
    const [project] = await db
      .insert(projecten)
      .values({
        klantId: autronisKlant.id,
        naam: idee.naam,
        omschrijving: idee.omschrijving || idee.uitwerking || `Project gestart vanuit idee #${idee.nummer || idee.id}`,
        status: "actief",
        aangemaaktDoor: gebruiker.id,
      })
      .returning();

    // 4. Idee bijwerken
    const [bijgewerktIdee] = await db
      .update(ideeen)
      .set({
        status: "actief",
        projectId: project.id,
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(ideeen.id, Number(id)))
      .returning();

    // 5. Project directory aanmaken met bestanden
    const slug = idee.naam.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const projectDir = path.join(PROJECTS_BASE, slug);

    try {
      await mkdir(projectDir, { recursive: true });

      const projectBrief = generateProjectBrief(idee);
      const masterPrompt = generateMasterPrompt(idee, slug);
      const rules = generateRules();
      const todo = generateTodo(idee);

      await Promise.all([
        writeFile(path.join(projectDir, "PROJECT_BRIEF.md"), projectBrief, "utf-8"),
        writeFile(path.join(projectDir, "MASTER_PROMPT.md"), masterPrompt, "utf-8"),
        writeFile(path.join(projectDir, "RULES.md"), rules, "utf-8"),
        writeFile(path.join(projectDir, "TODO.md"), todo, "utf-8"),
      ]);
    } catch {
      // Directory aanmaken mislukt — project is wel aangemaakt in DB
    }

    // 6. Plan in Notion aanmaken
    try {
      const briefContent = await readFile(path.join(projectDir, "PROJECT_BRIEF.md"), "utf-8").catch(() => null);
      const todoContent = await readFile(path.join(projectDir, "TODO.md"), "utf-8").catch(() => null);

      await createEnrichedNotionPlan({
        projectNaam: idee.naam,
        briefContent: briefContent,
        todoContent: todoContent,
        status: "In Development",
        klantNaam: "Autronis (intern)",
      });
    } catch {
      // Notion sync mislukt — project is wel aangemaakt
    }

    // 7. Ops Room orchestrator triggeren — Theo maakt een plan
    try {
      const beschrijving = idee.uitwerking || idee.omschrijving || idee.naam;
      const opsCommand = `Nieuw project: ${idee.naam}. ${beschrijving}. Maak een plan en wijs builders toe.`;
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      await fetch(`${baseUrl}/api/ops-room/orchestrate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ops-token": process.env.OPS_INTERNAL_TOKEN || "autronis-ops-2026",
        },
        body: JSON.stringify({
          opdracht: opsCommand,
          projectId: project.id,
          bron: "ideeen",
        }),
      });
    } catch {
      // Ops Room trigger mislukt — project is wel aangemaakt
    }

    return NextResponse.json({ idee: bijgewerktIdee, project }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

function generateProjectBrief(idee: { naam: string; nummer: number | null; omschrijving: string | null; uitwerking: string | null }): string {
  return `# ${idee.naam}

## Overzicht
${idee.omschrijving || "Geen omschrijving beschikbaar."}

## Uitwerking
${idee.uitwerking || "Nog geen uitwerking beschikbaar."}

## Referentie
- Idee nummer: ${idee.nummer || "N/A"}
- Gestart op: ${new Date().toISOString().split("T")[0]}
`;
}

function generateMasterPrompt(idee: { naam: string; omschrijving: string | null }, slug: string): string {
  return `# Master Prompt — ${idee.naam}

## Context
Je werkt aan het project "${idee.naam}" in de directory \`${slug}/\`.

${idee.omschrijving || ""}

## Instructies
- Lees eerst PROJECT_BRIEF.md voor volledige context
- Volg de regels in RULES.md
- Werk de TODO.md bij na elke stap
- Commit regelmatig met duidelijke commit messages

## Tech Stack
Bepaal de juiste tech stack op basis van het project type.
`;
}

function generateRules(): string {
  return `# Coding Rules

## Algemeen
- TypeScript, nooit plain JavaScript
- Nooit \`any\` gebruiken
- Nooit \`console.log\` in productie code
- Code in het Engels, UI-teksten in het Nederlands

## Git
- Commit messages in het Engels
- Kleine, logische commits
- Branch per feature

## Code Kwaliteit
- DRY — Don't Repeat Yourself
- KISS — Keep It Simple, Stupid
- Functies kort en gefocust houden
- Duidelijke naamgeving
`;
}

function generateTodo(idee: { naam: string; uitwerking: string | null }): string {
  let todoItems = "- [ ] Project opzetten\n- [ ] Basis structuur bouwen\n";

  if (idee.uitwerking) {
    const lines = idee.uitwerking.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("-") || trimmed.startsWith("*") || /^\d+\./.test(trimmed)) {
        const item = trimmed.replace(/^[-*]\s*/, "").replace(/^\d+\.\s*/, "");
        if (item.length > 3) {
          todoItems += `- [ ] ${item}\n`;
        }
      }
    }
  }

  todoItems += "- [ ] Testen\n- [ ] Deployen\n";

  return `# TODO — ${idee.naam}

## Fases

${todoItems}`;
}
