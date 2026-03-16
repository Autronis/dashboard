import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { secondBrainItems } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { vraag } = await req.json();

    if (!vraag || vraag.trim().length < 3) {
      return NextResponse.json(
        { fout: "Vraag moet minimaal 3 tekens zijn" },
        { status: 400 }
      );
    }

    // Haal alle niet-gearchiveerde items op
    const items = await db
      .select()
      .from(secondBrainItems)
      .where(
        and(
          eq(secondBrainItems.gebruikerId, gebruiker.id),
          eq(secondBrainItems.isGearchiveerd, 0)
        )
      )
      .all();

    if (items.length === 0) {
      return NextResponse.json({
        antwoord: "Je hebt nog geen items opgeslagen in je Second Brain.",
        bronnen: [],
      });
    }

    // Bouw context: bij 100+ items alleen titel/samenvatting/tags
    const compact = items.length > 100;
    const itemContext = items
      .map((item) => {
        const tags = item.aiTags ? JSON.parse(item.aiTags).join(", ") : "";
        if (compact) {
          return `[ID:${item.id}] ${item.titel || "Zonder titel"} | Tags: ${tags} | ${item.aiSamenvatting || ""}`;
        }
        return `[ID:${item.id}] Type: ${item.type} | Titel: ${item.titel || "Zonder titel"} | Tags: ${tags}
Samenvatting: ${item.aiSamenvatting || "Geen samenvatting"}
Inhoud: ${(item.inhoud || "").slice(0, 300)}`;
      })
      .join("\n\n");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `Je bent een kennisassistent. De gebruiker heeft deze items opgeslagen in zijn Second Brain:

${itemContext}

Beantwoord de volgende vraag op basis van deze kennis. Verwijs naar specifieke items met hun ID in het formaat [ID:X].
Als je het antwoord niet kunt vinden in de items, zeg dat eerlijk.

Vraag: ${vraag}`,
        },
      ],
    });

    const antwoord =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Extract referenced IDs from the response
    const idMatches = antwoord.match(/\[ID:(\d+)\]/g) || [];
    const bronIds = [...new Set(idMatches.map((m) => Number(m.replace(/\[ID:|]/g, ""))))];
    const bronnen = items
      .filter((item) => bronIds.includes(item.id))
      .map((item) => ({ id: item.id, titel: item.titel || "Zonder titel", type: item.type }));

    return NextResponse.json({ antwoord, bronnen });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
