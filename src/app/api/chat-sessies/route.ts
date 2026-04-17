import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatSessies } from "@/lib/db/schema";
import { requireAuthOrApiKey } from "@/lib/auth";
import { eq, and, sql, desc } from "drizzle-orm";

// GET /api/chat-sessies?gebruiker=sem — Return existing context tags for a user
export async function GET(req: NextRequest) {
  try {
    await requireAuthOrApiKey(req);
    const { searchParams } = new URL(req.url);
    const gebruiker = searchParams.get("gebruiker");

    if (!gebruiker || !["sem", "syb"].includes(gebruiker)) {
      return NextResponse.json(
        { fout: "Parameter 'gebruiker' is verplicht en moet 'sem' of 'syb' zijn." },
        { status: 400 }
      );
    }

    // Aggregate: per context_tag, count sessions and get the latest onderwerp
    const tags = await db
      .select({
        tag: chatSessies.contextTag,
        aantal: sql<number>`count(*)`,
        laatsteOnderwerp: sql<string>`(
          SELECT cs2.onderwerp FROM chat_sessies cs2
          WHERE cs2.gebruiker = ${gebruiker}
            AND cs2.context_tag = ${chatSessies.contextTag}
          ORDER BY cs2.nummer DESC
          LIMIT 1
        )`,
      })
      .from(chatSessies)
      .where(eq(chatSessies.gebruiker, gebruiker))
      .groupBy(chatSessies.contextTag)
      .orderBy(desc(sql`max(${chatSessies.nummer})`));

    return NextResponse.json({ tags });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message.includes("geauthenticeerd") ? 401 : 500 }
    );
  }
}

// POST /api/chat-sessies — Create a new chat session, returns next ID number
export async function POST(req: NextRequest) {
  try {
    await requireAuthOrApiKey(req);
    const body = await req.json();
    const { gebruiker, contextTag, onderwerp, klantId, projectId } = body;

    // Validate gebruiker
    if (!gebruiker || !["sem", "syb"].includes(gebruiker)) {
      return NextResponse.json(
        { fout: "Veld 'gebruiker' is verplicht en moet 'sem' of 'syb' zijn." },
        { status: 400 }
      );
    }

    // Validate contextTag
    if (!contextTag || !/^[A-Z0-9]{1,5}$/.test(contextTag)) {
      return NextResponse.json(
        { fout: "Veld 'contextTag' is verplicht en moet 1-5 hoofdletters/cijfers zijn (A-Z0-9)." },
        { status: 400 }
      );
    }

    // Get the current max nummer for this (gebruiker, context_tag) pair
    const maxResult = await db
      .select({
        maxNummer: sql<number | null>`max(${chatSessies.nummer})`,
      })
      .from(chatSessies)
      .where(
        and(
          eq(chatSessies.gebruiker, gebruiker),
          eq(chatSessies.contextTag, contextTag)
        )
      );

    const nextNummer = (maxResult[0]?.maxNummer ?? 0) + 1;
    const chatId = `${gebruiker.toUpperCase()}-${contextTag}-${String(nextNummer).padStart(3, "0")}`;

    const [nieuw] = await db
      .insert(chatSessies)
      .values({
        gebruiker,
        contextTag,
        nummer: nextNummer,
        chatId,
        onderwerp: onderwerp || null,
        klantId: klantId ?? null,
        projectId: projectId ?? null,
      })
      .returning();

    return NextResponse.json(
      {
        sessie: {
          id: nieuw.id,
          chatId: nieuw.chatId,
          nummer: nieuw.nummer,
          contextTag: nieuw.contextTag,
          onderwerp: nieuw.onderwerp,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message.includes("geauthenticeerd") ? 401 : 500 }
    );
  }
}
