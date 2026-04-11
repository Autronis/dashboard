import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tijdregistraties, projecten, klanten } from "@/lib/db/schema";
import { requireAuth, requireAuthOrApiKey } from "@/lib/auth";
import { eq, and, gte, lte, desc, isNull, isNotNull } from "drizzle-orm";

// GET /api/tijdregistraties?van=2026-03-10&tot=2026-03-16
export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { searchParams } = new URL(req.url);
    const van = searchParams.get("van");
    const tot = searchParams.get("tot");

    const team = searchParams.get("team") === "true";
    const conditions = team ? [] : [eq(tijdregistraties.gebruikerId, gebruiker.id)];

    if (van) {
      conditions.push(gte(tijdregistraties.startTijd, van));
    }
    if (tot) {
      // Add a day to include the full "tot" day
      const totDate = new Date(tot);
      totDate.setDate(totDate.getDate() + 1);
      conditions.push(lte(tijdregistraties.startTijd, totDate.toISOString()));
    }

    const registraties = await db
      .select({
        id: tijdregistraties.id,
        gebruikerId: tijdregistraties.gebruikerId,
        projectId: tijdregistraties.projectId,
        omschrijving: tijdregistraties.omschrijving,
        startTijd: tijdregistraties.startTijd,
        eindTijd: tijdregistraties.eindTijd,
        duurMinuten: tijdregistraties.duurMinuten,
        categorie: tijdregistraties.categorie,
        isHandmatig: tijdregistraties.isHandmatig,
        aangemaaktOp: tijdregistraties.aangemaaktOp,
        locatie: tijdregistraties.locatie,
        projectNaam: projecten.naam,
        klantNaam: klanten.bedrijfsnaam,
        klantId: klanten.id,
      })
      .from(tijdregistraties)
      .leftJoin(projecten, eq(tijdregistraties.projectId, projecten.id))
      .leftJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(and(...conditions))
      .orderBy(desc(tijdregistraties.startTijd));

    return NextResponse.json({ registraties });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/tijdregistraties
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuthOrApiKey(req);
    const body = await req.json();

    const { projectId, omschrijving, categorie, startTijd, eindTijd, duurMinuten, isHandmatig, locatie } = body;

    if (!projectId) {
      return NextResponse.json({ fout: "Project is verplicht." }, { status: 400 });
    }

    // If starting a timer, stop any active timers first
    if (!isHandmatig && !eindTijd) {
      const actieveTimers = await db
        .select({ id: tijdregistraties.id, startTijd: tijdregistraties.startTijd })
        .from(tijdregistraties)
        .where(
          and(
            eq(tijdregistraties.gebruikerId, gebruiker.id),
            isNull(tijdregistraties.eindTijd)
          )
        );

      for (const timer of actieveTimers) {
        const start = new Date(timer.startTijd).getTime();
        const nu = Date.now();
        const duur = Math.round((nu - start) / 60000);
        await db
          .update(tijdregistraties)
          .set({ eindTijd: new Date().toISOString(), duurMinuten: duur })
          .where(eq(tijdregistraties.id, timer.id));
      }
    }

    const [nieuw] = await db
      .insert(tijdregistraties)
      .values({
        gebruikerId: gebruiker.id,
        projectId,
        omschrijving: omschrijving || null,
        startTijd: startTijd || new Date().toISOString(),
        eindTijd: eindTijd || null,
        duurMinuten: duurMinuten || null,
        categorie: categorie || "development",
        isHandmatig: isHandmatig ? 1 : 0,
        locatie: locatie === "kantoor" || locatie === "thuis" ? locatie : null,
      })
      .returning();

    return NextResponse.json({ registratie: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
