// @ts-nocheck
import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { Client } from "@notionhq/client";
import { db } from "@/lib/db";
import {
  facturen,
  factuurRegels,
  ideeen,
  klanten,
  projecten,
  taken,
  meetings,
  radarItems,
  leads,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, lte, sql } from "drizzle-orm";

export async function POST() {
  try {
    const gebruiker = await requireAuth();
    const nu = new Date().toISOString().split("T")[0];
    const results: Record<string, unknown> = {};

    // 1. Mark overdue invoices as te_laat
    const overdue = await db
      .update(facturen)
      .set({ status: "te_laat", bijgewerktOp: new Date().toISOString() })
      .where(
        and(
          eq(facturen.status, "verzonden"),
          eq(facturen.isActief, 1),
          lte(facturen.vervaldatum, nu)
        )
      )
      .run();
    results.overdueMarked = overdue.changes;

    // 2. Generate periodic invoices (if any recurring paid invoices are due)
    const terugkerend = await db
      .select()
      .from(facturen)
      .where(
        and(
          eq(facturen.isTerugkerend, 1),
          eq(facturen.status, "betaald"),
          eq(facturen.isActief, 1)
        )
      )
      .all();

    let periodiekeAangemaakt = 0;
    for (const f of terugkerend) {
      if (!f.betaaldOp) continue;
      const interval = f.terugkeerInterval === "wekelijks" ? 7 : 30;
      const daysSince = Math.floor(
        (Date.now() - new Date(f.betaaldOp).getTime()) / 86400000
      );
      if (daysSince < interval) continue;

      // Generate next factuurnummer
      const jaar = new Date().getFullYear();
      const maxNr = await db
        .select({ max: sql<string>`MAX(factuurnummer)` })
        .from(facturen)
        .where(sql`factuurnummer LIKE ${"AUT-" + jaar + "-%"}`)
        .get();
      const lastNum = maxNr?.max ? parseInt(maxNr.max.split("-")[2]) : 0;
      const nextNummer = `AUT-${jaar}-${String(lastNum + 1).padStart(3, "0")}`;

      const vandaag = new Date().toISOString().split("T")[0];
      const verval = new Date(Date.now() + 30 * 86400000)
        .toISOString()
        .split("T")[0];

      const [nieuw] = await db
        .insert(facturen)
        .values({
          klantId: f.klantId,
          projectId: f.projectId,
          factuurnummer: nextNummer,
          status: "concept",
          bedragExclBtw: f.bedragExclBtw,
          btwPercentage: f.btwPercentage,
          btwBedrag: f.btwBedrag,
          bedragInclBtw: f.bedragInclBtw,
          factuurdatum: vandaag,
          vervaldatum: verval,
          isTerugkerend: 1,
          terugkeerInterval: f.terugkeerInterval,
          notities: `Automatisch aangemaakt vanuit ${f.factuurnummer}`,
          isActief: 1,
          aangemaaktDoor: gebruiker.id,
        })
        .returning()
        .all();

      // Copy factuurregels
      if (nieuw) {
        const regels = await db
          .select()
          .from(factuurRegels)
          .where(eq(factuurRegels.factuurId, f.id))
          .all();
        for (const r of regels) {
          await db.insert(factuurRegels)
            .values({
              factuurId: nieuw.id,
              omschrijving: r.omschrijving,
              aantal: r.aantal,
              eenheidsprijs: r.eenheidsprijs,
              btwPercentage: r.btwPercentage,
              totaal: r.totaal,
            })
            .run();
        }
        periodiekeAangemaakt++;
      }
    }
    results.periodiekeAangemaakt = periodiekeAangemaakt;

    // 3. Count ideeën backlog
    const ideeenCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(ideeen)
      .get();
    results.ideeenTotaal = ideeenCount?.count ?? 0;

    // 4. Notion project status sync
    if (process.env.NOTION_DB_PLANNEN && process.env.NOTION_API_KEY) {
      try {
        const notionResult = await syncProjectToNotion();
        results.notionSync = notionResult;
      } catch {
        results.notionSync = "mislukt";
      }
    }

    // 5. Auto-update OVERZICHT.md
    try {
      const { writeFile, readdir, stat, readFile } = await import("fs/promises");
      const path = await import("path");

      const PROJECTS_DIR = "c:/Users/semmi/OneDrive/Claude AI/Projects";

      // Get all project directories
      const entries = await readdir(PROJECTS_DIR);
      const projectDirs: Array<{
        naam: string;
        heeftBrief: boolean;
        heeftTodo: boolean;
        doel: string;
        status: string;
        type: string;
      }> = [];

      for (const entry of entries) {
        if (entry === "Claude AI" || entry === "OVERZICHT.md") continue;
        const fullPath = path.join(PROJECTS_DIR, entry);
        const stats = await stat(fullPath).catch(() => null);
        if (!stats?.isDirectory()) continue;

        const brief = await readFile(path.join(fullPath, "PROJECT_BRIEF.md"), "utf-8").catch(() => null);
        const todo = await readFile(path.join(fullPath, "TODO.md"), "utf-8").catch(() => null);

        // Parse goal from brief
        let doel = "";
        if (brief) {
          const goalMatch = brief.match(/Goal:\s*\n([\s\S]*?)(?=\n\w+:|$)/i);
          doel = goalMatch ? goalMatch[1].trim().split("\n")[0] : "";
        }

        // Check if this project is in the ideeen table
        const idee = await db.select().from(ideeen)
          .where(sql`LOWER(REPLACE(${ideeen.naam}, ' ', '-')) = ${entry.toLowerCase()}`)
          .get();

        // Determine status
        let status = "\u26AA Onbekend";
        let type = "Project";
        if (entry === "autronis-dashboard") {
          status = "\uD83D\uDFE2 Actief";
          type = "Hoofdproject";
          doel = "Intern business dashboard voor Autronis";
        } else if (idee) {
          const statusMap: Record<string, string> = {
            gebouwd: "\u2705 Gebouwd",
            actief: "\uD83D\uDFE2 Actief",
            uitgewerkt: "\uD83D\uDFE1 Uitgewerkt",
            idee: "\u26AA Idee",
          };
          status = statusMap[idee.status || "idee"] || "\u26AA Idee";
        }

        projectDirs.push({
          naam: entry,
          heeftBrief: !!brief,
          heeftTodo: !!todo,
          doel: doel || (idee?.omschrijving ?? ""),
          status,
          type,
        });
      }

      // Get idee stats
      const ideeStats = await db.select({
        status: ideeen.status,
        count: sql<number>`COUNT(*)`,
      }).from(ideeen).groupBy(ideeen.status).all();

      const totalIdeeen = await db.select({ count: sql<number>`COUNT(*)` }).from(ideeen).get();

      // Generate markdown
      let md = `# Autronis Projecten Overzicht\n\n`;
      md += `> Automatisch gegenereerd op ${new Date().toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}\n\n`;
      md += `---\n\n`;

      // Projects table
      md += `## Projecten (${projectDirs.length})\n\n`;
      md += `| Project | Status | Doel | Brief | TODO |\n`;
      md += `|---------|--------|------|-------|------|\n`;

      // Sort: actief first, then uitgewerkt, then rest
      const statusOrder: Record<string, number> = { "\uD83D\uDFE2 Actief": 0, "\u2705 Gebouwd": 1, "\uD83D\uDFE1 Uitgewerkt": 2, "\u26AA Idee": 3, "\u26AA Onbekend": 4 };
      projectDirs.sort((a, b) => (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5));

      for (const p of projectDirs) {
        md += `| ${p.naam} | ${p.status} | ${p.doel.substring(0, 60)}${p.doel.length > 60 ? "..." : ""} | ${p.heeftBrief ? "\u2705" : "\u274C"} | ${p.heeftTodo ? "\u2705" : "\u274C"} |\n`;
      }

      md += `\n`;

      // Dashboard modules
      const overzichtModules = [
        "Dashboard (homepage, briefing, KPIs)",
        "Tijdregistratie (timer, weekoverzicht, export)",
        "Schermtijd (tracking, sessies, AI samenvatting)",
        "Meetings (upload, transcriptie, actiepunten)",
        "Klanten (CRUD, detail, projecten)",
        "CRM / Leads (kanban pipeline)",
        "Financi\u00EBn (facturen, uitgaven, bank, liquiditeit)",
        "Offertes (CRUD, PDF, versturen)",
        "Belasting (BTW, W&V, investeringen, reserveringen)",
        "Analytics (grafieken, heatmap, vergelijking)",
        "Agenda (kalender, CRUD)",
        "Taken (status, prioriteit, swipeable)",
        "Idee\u00EBn (backlog sync, AI generator, start-project)",
        "Doelen / OKR (objectives, key results)",
        "Team (verlof, declaraties, capaciteit)",
        "Kilometers (ritten, export, belasting)",
        "Wiki (kennisbank, categorie\u00EBn)",
        "Content (inzichten, posts, banners, kalender)",
        "Documenten (Notion sync, AI draft)",
        "Learning Radar (RSS, AI scoring)",
        "AI Assistent (chat, bedrijfscontext)",
        "Case Studies (video pipeline)",
        "Proposals (e-signature)",
      ];

      md += `## Dashboard Modules (${overzichtModules.length})\n\n`;
      for (const m of overzichtModules) {
        md += `- \u2705 ${m}\n`;
      }

      md += `\n`;

      // Idee stats
      md += `## Idee\u00EBn Backlog (${totalIdeeen?.count ?? 0})\n\n`;
      md += `| Status | Aantal |\n`;
      md += `|--------|--------|\n`;
      for (const s of ideeStats) {
        const emoji: Record<string, string> = { gebouwd: "\u2705", actief: "\uD83D\uDFE2", uitgewerkt: "\uD83D\uDFE1", idee: "\u26AA" };
        const statusKey = s.status ?? "idee";
        md += `| ${emoji[statusKey] || "\u26AA"} ${statusKey} | ${s.count} |\n`;
      }

      md += `\n---\n\n_Dit bestand wordt automatisch bijgewerkt door het Autronis Dashboard._\n`;

      await writeFile(path.join(PROJECTS_DIR, "OVERZICHT.md"), md, "utf-8");
      results.overzichtUpdated = true;
    } catch (e) {
      results.overzichtError = e instanceof Error ? e.message : "onbekend";
    }

    return NextResponse.json({ succes: true, results });
  } catch (error) {
    return NextResponse.json(
      {
        fout:
          error instanceof Error ? error.message : "Onbekende fout",
      },
      {
        status:
          error instanceof Error &&
          error.message === "Niet geauthenticeerd"
            ? 401
            : 500,
      }
    );
  }
}

// --- Notion project sync ---

type NotionBlock =
  | ReturnType<typeof heading2>
  | ReturnType<typeof notionParagraph>
  | ReturnType<typeof bullet>
  | ReturnType<typeof notionToDo>
  | ReturnType<typeof notionDivider>;

function heading2(text: string) {
  return { object: "block" as const, type: "heading_2" as const, heading_2: { rich_text: [{ type: "text" as const, text: { content: text } }] } };
}
function notionParagraph(text: string) {
  return { object: "block" as const, type: "paragraph" as const, paragraph: { rich_text: [{ type: "text" as const, text: { content: text } }] } };
}
function bullet(text: string) {
  return { object: "block" as const, type: "bulleted_list_item" as const, bulleted_list_item: { rich_text: [{ type: "text" as const, text: { content: text } }] } };
}
function notionToDo(text: string, checked = true) {
  return { object: "block" as const, type: "to_do" as const, to_do: { rich_text: [{ type: "text" as const, text: { content: text } }], checked } };
}
function notionDivider() {
  return { object: "block" as const, type: "divider" as const, divider: {} };
}

const DASHBOARD_MODULES = [
  { naam: "Dashboard", beschrijving: "homepage, briefing, KPIs" },
  { naam: "Tijdregistratie", beschrijving: "timer, weekoverzicht" },
  { naam: "Schermtijd", beschrijving: "tracking, sessies, AI samenvatting" },
  { naam: "Klanten", beschrijving: "CRUD, detail, projecten" },
  { naam: "Financien", beschrijving: "facturen, inkomsten, uitgaven" },
  { naam: "Offertes", beschrijving: "aanmaken, verzenden, status" },
  { naam: "CRM / Leads", beschrijving: "pipeline, activiteiten" },
  { naam: "Analytics", beschrijving: "omzet, uren, trends" },
  { naam: "Agenda", beschrijving: "afspraken, deadlines, herinneringen" },
  { naam: "Taken", beschrijving: "board, toewijzing, prioriteit" },
  { naam: "Doelen", beschrijving: "OKR, maanddoelen" },
  { naam: "Belasting", beschrijving: "BTW, deadlines, urencriterium" },
  { naam: "Kilometers", beschrijving: "registratie, zakelijke ritten" },
  { naam: "Team", beschrijving: "verlof, beschikbaarheid, onkosten" },
  { naam: "Proposals", beschrijving: "aanmaken, ondertekenen, portal" },
  { naam: "Wiki", beschrijving: "kennisbank, processen, SOPs" },
  { naam: "Ideeen", beschrijving: "backlog, AI scoring, promotie" },
  { naam: "AI Assistent", beschrijving: "chat, context-aware" },
  { naam: "Meetings", beschrijving: "transcript, samenvatting, actiepunten" },
  { naam: "Learning Radar", beschrijving: "RSS, scoring, must-reads" },
  { naam: "Content Engine", beschrijving: "posts, banners, video scripts" },
  { naam: "Instellingen", beschrijving: "bedrijfsgegevens, gebruikers" },
  { naam: "Case Studies", beschrijving: "portfolio, klantcases" },
  { naam: "Documenten", beschrijving: "bestanden, contracten, links" },
];

async function syncProjectToNotion(): Promise<string> {
  const notion = new Client({ auth: process.env.NOTION_API_KEY });
  const dbId = process.env.NOTION_DB_PLANNEN!;

  // Collect stats
  const cnt = (r: { count: number } | undefined) => r?.count ?? 0;
  const aantalKlanten = cnt(db.select({ count: sql<number>`COUNT(*)` }).from(klanten).where(eq(klanten.isActief, 1)).get());
  const aantalProjecten = cnt(db.select({ count: sql<number>`COUNT(*)` }).from(projecten).where(eq(projecten.isActief, 1)).get());
  const aantalFacturen = cnt(db.select({ count: sql<number>`COUNT(*)` }).from(facturen).where(eq(facturen.isActief, 1)).get());
  const aantalIdeeen = cnt(db.select({ count: sql<number>`COUNT(*)` }).from(ideeen).get());
  const aantalIdeeenGebouwd = cnt(db.select({ count: sql<number>`COUNT(*)` }).from(ideeen).where(eq(ideeen.status, "gebouwd")).get());
  const aantalIdeeenActief = cnt(db.select({ count: sql<number>`COUNT(*)` }).from(ideeen).where(eq(ideeen.status, "actief")).get());
  const aantalTaken = cnt(db.select({ count: sql<number>`COUNT(*)` }).from(taken).get());
  const aantalMeetings = cnt(db.select({ count: sql<number>`COUNT(*)` }).from(meetings).get());
  const aantalRadarItems = cnt(db.select({ count: sql<number>`COUNT(*)` }).from(radarItems).get());
  const aantalLeads = cnt(db.select({ count: sql<number>`COUNT(*)` }).from(leads).where(eq(leads.isActief, 1)).get());

  // Git commits
  let recentCommits: string[] = [];
  try {
    const output = execSync('git log --oneline -20 --format="%s" --since="7 days ago"', {
      cwd: process.cwd(),
      encoding: "utf-8",
    });
    recentCommits = output.trim().split("\n").filter(Boolean);
  } catch { /* git not available */ }

  // Build blocks
  const nu = new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const blocks: NotionBlock[] = [];

  blocks.push(heading2("Dashboard Status"));
  blocks.push(notionParagraph(`Laatste update: ${nu}`));
  blocks.push(notionDivider());

  blocks.push(heading2(`Modules (${DASHBOARD_MODULES.length} actief)`));
  for (const mod of DASHBOARD_MODULES) {
    blocks.push(notionToDo(`${mod.naam} (${mod.beschrijving})`, true));
  }
  blocks.push(notionDivider());

  blocks.push(heading2("Statistieken"));
  blocks.push(bullet(`${aantalKlanten} klanten`));
  blocks.push(bullet(`${aantalProjecten} projecten`));
  blocks.push(bullet(`${aantalFacturen} facturen`));
  blocks.push(bullet(`${aantalIdeeen} ideeen (${aantalIdeeenGebouwd} gebouwd, ${aantalIdeeenActief} actief)`));
  blocks.push(bullet(`${aantalTaken} taken`));
  blocks.push(bullet(`${aantalLeads} leads`));
  blocks.push(bullet(`${aantalMeetings} meetings verwerkt`));
  blocks.push(bullet(`${aantalRadarItems} Learning Radar items`));
  blocks.push(bullet(`${DASHBOARD_MODULES.length} dashboard modules`));
  blocks.push(bullet("~45 API endpoints"));
  blocks.push(bullet("48 database tabellen"));
  blocks.push(notionDivider());

  if (recentCommits.length > 0) {
    blocks.push(heading2("Recente Ontwikkelingen (laatste 7 dagen)"));
    for (const commit of recentCommits) {
      blocks.push(bullet(commit));
    }
    blocks.push(notionDivider());
  }

  blocks.push(heading2("Tech Stack"));
  blocks.push(notionParagraph("Next.js 16, React 19, SQLite, Drizzle ORM, Tailwind CSS, Framer Motion, Anthropic SDK, Tauri"));

  // Search for existing page
  const existing = await notion.databases.query({
    database_id: dbId,
    filter: { property: "Titel", title: { contains: "Autronis Dashboard" } },
  });

  if (existing.results.length > 0) {
    const pageId = existing.results[0].id;

    // Delete existing blocks
    const currentBlocks = await notion.blocks.children.list({ block_id: pageId });
    for (const block of currentBlocks.results) {
      await notion.blocks.delete({ block_id: block.id });
    }

    // Append in batches of 100
    for (let i = 0; i < blocks.length; i += 100) {
      await notion.blocks.children.append({
        block_id: pageId,
        children: blocks.slice(i, i + 100),
      });
    }

    return `bijgewerkt (${pageId})`;
  } else {
    const firstBatch = blocks.slice(0, 100);
    const page = await notion.pages.create({
      parent: { database_id: dbId },
      properties: {
        Titel: { title: [{ text: { content: "Autronis Dashboard — Project Status" } }] },
        Status: { select: { name: "Actief" } },
        "Aangemaakt door": { rich_text: [{ text: { content: "Auto-sync" } }] },
        "Aangemaakt op": { date: { start: new Date().toISOString().split("T")[0] } },
        "Document type": { rich_text: [{ text: { content: "plan" } }] },
        Samenvatting: { rich_text: [{ text: { content: "Automatisch bijgewerkt project overzicht" } }] },
      },
      children: firstBatch,
    });

    for (let i = 100; i < blocks.length; i += 100) {
      await notion.blocks.children.append({
        block_id: page.id,
        children: blocks.slice(i, i + 100),
      });
    }

    return `aangemaakt (${page.id})`;
  }
}
