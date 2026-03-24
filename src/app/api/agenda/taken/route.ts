import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, projecten, klanten } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

// GET /api/agenda/taken - Haal open/bezig taken op voor kalender
export async function GET() {
  try {
    await requireAuth();

    const rows = await db
      .select({
        id: taken.id,
        titel: taken.titel,
        status: taken.status,
        prioriteit: taken.prioriteit,
        deadline: taken.deadline,
        geschatteDuur: taken.geschatteDuur,
        ingeplandStart: taken.ingeplandStart,
        ingeplandEind: taken.ingeplandEind,
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
      { status: error instanceof Error && error.message === "Onbekende fout" ? 500 : 401 }
    );
  }
}
