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
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8000,
      system: `Je bent een document-editor voor Autronis. De gebruiker is Sem, de CEO. Hij wil dat je het document DIRECT aanpast.

REGELS:
- Vraag NOOIT om verduidelijking. Interpreteer de instructie en voer het uit.
- Je output wordt direct opgeslagen als het nieuwe document. Schrijf het VOLLEDIGE aangepaste document.
- Behoud alle bestaande content tenzij de instructie zegt om iets te verwijderen of verkorten.
- Gebruik markdown: # H1, ## H2, ### H3, **bold**, - bullets, 1. nummers
- Schrijf in het Nederlands. Geen emoji's.

BELANGRIJK: Je output is het NIEUWE DOCUMENT. Niet een beschrijving van wat je zou doen, maar het daadwerkelijke document.
Als de instructie een kleine aanpassing is (bijv. "voeg een sectie toe"), geef dan het hele document terug met die aanpassing erin.
Als de instructie "samenvatten" of "actiepunten" is, geef dan een samenvatting/actiepunten maar behoud ook het originele document.

Begin je antwoord ALTIJD met het document zelf. Voeg daarna optioneel een korte notitie toe na een --- scheiding over wat je gewijzigd hebt.`,
      messages: [
        {
          role: "user",
          content: `Document: "${titel}"

Huidige inhoud (als HTML):
${currentHtml.slice(0, 12000)}

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
