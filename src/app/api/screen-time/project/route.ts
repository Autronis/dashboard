import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { screenTimeEntries, projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, ne, sql } from "drizzle-orm";

// PUT /api/screen-time/project — bulk update project for entries in time range
export async function PUT(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();
    const { startTijd, eindTijd, projectId, categorie, excludeCategorie } = body;

    if (!startTijd || !eindTijd) {
      return NextResponse.json({ fout: "startTijd en eindTijd zijn verplicht" }, { status: 400 });
    }

    // If projectId provided, get klantId from project
    let klantId: number | null = null;
    if (projectId) {
      const project = await db
        .select({ klantId: projecten.klantId })
        .from(projecten)
        .where(eq(projecten.id, projectId))
        .get();
      klantId = project?.klantId ?? null;
    }

    const conditions = [
      eq(screenTimeEntries.gebruikerId, gebruiker.id),
      gte(screenTimeEntries.startTijd, startTijd),
      lte(screenTimeEntries.startTijd, eindTijd),
    ];
    if (categorie) conditions.push(eq(screenTimeEntries.categorie, categorie));
    if (excludeCategorie) conditions.push(ne(screenTimeEntries.categorie, excludeCategorie));

    const result = await db
      .update(screenTimeEntries)
      .set({
        projectId: projectId ?? null,
        klantId,
      })
      .where(and(...conditions))
      .run();

    return NextResponse.json({ succes: true, bijgewerkt: result.changes });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
