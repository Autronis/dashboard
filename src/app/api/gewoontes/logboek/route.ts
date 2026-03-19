import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { gewoonteLogboek, gewoontes } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";

// GET: fetch logs for a date range
export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { searchParams } = new URL(req.url);
    const van = searchParams.get("van");
    const tot = searchParams.get("tot");

    if (!van || !tot) {
      return NextResponse.json(
        { fout: "van en tot parameters zijn verplicht" },
        { status: 400 }
      );
    }

    const logs = await db
      .select({
        id: gewoonteLogboek.id,
        gewoonteId: gewoonteLogboek.gewoonteId,
        datum: gewoonteLogboek.datum,
        voltooid: gewoonteLogboek.voltooid,
        notitie: gewoonteLogboek.notitie,
      })
      .from(gewoonteLogboek)
      .where(
        and(
          eq(gewoonteLogboek.gebruikerId, gebruiker.id),
          gte(gewoonteLogboek.datum, van),
          lte(gewoonteLogboek.datum, tot)
        )
      )
      .all();

    return NextResponse.json({ logboek: logs });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Onbekende fout";
    if (msg === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: msg }, { status: 401 });
    }
    return NextResponse.json({ fout: msg }, { status: 500 });
  }
}

// POST: toggle a habit for a specific date
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();

    const { gewoonteId, datum, notitie } = body;
    if (!gewoonteId || !datum) {
      return NextResponse.json(
        { fout: "gewoonteId en datum zijn verplicht" },
        { status: 400 }
      );
    }

    // Verify habit belongs to user
    const gewoonte = await db
      .select()
      .from(gewoontes)
      .where(
        and(
          eq(gewoontes.id, Number(gewoonteId)),
          eq(gewoontes.gebruikerId, gebruiker.id)
        )
      )
      .get();

    if (!gewoonte) {
      return NextResponse.json({ fout: "Gewoonte niet gevonden" }, { status: 404 });
    }

    // Check if log already exists
    const existing = await db
      .select()
      .from(gewoonteLogboek)
      .where(
        and(
          eq(gewoonteLogboek.gewoonteId, Number(gewoonteId)),
          eq(gewoonteLogboek.datum, datum)
        )
      )
      .get();

    if (existing) {
      // Toggle: if exists and completed, remove it
      await db.delete(gewoonteLogboek).where(eq(gewoonteLogboek.id, existing.id)).run();
      return NextResponse.json({ voltooid: false });
    } else {
      // Create new log
      await db.insert(gewoonteLogboek)
        .values({
          gewoonteId: Number(gewoonteId),
          gebruikerId: gebruiker.id,
          datum,
          voltooid: 1,
          notitie: notitie || null,
        })
        .run();
      return NextResponse.json({ voltooid: true });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Onbekende fout";
    if (msg === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: msg }, { status: 401 });
    }
    return NextResponse.json({ fout: msg }, { status: 500 });
  }
}
