import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agendaItems } from "@/lib/db/schema";
import { requireAuthOrApiKey } from "@/lib/auth";
import { and, eq, gte, lt } from "drizzle-orm";

const VALID_EIGENAAR = ["sem", "syb", "team", "vrij"] as const;

// POST /api/agenda/bridge-reset
// Body: { datum: "YYYY-MM-DD", eigenaar: "sem|syb|team|vrij" }
//
// Deletes all agenda items created by the bridge (`gemaaktDoor='bridge'`)
// for the given (datum, eigenaar) combination. Used by the bridge's
// commit-planning script for re-run idempotency — the bridge can call this
// before posting a new plan so duplicate blocks never pile up.
export async function POST(req: NextRequest) {
  try {
    await requireAuthOrApiKey(req);
    const body = await req.json();
    const datum = typeof body.datum === "string" ? body.datum : null;
    const eigenaar = typeof body.eigenaar === "string" ? body.eigenaar : null;

    if (!datum || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
      return NextResponse.json(
        { fout: "datum is verplicht in formaat YYYY-MM-DD." },
        { status: 400 }
      );
    }
    if (!eigenaar || !VALID_EIGENAAR.includes(eigenaar as (typeof VALID_EIGENAAR)[number])) {
      return NextResponse.json(
        { fout: `eigenaar is verplicht en moet één van: ${VALID_EIGENAAR.join(", ")}.` },
        { status: 400 }
      );
    }

    const dagStart = `${datum}T00:00:00`;
    const dagEind = `${datum}T23:59:59`;

    const result = await db
      .delete(agendaItems)
      .where(
        and(
          eq(agendaItems.gemaaktDoor, "bridge"),
          eq(agendaItems.eigenaar, eigenaar as (typeof VALID_EIGENAAR)[number]),
          gte(agendaItems.startDatum, dagStart),
          lt(agendaItems.startDatum, dagEind)
        )
      )
      .returning({ id: agendaItems.id });

    return NextResponse.json({ verwijderd: result.length });
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
