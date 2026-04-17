import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthOrApiKey } from "@/lib/auth";
import { sql } from "drizzle-orm";

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

    const tags = await db.all<{ tag: string; aantal: number; laatsteOnderwerp: string | null }>(
      sql`SELECT context_tag as tag, count(*) as aantal,
          (SELECT cs2.onderwerp FROM chat_sessies cs2 WHERE cs2.gebruiker = ${gebruiker} AND cs2.context_tag = chat_sessies.context_tag ORDER BY cs2.nummer DESC LIMIT 1) as laatsteOnderwerp
          FROM chat_sessies WHERE gebruiker = ${gebruiker}
          GROUP BY context_tag ORDER BY max(nummer) DESC`
    );

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

    if (!gebruiker || !["sem", "syb"].includes(gebruiker)) {
      return NextResponse.json(
        { fout: "Veld 'gebruiker' is verplicht en moet 'sem' of 'syb' zijn." },
        { status: 400 }
      );
    }

    if (!contextTag || !/^[A-Z0-9]{1,5}$/.test(contextTag)) {
      return NextResponse.json(
        { fout: "Veld 'contextTag' is verplicht en moet 1-5 hoofdletters/cijfers zijn (A-Z0-9)." },
        { status: 400 }
      );
    }

    // Get next number via raw SQL to avoid drizzle schema issues with new tables
    const maxResult = await db.all<{ max_nr: number | null }>(
      sql`SELECT max(nummer) as max_nr FROM chat_sessies WHERE gebruiker = ${gebruiker} AND context_tag = ${contextTag}`
    );

    const nextNummer = (maxResult[0]?.max_nr ?? 0) + 1;
    const chatId = `${gebruiker.toUpperCase()}-${contextTag}-${String(nextNummer).padStart(3, "0")}`;

    await db.run(
      sql`INSERT INTO chat_sessies (gebruiker, context_tag, nummer, chat_id, onderwerp, klant_id, project_id)
          VALUES (${gebruiker}, ${contextTag}, ${nextNummer}, ${chatId}, ${onderwerp || null}, ${klantId ?? null}, ${projectId ?? null})`
    );

    // Get the inserted row
    const inserted = await db.all<{ id: number }>(
      sql`SELECT id FROM chat_sessies WHERE chat_id = ${chatId}`
    );

    return NextResponse.json(
      {
        sessie: {
          id: inserted[0]?.id ?? 0,
          chatId,
          nummer: nextNummer,
          contextTag,
          onderwerp: onderwerp || null,
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
