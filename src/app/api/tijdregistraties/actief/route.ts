import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tijdregistraties, projecten, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, isNull } from "drizzle-orm";

// GET /api/tijdregistraties/actief
export async function GET() {
  try {
    const gebruiker = await requireAuth();

    const [actief] = await db
      .select({
        id: tijdregistraties.id,
        projectId: tijdregistraties.projectId,
        omschrijving: tijdregistraties.omschrijving,
        startTijd: tijdregistraties.startTijd,
        categorie: tijdregistraties.categorie,
        locatie: tijdregistraties.locatie,
        projectNaam: projecten.naam,
        klantNaam: klanten.bedrijfsnaam,
      })
      .from(tijdregistraties)
      .leftJoin(projecten, eq(tijdregistraties.projectId, projecten.id))
      .leftJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(
        and(
          eq(tijdregistraties.gebruikerId, gebruiker.id),
          isNull(tijdregistraties.eindTijd)
        )
      )
      .limit(1);

    return NextResponse.json({ actief: actief || null });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
