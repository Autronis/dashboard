import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, projecten, facturen, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, isNotNull, ne } from "drizzle-orm";

interface DeadlineEvent {
  id: string;
  titel: string;
  type: "taak" | "project" | "factuur";
  datum: string;
  klantNaam: string | null;
  projectNaam: string | null;
  linkHref: string;
  bedrag: number | null;
  googleEventId: string | null;
}

// GET /api/agenda/deadlines?van=2026-03-01&tot=2026-03-31
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const van = searchParams.get("van");
    const tot = searchParams.get("tot");

    if (!van || !tot) {
      return NextResponse.json(
        { fout: "Query parameters 'van' en 'tot' zijn verplicht." },
        { status: 400 }
      );
    }

    const events: DeadlineEvent[] = [];

    // 1. Taken met deadline
    const takenConditions = [isNotNull(taken.deadline), gte(taken.deadline, van), lte(taken.deadline, tot)];
    const takenRows = await db
      .select({
        id: taken.id,
        titel: taken.titel,
        deadline: taken.deadline,
        projectId: taken.projectId,
        projectNaam: projecten.naam,
        klantNaam: klanten.bedrijfsnaam,
        googleEventId: taken.googleEventId,
      })
      .from(taken)
      .leftJoin(projecten, eq(taken.projectId, projecten.id))
      .leftJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(and(...takenConditions));

    for (const row of takenRows) {
      events.push({
        id: `taak-${row.id}`,
        titel: `Taak: ${row.titel}`,
        type: "taak",
        datum: row.deadline!,
        klantNaam: row.klantNaam ?? null,
        projectNaam: row.projectNaam ?? null,
        linkHref: "/taken",
        bedrag: null,
        googleEventId: row.googleEventId ?? null,
      });
    }

    // 2. Projecten met deadline (actief)
    const projectConditions = [
      isNotNull(projecten.deadline),
      gte(projecten.deadline, van),
      lte(projecten.deadline, tot),
      eq(projecten.isActief, 1),
    ];
    const projectRows = await db
      .select({
        id: projecten.id,
        naam: projecten.naam,
        deadline: projecten.deadline,
        klantId: projecten.klantId,
        klantNaam: klanten.bedrijfsnaam,
      })
      .from(projecten)
      .leftJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(and(...projectConditions));

    for (const row of projectRows) {
      events.push({
        id: `project-${row.id}`,
        titel: `Project: ${row.naam}`,
        type: "project",
        datum: row.deadline!,
        klantNaam: row.klantNaam ?? null,
        projectNaam: row.naam,
        linkHref: row.klantId ? `/klanten/${row.klantId}/projecten/${row.id}` : "/taken",
        bedrag: null,
        googleEventId: null,
      });
    }

    // 3. Facturen met vervaldatum (status = verzonden)
    const factuurConditions = [
      isNotNull(facturen.vervaldatum),
      gte(facturen.vervaldatum, van),
      lte(facturen.vervaldatum, tot),
      eq(facturen.status, "verzonden"),
    ];
    const factuurRows = await db
      .select({
        id: facturen.id,
        factuurnummer: facturen.factuurnummer,
        vervaldatum: facturen.vervaldatum,
        bedragInclBtw: facturen.bedragInclBtw,
        klantNaam: klanten.bedrijfsnaam,
      })
      .from(facturen)
      .leftJoin(klanten, eq(facturen.klantId, klanten.id))
      .where(and(...factuurConditions));

    for (const row of factuurRows) {
      events.push({
        id: `factuur-${row.id}`,
        titel: `Factuur: ${row.factuurnummer}${row.klantNaam ? ` - ${row.klantNaam}` : ""}`,
        type: "factuur",
        datum: row.vervaldatum!,
        klantNaam: row.klantNaam ?? null,
        projectNaam: null,
        linkHref: `/financien/${row.id}`,
        bedrag: row.bedragInclBtw ?? null,
        googleEventId: null,
      });
    }

    // Sorteer op datum
    events.sort((a, b) => a.datum.localeCompare(b.datum));

    return NextResponse.json({ deadlines: events });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
