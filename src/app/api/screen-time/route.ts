import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { screenTimeEntries, projecten, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { searchParams } = new URL(req.url);

    const van = searchParams.get("van");
    const tot = searchParams.get("tot");
    const categorie = searchParams.get("categorie");
    const gebruikerId = searchParams.get("gebruikerId");

    const vandaag = new Date().toISOString().split("T")[0];
    const startDatum = van || vandaag;
    const eindDatum = tot || vandaag;

    const conditions = [];

    if (gebruikerId && gebruiker.rol === "admin") {
      conditions.push(eq(screenTimeEntries.gebruikerId, parseInt(gebruikerId)));
    } else {
      conditions.push(eq(screenTimeEntries.gebruikerId, gebruiker.id));
    }

    conditions.push(gte(screenTimeEntries.startTijd, `${startDatum}T00:00:00`));
    conditions.push(lte(screenTimeEntries.startTijd, `${eindDatum}T23:59:59`));

    if (categorie) {
      const geldige = ["development", "communicatie", "design", "administratie", "afleiding", "overig"] as const;
      type Categorie = (typeof geldige)[number];
      if (geldige.includes(categorie as Categorie)) {
        conditions.push(eq(screenTimeEntries.categorie, categorie as Categorie));
      }
    }

    const entries = db
      .select({
        id: screenTimeEntries.id,
        app: screenTimeEntries.app,
        vensterTitel: screenTimeEntries.vensterTitel,
        url: screenTimeEntries.url,
        categorie: screenTimeEntries.categorie,
        startTijd: screenTimeEntries.startTijd,
        eindTijd: screenTimeEntries.eindTijd,
        duurSeconden: screenTimeEntries.duurSeconden,
        bron: screenTimeEntries.bron,
        projectNaam: projecten.naam,
        klantNaam: klanten.bedrijfsnaam,
      })
      .from(screenTimeEntries)
      .leftJoin(projecten, eq(screenTimeEntries.projectId, projecten.id))
      .leftJoin(klanten, eq(screenTimeEntries.klantId, klanten.id))
      .where(and(...conditions))
      .orderBy(desc(screenTimeEntries.startTijd))
      .all();

    const categorieOverzicht: Record<string, number> = {};
    const appOverzicht: Record<string, number> = {};
    let totaalSeconden = 0;

    for (const entry of entries) {
      const cat = entry.categorie ?? "overig";
      categorieOverzicht[cat] = (categorieOverzicht[cat] || 0) + entry.duurSeconden;
      if (cat !== "inactief") {
        appOverzicht[entry.app] = (appOverzicht[entry.app] || 0) + entry.duurSeconden;
        totaalSeconden += entry.duurSeconden;
      }
    }

    const topApps = Object.entries(appOverzicht)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([app, seconden]) => ({ app, seconden }));

    return NextResponse.json({
      entries,
      categorieOverzicht,
      topApps,
      totaalSeconden,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
