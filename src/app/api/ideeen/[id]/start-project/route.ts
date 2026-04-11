// @ts-nocheck
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { ideeen, projecten, klanten, taken } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, like, sql } from "drizzle-orm";
import { createEnrichedNotionPlan } from "@/lib/notion-plan-generator";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";

const PROJECTS_BASE = process.env.PROJECTS_BASE_PATH
  || (process.platform === "win32"
    ? "c:/Users/semmi/OneDrive/Claude AI/Projects"
    : `${process.env.HOME || "/Users/semmiegijs"}/Autronis/Projects`);

// POST /api/ideeen/[id]/start-project — idee omzetten naar project
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const modus: "team" | "zelf" = body.modus === "zelf" ? "zelf" : "team";

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

    const projectBrief = generateProjectBrief(idee);
    const masterPrompt = generateMasterPrompt(idee, slug);
    const rules = generateRules();

    // AI-generated detailed plan
    let todoContent: string;
    try {
      const plan = await generateDetailedPlan(idee);
      todoContent = plan.todoMd;
      // Sync fases + taken to database
      await syncPlanToDatabase(project.id, gebruiker.id, plan.fases);
    } catch {
      // Fallback to simple plan
      todoContent = generateSimpleTodo(idee);
    }

    const projectFiles = {
      "PROJECT_BRIEF.md": projectBrief,
      "MASTER_PROMPT.md": masterPrompt,
      "RULES.md": rules,
      "TODO.md": todoContent,
    };

    // Probeer lokaal aan te maken (werkt op Mac/PC, niet op Vercel)
    try {
      await mkdir(projectDir, { recursive: true });
      await Promise.all(
        Object.entries(projectFiles).map(([name, content]) =>
          writeFile(path.join(projectDir, name), content, "utf-8")
        )
      );
    } catch {
      // Lokaal aanmaken mislukt (bijv. op Vercel) — probeer via sync server
    }

    // Probeer via lokale sync server (Mac/PC via Tailscale)
    const syncUrls = [
      process.env.LOCAL_SYNC_URL,           // Expliciet geconfigureerd
      "http://100.118.188.41:3456",          // Mac via Tailscale
      "http://localhost:3456",               // Lokaal
    ].filter(Boolean);

    for (const syncUrl of syncUrls) {
      try {
        await fetch(`${syncUrl}/create-project`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.SESSION_SECRET || "autronis-dashboard-2026-geheim-minimaal-32-tekens!!"}`,
          },
          body: JSON.stringify({ slug, files: projectFiles }),
          signal: AbortSignal.timeout(5000),
        });
        break; // Eerste succesvolle sync is genoeg
      } catch {
        // Sync server niet bereikbaar — probeer volgende
      }
    }

    // 6. Plan in Notion aanmaken + notionId opslaan
    try {
      const briefContent = await readFile(path.join(projectDir, "PROJECT_BRIEF.md"), "utf-8").catch(() => null);
      const todoContent = await readFile(path.join(projectDir, "TODO.md"), "utf-8").catch(() => null);

      const notionResult = await createEnrichedNotionPlan({
        projectNaam: idee.naam,
        briefContent: briefContent,
        todoContent: todoContent,
        status: "In Development",
        klantNaam: "Autronis (intern)",
      });

      // Save notionId + projectDir on the project record
      if (notionResult?.notionId) {
        await db.update(projecten).set({
          notionPageId: notionResult.notionId,
          notionUrl: notionResult.notionUrl,
          projectDir,
        }).where(eq(projecten.id, project.id));
      }
    } catch {
      // Notion sync mislukt — project is wel aangemaakt
    }

    // Save projectDir even if Notion failed
    if (!project.projectDir) {
      await db.update(projecten).set({ projectDir }).where(eq(projecten.id, project.id));
    }

    // 7. Ops Room orchestrator triggeren — alleen bij modus "team"
    if (modus === "team") {
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
    }

    return NextResponse.json({ idee: bijgewerktIdee, project, modus }, { status: 201 });
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

async function generateDetailedPlan(idee: { naam: string; omschrijving: string | null; uitwerking: string | null }): Promise<{ todoMd: string; fases: Array<{ naam: string; taken: Array<{ titel: string; uitvoerder: "claude" | "handmatig" }> }> }> {
  const client = Anthropic();
  const context = [idee.omschrijving, idee.uitwerking].filter(Boolean).join("\n\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{
      role: "user",
      content: `Je bent een senior software architect bij Autronis, een AI- en automatiseringsbureau.

Maak een gedetailleerd stappenplan voor dit project:

PROJECT: ${idee.naam}
CONTEXT: ${context || "Geen extra context beschikbaar."}

REGELS:
- Maak 4-8 fases met duidelijke namen
- Elke fase heeft 3-8 concrete taken
- Taken moeten specifiek en uitvoerbaar zijn (geen vage taken als "project opzetten")
- Begin met setup/architectuur, eindig met testen/deploy/polish
- Tech stack: Next.js, TypeScript, Tailwind, Drizzle ORM, SQLite/Turso
- Markeer taken als "claude" (automatiseerbaar) of "handmatig" (vereist menselijke actie)
- Handmatige taken: API keys aanmaken, design review, content schrijven, accounts registreren, deploy naar productie
- Totaal 15-30 taken

Antwoord als JSON:
{
  "fases": [
    {
      "naam": "Fase 1: Setup & Architectuur",
      "taken": [
        { "titel": "Database schema ontwerpen met tabellen voor X, Y, Z", "uitvoerder": "claude" },
        { "titel": "API routes opzetten: GET/POST /api/...", "uitvoerder": "claude" }
      ]
    }
  ]
}

Alleen JSON, geen uitleg.`,
    }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Geen AI response");

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Ongeldige AI response");

  const plan = JSON.parse(jsonMatch[0]) as { fases: Array<{ naam: string; taken: Array<{ titel: string; uitvoerder: "claude" | "handmatig" }> }> };

  // Generate TODO.md
  let todoMd = `# TODO — ${idee.naam}\n\n`;
  for (const fase of plan.fases) {
    todoMd += `## ${fase.naam}\n\n`;
    for (const taak of fase.taken) {
      todoMd += `- [ ] ${taak.titel}\n`;
    }
    todoMd += "\n";
  }

  return { todoMd, fases: plan.fases };
}

async function syncPlanToDatabase(
  projectId: number,
  userId: number,
  fases: Array<{ naam: string; taken: Array<{ titel: string; uitvoerder: "claude" | "handmatig" }> }>
) {
  let volgorde = 0;
  for (const fase of fases) {
    for (const taak of fase.taken) {
      await db.insert(taken).values({
        projectId,
        toegewezenAan: userId,
        aangemaaktDoor: userId,
        titel: taak.titel,
        status: "open",
        prioriteit: "normaal",
        fase: fase.naam,
        volgorde: volgorde++,
        uitvoerder: taak.uitvoerder,
      });
    }
  }

  // Calculate and set progress
  const stats = await db
    .select({
      totaal: sql<number>`COUNT(*)`,
      af: sql<number>`SUM(CASE WHEN ${taken.status} = 'afgerond' THEN 1 ELSE 0 END)`,
    })
    .from(taken)
    .where(eq(taken.projectId, projectId))
    .get();

  const voortgang = stats && stats.totaal > 0 ? Math.round(((stats.af ?? 0) / stats.totaal) * 100) : 0;
  await db.update(projecten).set({ voortgangPercentage: voortgang }).where(eq(projecten.id, projectId));
}

// Fallback if AI fails
function generateSimpleTodo(idee: { naam: string; uitwerking: string | null }): string {
  let todoItems = "- [ ] Project opzetten\n- [ ] Basis structuur bouwen\n";
  if (idee.uitwerking) {
    const lines = idee.uitwerking.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("-") || trimmed.startsWith("*") || /^\d+\./.test(trimmed)) {
        const item = trimmed.replace(/^[-*]\s*/, "").replace(/^\d+\.\s*/, "");
        if (item.length > 3) todoItems += `- [ ] ${item}\n`;
      }
    }
  }
  todoItems += "- [ ] Testen\n- [ ] Deployen\n";
  return `# TODO — ${idee.naam}\n\n## Fases\n\n${todoItems}`;
}
