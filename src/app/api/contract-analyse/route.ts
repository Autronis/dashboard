import { NextRequest, NextResponse } from "next/server";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";
import { requireAuth } from "@/lib/auth";

const anthropic = Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
    const { base64, mediaType, bestandsnaam } = body as {
      base64: string;
      mediaType: string;
      bestandsnaam: string;
    };

    if (!base64 || !mediaType) {
      return NextResponse.json({ fout: "Geen bestand ontvangen." }, { status: 400 });
    }

    const message = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: mediaType as "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: `Analyseer dit document grondig als een juridisch adviseur. Geef een gestructureerde analyse in het Nederlands met de volgende secties:

**1. SAMENVATTING**
Wat is dit document in 2-3 zinnen?

**2. KERNPUNTEN**
De belangrijkste afspraken en condities (gebruik bullet points).

**3. RISICO'S & ADDERS**
Alles waar de ondertekenaar op moet letten: valkuilen, ongunstige clausules, verborgen verplichtingen. Markeer hoog-risico items duidelijk.

**4. VERPLICHTINGEN**
Wat MOET de ondertekenaar doen? Acties, betalingen, meldingen, deadlines.

**5. FINANCIEEL OVERZICHT**
Alle bedragen, tarieven, boetes, kosten. Inclusief indexeringen of variabele kosten.

**6. DEADLINES & TERMIJNEN**
Alle relevante datums: ingangsdatum, looptijd, opzegtermijnen, verlengingen.

**7. WAT TE CONTROLEREN VOOR ONDERTEKENING**
Concrete checklist van punten om te verifiëren of te onderhandelen.

Bestandsnaam: ${bestandsnaam}

Wees direct en concreet. Geen juridisch jargon zonder uitleg.`,
            },
          ],
        },
      ],
    });

    const tekstBlok = message.content.find((b) => b.type === "text");
    const analyse = tekstBlok?.type === "text" ? tekstBlok.text : "";

    return NextResponse.json({ analyse });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
