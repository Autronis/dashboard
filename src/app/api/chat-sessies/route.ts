import { NextRequest, NextResponse } from "next/server";
import { tursoClient, sqlite } from "@/lib/db";
import { requireAuthOrApiKey } from "@/lib/auth";

// Raw query helper that works on both Turso and local SQLite
async function query(sql: string, args: unknown[] = []): Promise<Record<string, unknown>[]> {
  if (tursoClient) {
    const result = await tursoClient.execute({ sql, args });
    return result.rows as Record<string, unknown>[];
  }
  // Local SQLite
  return sqlite.prepare(sql).all(...args) as Record<string, unknown>[];
}

async function run(sql: string, args: unknown[] = []) {
  if (tursoClient) {
    return tursoClient.execute({ sql, args });
  }
  return sqlite.prepare(sql).run(...args);
}

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

    const tags = await query(
      `SELECT context_tag as tag, count(*) as aantal,
       (SELECT cs2.onderwerp FROM chat_sessies cs2
        WHERE cs2.gebruiker = ? AND cs2.context_tag = chat_sessies.context_tag
        ORDER BY cs2.nummer DESC LIMIT 1) as laatsteOnderwerp
       FROM chat_sessies WHERE gebruiker = ?
       GROUP BY context_tag ORDER BY max(nummer) DESC`,
      [gebruiker, gebruiker]
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

    // Get next number
    const maxResult = await query(
      "SELECT max(nummer) as max_nr FROM chat_sessies WHERE gebruiker = ? AND context_tag = ?",
      [gebruiker, contextTag]
    );

    const nextNummer = (Number(maxResult[0]?.max_nr) || 0) + 1;
    const chatId = `${gebruiker.toUpperCase()}-${contextTag}-${String(nextNummer).padStart(3, "0")}`;

    await run(
      `INSERT INTO chat_sessies (gebruiker, context_tag, nummer, chat_id, onderwerp, klant_id, project_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [gebruiker, contextTag, nextNummer, chatId, onderwerp || null, klantId ?? null, projectId ?? null]
    );

    // Get the inserted row ID
    const inserted = await query("SELECT id FROM chat_sessies WHERE chat_id = ?", [chatId]);

    return NextResponse.json(
      {
        sessie: {
          id: Number(inserted[0]?.id) || 0,
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
