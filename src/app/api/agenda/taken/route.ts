import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, projecten, klanten } from "@/lib/db/schema";
import { eq, and, or, ne } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

export interface AgendaTaak {
  id: number;
  titel: string;
  status: string;
  prioriteit: string;
  deadline: string | null;
  projectNaam: string | null;
  klantNaam: string | null;
  toegewezenAanId: number | null;
}

// GET /api/agenda/taken - Haal open/bezig taken op voor kalender
export async function GET(_req: NextRequest) {
  try {
    await requireAuth();

    const rows = await db
      .select({
        id: taken.id,
        titel: taken.titel,
        status: taken.status,
        prioriteit: taken.prioriteit,
        deadline: taken.deadline,
        toegewezenAanId: taken.toegewezenAan,
        projectNaam: projecten.naam,
        klantNaam: klanten.bedrijfsnaam,
      })
      .from(taken)
      .leftJoin(projecten, eq(taken.projectId, projecten.id))
      .leftJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(
        or(
          eq(taken.status, "open"),
          eq(taken.status, "bezig")
        )
      )
      .orderBy(taken.prioriteit, taken.deadline);

    return NextResponse.json({ taken: rows });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
