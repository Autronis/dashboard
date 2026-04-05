import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { secondBrainItems } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";

const anthropic = Anthropic();

export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json() as {
      vraag: string;
      geschiedenis?: { vraag: string; antwoord: string }[];
    };
    const { vraag, geschiedenis = [] } = body;

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
        let tags = "";
        try { tags = item.aiTags ? JSON.parse(item.aiTags).join(", ") : ""; } catch { /* malformed tags */ }
        if (compact) {
          return `[ID:${item.id}] ${item.titel || "Zonder titel"} | Tags: ${tags} | ${item.aiSamenvatting || ""}`;
        }
        return `[ID:${item.id}] Type: ${item.type} | Titel: ${item.titel || "Zonder titel"} | Tags: ${tags}
Samenvatting: ${item.aiSamenvatting || "Geen samenvatting"}
Inhoud: ${(item.inhoud || "").slice(0, 300)}`;
      })
      .join("\n\n");

    // Build conversation history (last 3 pairs)
    const recentHistory = geschiedenis.slice(-3);
    const historyMessages: { role: "user" | "assistant"; content: string }[] = [];
    for (const qa of recentHistory) {
      historyMessages.push({ role: "user", content: qa.vraag });
      historyMessages.push({ role: "assistant", content: qa.antwoord });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: `Je bent een kennisassistent. De gebruiker heeft deze items opgeslagen in zijn Second Brain:\n\n${itemContext}\n\nBeantwoord vragen op basis van deze kennis. Verwijs naar specifieke items met hun ID in het formaat [ID:X]. Als je het antwoord niet kunt vinden in de items, zeg dat eerlijk.`,
      messages: [
        ...historyMessages,
        { role: "user", content: vraag },
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
