import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { fetchNotionPageContent, replaceNotionPageContent } from "@/lib/notion";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

// POST — Start a background AI edit job
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const { instructie, titel } = (await request.json()) as { instructie: string; titel: string };

    if (!instructie?.trim()) {
      return NextResponse.json({ fout: "Instructie is verplicht" }, { status: 400 });
    }

    // Ensure table exists
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS document_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        notion_id TEXT NOT NULL,
        titel TEXT NOT NULL,
        instructie TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        antwoord TEXT,
        fout TEXT,
        aangemaakt TEXT DEFAULT (datetime('now')),
        bijgewerkt TEXT DEFAULT (datetime('now'))
      )
    `);

    // Create job in DB
    const now = new Date().toISOString();
    await db.run(sql`
      INSERT INTO document_jobs (notion_id, titel, instructie, status, aangemaakt, bijgewerkt)
      VALUES (${id}, ${titel}, ${instructie}, 'bezig', ${now}, ${now})
    `);
    const job = await db.all(sql`SELECT id FROM document_jobs ORDER BY id DESC LIMIT 1`) as { id: number }[];
    const jobId = job[0]?.id;

    // Run the AI edit in the background (don't await)
    runAiEdit(jobId, id, titel, instructie).catch(() => {});

    return NextResponse.json({ jobId });
  } catch (error) {
    if (error instanceof Error && error.message === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
    }
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "AI edit mislukt" },
      { status: 500 }
    );
  }
}

// GET — Check job status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const jobIdParam = request.nextUrl.searchParams.get("jobId");

    if (jobIdParam) {
      // Get specific job
      const jobs = await db.all(sql`
        SELECT id, status, antwoord, fout FROM document_jobs WHERE id = ${Number(jobIdParam)}
      `) as { id: number; status: string; antwoord: string | null; fout: string | null }[];
      const job = jobs[0];
      if (!job) return NextResponse.json({ fout: "Job niet gevonden" }, { status: 404 });

      let updatedHtml: string | undefined;
      if (job.status === "klaar") {
        updatedHtml = await fetchNotionPageContent(id);
      }

      return NextResponse.json({
        status: job.status,
        antwoord: job.antwoord,
        fout: job.fout,
        updatedHtml,
      });
    }

    // Get latest job for this document
    const jobs = await db.all(sql`
      SELECT id, status, antwoord, fout, instructie FROM document_jobs
      WHERE notion_id = ${id}
      ORDER BY id DESC LIMIT 1
    `) as { id: number; status: string; antwoord: string | null; fout: string | null; instructie: string }[];

    if (!jobs.length) return NextResponse.json({ status: "geen" });

    const job = jobs[0];
    let updatedHtml: string | undefined;
    if (job.status === "klaar") {
      updatedHtml = await fetchNotionPageContent(id);
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      antwoord: job.antwoord,
      fout: job.fout,
      instructie: job.instructie,
      updatedHtml,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
    }
    return NextResponse.json({ fout: "Kon status niet ophalen" }, { status: 500 });
  }
}

// Background AI edit function
async function runAiEdit(jobId: number, notionId: string, titel: string, instructie: string) {
  try {
    const currentHtml = await fetchNotionPageContent(notionId);

    const client = new Anthropic();
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      system: `Je bent een document-editor voor het Autronis Dashboard. De gebruiker is Sem, de CEO. Hij wil dat je het document DIRECT aanpast.

OVER AUTRONIS DASHBOARD:
Het is een intern dashboard gebouwd met Next.js, TypeScript, Tailwind CSS, SQLite/Drizzle ORM.
Huidige modules/pagina's: Dashboard (KPIs, dagbriefing), Agenda, Taken, Tijd (screen time tracking), Focus, Meetings, Ops Room (AI agent team), Projecten, Klanten, Leads, Sales Engine, Outreach (email), Offertes, Contracten, Financien (facturen), Belasting, Kilometers, Analytics, Gewoontes, Doelen, Ideeen, Concurrenten, Content, Case Studies, Documenten (Notion-backed), Wiki, Learning Radar, Second Brain, Team.
De datum is vandaag: ${new Date().toISOString().split("T")[0]}.

REGELS:
- Vraag NOOIT om verduidelijking. Voer de instructie direct uit.
- Je output wordt direct opgeslagen als het nieuwe document in Notion.
- Schrijf het VOLLEDIGE aangepaste document. Behoud alle bestaande content tenzij expliciet anders.
- Gebruik markdown: # H1, ## H2, ### H3, **bold**, - bullets, 1. nummers
- Schrijf in het Nederlands. Geen emoji's.
- Gebruik correcte datums (vandaag, niet fictief).

BELANGRIJK: Begin ALTIJD met het volledige document. Voeg daarna optioneel na een --- scheiding een korte notitie toe over wat je gewijzigd hebt (max 1-2 zinnen).`,
      messages: [
        {
          role: "user",
          content: `Document: "${titel}"

Huidige inhoud (als HTML):
${currentHtml.slice(0, 30000)}

Instructie: ${instructie}`,
        },
      ],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    const parts = responseText.split(/\n---\n/);
    const newContent = parts[0].trim();
    const changeNote = parts[1]?.trim() || "Document bijgewerkt";

    // Write to Notion
    await replaceNotionPageContent(notionId, newContent);

    // Update job as done
    const now = new Date().toISOString();
    await db.run(sql`
      UPDATE document_jobs SET status = 'klaar', antwoord = ${changeNote}, bijgewerkt = ${now}
      WHERE id = ${jobId}
    `);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const now = new Date().toISOString();
    await db.run(sql`
      UPDATE document_jobs SET status = 'fout', fout = ${errMsg}, bijgewerkt = ${now}
      WHERE id = ${jobId}
    `);
  }
}
