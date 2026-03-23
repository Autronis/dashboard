import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { fetchNotionPageContent } from "@/lib/notion";
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
      max_tokens: 2000,
      system: `Je bent een document-editor voor Autronis. De gebruiker is Sem, de CEO. Hij wil dat je DOET, niet vraagt.

REGELS:
- Vraag NOOIT om verduidelijking. Interpreteer de instructie zo logisch mogelijk en voer het uit.
- Als Sem zegt "verbeter dit" → verbeter het direct. Geef de verbeterde tekst.
- Als Sem zegt "voeg X toe" → schrijf de nieuwe sectie uit.
- Als Sem zegt "maak korter" → herschrijf het korter.
- Als Sem zegt "ja" of bevestigt → ga door met de laatste suggestie en werk het uit.
- Geef altijd concrete output: uitgeschreven tekst, lijsten, secties. Geen vragen terug.
- Als iets onduidelijk is, kies de meest logische interpretatie en doe het.
- Schrijf in het Nederlands. Geen emoji's.
- Gebruik markdown formatting (## voor koppen, **bold**, - voor lijsten).`,
      messages: [
        {
          role: "user",
          content: `Document: "${titel}"

Huidige inhoud (als HTML):
${currentHtml.slice(0, 8000)}

Instructie: ${instructie}`,
        },
      ],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";

    return NextResponse.json({ antwoord: responseText });
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
