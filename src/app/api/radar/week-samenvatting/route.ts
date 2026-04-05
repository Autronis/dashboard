import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { radarItems } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, desc } from "drizzle-orm";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";

const anthropic = Anthropic();

// POST /api/radar/week-samenvatting
// Genereert een Claude-samenvatting van bewaarde items van de afgelopen 7 dagen
// Returns: { samenvatting: string | null, aantalItems: number }
export async function POST() {
  try {
    await requireAuth();

    const weekGeleden = new Date(Date.now() - 7 * 86400000).toISOString();

    let items = await db
      .select({
        titel: radarItems.titel,
        aiSamenvatting: radarItems.aiSamenvatting,
        categorie: radarItems.categorie,
        score: radarItems.score,
      })
      .from(radarItems)
      .where(and(eq(radarItems.bewaard, 1), gte(radarItems.aangemaaktOp, weekGeleden)))
      .orderBy(desc(radarItems.score))
      .limit(20)
      .all();

    // Fallback: laatste 10 bewaarde items als geen van deze week
    if (items.length === 0) {
      items = await db
        .select({
          titel: radarItems.titel,
          aiSamenvatting: radarItems.aiSamenvatting,
          categorie: radarItems.categorie,
          score: radarItems.score,
        })
        .from(radarItems)
        .where(eq(radarItems.bewaard, 1))
        .orderBy(desc(radarItems.score))
        .limit(10)
        .all();
    }

    if (items.length === 0) {
      return NextResponse.json({ samenvatting: null, aantalItems: 0 });
    }

    const itemsList = items
      .map(
        (item, n) =>
          `${n + 1}. "${item.titel}"${
            item.aiSamenvatting ? `: ${item.aiSamenvatting.slice(0, 200)}` : ""
          } [${item.categorie || "overig"}, score: ${item.score ?? "?"}]`
      )
      .join("\n");

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `Je bent een leercoach voor Sem, founder van Autronis (AI-automatiseringsbureau voor het MKB).\n\nDeze week bewaarde Sem de volgende artikelen:\n\n${itemsList}\n\nGeef een beknopte samenvatting in 5 punten: wat zijn de belangrijkste lessen, trends of inzichten? Schrijf bondig en actionable in het Nederlands. Format als genummerde lijst. Begin elke punt met een korte vetgedrukte kop.`,
        },
      ],
    });

    const samenvatting = message.content[0].type === "text" ? message.content[0].text : "";
    return NextResponse.json({ samenvatting, aantalItems: items.length });
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
