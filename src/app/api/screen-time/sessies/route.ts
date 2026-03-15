import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { screenTimeEntries, projecten, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, asc } from "drizzle-orm";

const SESSION_GAP_SECONDS = 120; // 2 minutes

interface RawEntry {
  app: string;
  vensterTitel: string | null;
  categorie: string;
  projectId: number | null;
  projectNaam: string | null;
  klantNaam: string | null;
  startTijd: string;
  eindTijd: string;
  duurSeconden: number;
}

interface Sessie {
  app: string;
  categorie: string;
  projectId: number | null;
  projectNaam: string | null;
  klantNaam: string | null;
  startTijd: string;
  eindTijd: string;
  duurSeconden: number;
  venstertitels: string[];
  isIdle: boolean;
}

interface SessionBuilder {
  app: string;
  projectId: number | null;
  projectNaam: string | null;
  klantNaam: string | null;
  startTijd: string;
  eindTijd: string;
  duurSeconden: number;
  venstertitels: string[];
  isIdle: boolean;
  categorieSeconden: Record<string, number>; // track seconds per category
}

function finalizeSessie(builder: SessionBuilder): Sessie {
  // Dominant category = most seconds
  const categorie = Object.entries(builder.categorieSeconden)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || "overig";

  return {
    app: builder.app,
    categorie,
    projectId: builder.projectId,
    projectNaam: builder.projectNaam,
    klantNaam: builder.klantNaam,
    startTijd: builder.startTijd,
    eindTijd: builder.eindTijd,
    duurSeconden: builder.duurSeconden,
    venstertitels: builder.venstertitels,
    isIdle: builder.isIdle,
  };
}

function newBuilder(entry: RawEntry): SessionBuilder {
  return {
    app: entry.app,
    projectId: entry.projectId,
    projectNaam: entry.projectNaam,
    klantNaam: entry.klantNaam,
    startTijd: entry.startTijd,
    eindTijd: entry.eindTijd,
    duurSeconden: entry.duurSeconden,
    venstertitels: entry.vensterTitel ? [entry.vensterTitel] : [],
    isIdle: entry.app === "Inactief",
    categorieSeconden: { [entry.categorie]: entry.duurSeconden },
  };
}

function groupIntoSessions(entries: RawEntry[]): Sessie[] {
  if (entries.length === 0) return [];

  const sessions: Sessie[] = [];
  let current = newBuilder(entries[0]);

  for (let i = 1; i < entries.length; i++) {
    const entry = entries[i];
    const prevEnd = new Date(current.eindTijd).getTime();
    const thisStart = new Date(entry.startTijd).getTime();
    const gapSeconds = (thisStart - prevEnd) / 1000;

    const sameApp = entry.app === current.app;
    const withinGap = gapSeconds <= SESSION_GAP_SECONDS;

    if (sameApp && withinGap) {
      // Extend current session
      current.eindTijd = entry.eindTijd;
      current.duurSeconden += entry.duurSeconden;
      current.categorieSeconden[entry.categorie] = (current.categorieSeconden[entry.categorie] || 0) + entry.duurSeconden;
      if (entry.vensterTitel && !current.venstertitels.includes(entry.vensterTitel)) {
        current.venstertitels.push(entry.vensterTitel);
      }
      if (!current.projectId && entry.projectId) {
        current.projectId = entry.projectId;
        current.projectNaam = entry.projectNaam;
        current.klantNaam = entry.klantNaam;
      }
    } else {
      // Finalize and start new session
      sessions.push(finalizeSessie(current));
      current = newBuilder(entry);
    }
  }
  sessions.push(finalizeSessie(current));

  return sessions;
}

export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { searchParams } = new URL(req.url);
    const datum = searchParams.get("datum");
    const gebruikerId = searchParams.get("gebruikerId");

    if (!datum) {
      return NextResponse.json({ fout: "Datum is verplicht" }, { status: 400 });
    }

    const conditions = [];
    if (gebruikerId && gebruiker.rol === "admin") {
      conditions.push(eq(screenTimeEntries.gebruikerId, parseInt(gebruikerId)));
    } else {
      conditions.push(eq(screenTimeEntries.gebruikerId, gebruiker.id));
    }
    conditions.push(gte(screenTimeEntries.startTijd, `${datum}T00:00:00`));
    conditions.push(lte(screenTimeEntries.startTijd, `${datum}T23:59:59`));

    const entries = db
      .select({
        app: screenTimeEntries.app,
        vensterTitel: screenTimeEntries.vensterTitel,
        categorie: screenTimeEntries.categorie,
        projectId: screenTimeEntries.projectId,
        projectNaam: projecten.naam,
        klantNaam: klanten.bedrijfsnaam,
        startTijd: screenTimeEntries.startTijd,
        eindTijd: screenTimeEntries.eindTijd,
        duurSeconden: screenTimeEntries.duurSeconden,
      })
      .from(screenTimeEntries)
      .leftJoin(projecten, eq(screenTimeEntries.projectId, projecten.id))
      .leftJoin(klanten, eq(screenTimeEntries.klantId, klanten.id))
      .where(and(...conditions))
      .orderBy(asc(screenTimeEntries.startTijd))
      .all();

    const sessies = groupIntoSessions(entries.map(e => ({
      ...e,
      categorie: e.categorie ?? "overig",
    })));

    // Compute stats excluding idle
    const actiefSessies = sessies.filter(s => !s.isIdle);
    const totaalActief = actiefSessies.reduce((sum, s) => sum + s.duurSeconden, 0);
    const totaalIdle = sessies.filter(s => s.isIdle).reduce((sum, s) => sum + s.duurSeconden, 0);
    const productiefSeconden = actiefSessies
      .filter(s => ["development", "design", "administratie"].includes(s.categorie))
      .reduce((sum, s) => sum + s.duurSeconden, 0);
    const productiefPercentage = totaalActief > 0 ? Math.round((productiefSeconden / totaalActief) * 100) : 0;

    return NextResponse.json({
      sessies,
      stats: {
        totaalActief,
        totaalIdle,
        productiefPercentage,
        aantalSessies: actiefSessies.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
