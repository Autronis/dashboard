import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { inArray } from "drizzle-orm";

const VALID_EIGENAAR = new Set(["sem", "syb", "team", "vrij"]);

/**
 * POST /api/taken/bulk
 * Body: { ids: number[], updates: { fase?, eigenaar?, status?, prioriteit? } }
 *
 * Update meerdere taken tegelijk. Gebruikt voor:
 * - Rename fase / categorie (alle taken in een groep)
 * - Bulk eigenaar wijzigen (selectie)
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json() as {
      ids?: number[];
      updates?: { fase?: string | null; eigenaar?: string; status?: string; prioriteit?: string };
    };

    const ids = Array.isArray(body.ids) ? body.ids.filter((n): n is number => typeof n === "number") : [];
    if (ids.length === 0) {
      return NextResponse.json({ fout: "Geen taken meegegeven" }, { status: 400 });
    }
    if (!body.updates || typeof body.updates !== "object") {
      return NextResponse.json({ fout: "Geen updates meegegeven" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { bijgewerktOp: new Date().toISOString() };

    if (body.updates.fase !== undefined) {
      updateData.fase = body.updates.fase || null;
    }
    if (body.updates.eigenaar && VALID_EIGENAAR.has(body.updates.eigenaar)) {
      updateData.eigenaar = body.updates.eigenaar;
    }
    if (body.updates.status && ["open", "bezig", "afgerond"].includes(body.updates.status)) {
      updateData.status = body.updates.status;
    }
    if (body.updates.prioriteit && ["laag", "normaal", "hoog"].includes(body.updates.prioriteit)) {
      updateData.prioriteit = body.updates.prioriteit;
    }

    if (Object.keys(updateData).length === 1) {
      // alleen bijgewerktOp = niks zinvols
      return NextResponse.json({ fout: "Geen geldige velden om bij te werken" }, { status: 400 });
    }

    await db.update(taken).set(updateData).where(inArray(taken.id, ids));

    return NextResponse.json({ ok: true, count: ids.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: msg },
      { status: msg === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
