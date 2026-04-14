import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projectIntakes } from "@/lib/db/schema";
import { requireAuthOrApiKey } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Invalshoek {
  naam: string;
  beschrijving: string;
  impact: string;
  aanpak: string;
}

// POST /api/projecten/intake/[id]/invalshoeken
// Uses the current klantConcept on the intake to ask Claude for 3-5 creative
// automation angles. Stores them as JSON on creatieveIdeeen and bumps stap.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuthOrApiKey(req);
    const { id } = await params;
    const intakeId = parseInt(id, 10);
    if (isNaN(intakeId)) {
      return NextResponse.json({ fout: "Ongeldig ID" }, { status: 400 });
    }

    const [intake] = await db
      .select()
      .from(projectIntakes)
      .where(eq(projectIntakes.id, intakeId));

    if (!intake) {
      return NextResponse.json({ fout: "Intake niet gevonden" }, { status: 404 });
    }
    if (!intake.klantConcept || intake.klantConcept.trim().length < 20) {
      return NextResponse.json(
        { fout: "klantConcept ontbreekt of is te kort — minimaal 20 tekens nodig" },
        { status: 400 }
      );
    }

    const client = Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `Je bent een senior automation consultant bij Autronis. Op basis van onderstaande klantinformatie, genereer 3 tot 5 creatieve richtingen (invalshoeken) waarop Autronis waarde kan leveren. Elke richting is een ander angle/hoek — geen variaties op hetzelfde thema.

KLANT INFORMATIE:
${intake.klantConcept}

Lever JSON terug in exact dit formaat, geen markdown, geen uitleg eromheen:
{
  "invalshoeken": [
    {
      "naam": "Korte pakkende naam (max 6 woorden)",
      "beschrijving": "Wat we bouwen/automatiseren, 1-2 zinnen",
      "impact": "Waarom dit waardevol is voor de klant, 1 zin",
      "aanpak": "Hoe we het in hoofdlijnen aanpakken, 1 zin"
    }
  ]
}

Regels:
- Geef 3 tot 5 invalshoeken, niet meer
- Elke invalshoek moet een HELE ANDERE aanpak zijn (niet "email automation v1" vs "email automation v2")
- Wees concreet, niet vaag ("lead opvolging automatiseren met AI-intake" ipv "marketing verbeteren")
- Denk in termen van meetbare impact (tijdwinst, omzet, foutreductie, klanttevredenheid)
- Gebruik de tech stack van Autronis: n8n, Claude API, Supabase, Next.js waar passend`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ fout: "Onverwacht AI response type" }, { status: 500 });
    }

    let parsed: { invalshoeken: Invalshoek[] };
    try {
      // Strip potential markdown code fences
      const raw = content.text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      return NextResponse.json(
        {
          fout: "AI response was geen geldige JSON",
          rawResponse: content.text,
          parseError: parseErr instanceof Error ? parseErr.message : String(parseErr),
        },
        { status: 500 }
      );
    }

    if (!Array.isArray(parsed.invalshoeken) || parsed.invalshoeken.length < 3) {
      return NextResponse.json(
        { fout: "AI leverde minder dan 3 invalshoeken" },
        { status: 500 }
      );
    }

    const ideeenJson = JSON.stringify(parsed.invalshoeken);

    const [updated] = await db
      .update(projectIntakes)
      .set({
        creatieveIdeeen: ideeenJson,
        stap: "invalshoeken",
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(projectIntakes.id, intakeId))
      .returning();

    return NextResponse.json({
      intake: updated,
      invalshoeken: parsed.invalshoeken,
    });
  } catch (error) {
    console.error("[intake invalshoeken]", error);
    return NextResponse.json(
      {
        fout: error instanceof Error ? error.message : "Invalshoeken genereren mislukt",
      },
      { status: 500 }
    );
  }
}
