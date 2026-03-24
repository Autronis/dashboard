import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { radarItems } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

// POST /api/radar/vraag-claude
// Body: { itemId: number, vraag: string }
// Returns: { antwoord: string }
export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const { itemId, vraag } = await req.json() as { itemId: number; vraag: string };

    if (!itemId || !vraag?.trim()) {
      return NextResponse.json({ fout: "itemId en vraag zijn verplicht" }, { status: 400 });
    }

    const item = await db.select().from(radarItems).where(eq(radarItems.id, itemId)).get();
    if (!item) {
      return NextResponse.json({ fout: "Item niet gevonden" }, { status: 404 });
    }

    const context = [
      `Artikel: "${item.titel}"`,
      item.aiSamenvatting ? `AI samenvatting: ${item.aiSamenvatting}` : null,
      item.beschrijving ? `Beschrijving: ${item.beschrijving.slice(0, 300)}` : null,
      item.scoreRedenering ? `Score redenering: ${item.scoreRedenering}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `Je bent een AI-assistent voor Autronis, een AI-automatiseringsbureau voor het MKB. Je beantwoordt vragen over artikelen uit de Learning Radar.\n\n${context}\n\nVraag: ${vraag}\n\nGeef een beknopt, praktisch antwoord (max 150 woorden). In het Nederlands.`,
        },
      ],
    });

    const antwoord = message.content[0].type === "text" ? message.content[0].text : "";
    return NextResponse.json({ antwoord });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      {
        status:
          error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500,
      }
    );
  }
}
