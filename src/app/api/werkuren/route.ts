import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { werkurenSlots } from "@/lib/db/schema";
import { requireAuthOrApiKey } from "@/lib/auth";
import { and, eq } from "drizzle-orm";

// GET /api/werkuren?user=sem
// Returnt alle actieve werkuren-slots, optioneel gefilterd per gebruiker.
// Bridge fetch-context gebruikt dit om de werkdag dynamisch uit te lezen.
export async function GET(req: NextRequest) {
  try {
    await requireAuthOrApiKey(req);
    const { searchParams } = new URL(req.url);
    const user = searchParams.get("user");

    const conditions = [eq(werkurenSlots.actief, 1)];
    if (user === "sem" || user === "syb") {
      conditions.push(eq(werkurenSlots.gebruiker, user));
    }

    const slots = await db
      .select()
      .from(werkurenSlots)
      .where(and(...conditions))
      .orderBy(werkurenSlots.gebruiker, werkurenSlots.dag, werkurenSlots.startTijd);

    return NextResponse.json({ slots });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/werkuren — voeg een nieuw slot toe
// Body: { gebruiker: "sem"|"syb", dag: 0-6, startTijd: "HH:MM", eindTijd: "HH:MM", notitie?: string }
export async function POST(req: NextRequest) {
  try {
    await requireAuthOrApiKey(req);
    const body = await req.json();

    if (body.gebruiker !== "sem" && body.gebruiker !== "syb") {
      return NextResponse.json({ fout: "gebruiker moet 'sem' of 'syb' zijn" }, { status: 400 });
    }
    if (typeof body.dag !== "number" || body.dag < 0 || body.dag > 6) {
      return NextResponse.json({ fout: "dag moet 0 (maandag) tot 6 (zondag) zijn" }, { status: 400 });
    }
    if (!/^\d{2}:\d{2}$/.test(body.startTijd) || !/^\d{2}:\d{2}$/.test(body.eindTijd)) {
      return NextResponse.json({ fout: "startTijd en eindTijd moeten HH:MM formaat hebben" }, { status: 400 });
    }

    const [row] = await db
      .insert(werkurenSlots)
      .values({
        gebruiker: body.gebruiker,
        dag: body.dag,
        startTijd: body.startTijd,
        eindTijd: body.eindTijd,
        notitie: body.notitie ?? null,
      })
      .returning();

    return NextResponse.json({ slot: row }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/werkuren?id=123 — schakel een slot uit (soft-delete via actief=0)
export async function DELETE(req: NextRequest) {
  try {
    await requireAuthOrApiKey(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ fout: "id parameter vereist" }, { status: 400 });

    await db
      .update(werkurenSlots)
      .set({ actief: 0 })
      .where(eq(werkurenSlots.id, Number(id)));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
