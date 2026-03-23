import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { fetchNotionPageContent, replaceNotionPageContent } from "@/lib/notion";
import Anthropic from "@anthropic-ai/sdk";

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

    // Fetch current content from Notion
    const currentHtml = await fetchNotionPageContent(id);

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

    // Split response: document content vs change note
    const parts = responseText.split(/\n---\n/);
    const newContent = parts[0].trim();
    const changeNote = parts[1]?.trim() || "Document bijgewerkt";

    // Write the new content back to Notion
    await replaceNotionPageContent(id, newContent);

    // Re-fetch the updated HTML for the preview
    const updatedHtml = await fetchNotionPageContent(id);

    return NextResponse.json({
      antwoord: changeNote,
      updatedHtml,
    });
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
