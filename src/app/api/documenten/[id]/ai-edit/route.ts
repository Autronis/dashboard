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
      system: `Je bent een document-editor voor Autronis. Je krijgt de huidige inhoud van een document en een instructie van de gebruiker.

Geef je antwoord als een kort, behulpzaam bericht. Als de gebruiker vraagt om wijzigingen, beschrijf wat je zou aanpassen en geef concrete suggesties.
Als de gebruiker een vraag stelt over de inhoud, beantwoord die.

Schrijf altijd in het Nederlands. Wees beknopt maar nuttig.`,
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
