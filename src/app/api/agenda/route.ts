import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agendaItems, gebruikers, projecten, taken } from "@/lib/db/schema";
import { requireAuth, requireAuthOrApiKey } from "@/lib/auth";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { pushEventToGoogle } from "@/lib/google-calendar";

const VALID_EIGENAAR = ["sem", "syb", "team", "vrij"] as const;
type Eigenaar = (typeof VALID_EIGENAAR)[number];

const VALID_GEMAAKT_DOOR = ["user", "bridge", "fallback-haiku", "ai-plan-button"] as const;
type GemaaktDoor = (typeof VALID_GEMAAKT_DOOR)[number];

// GET /api/agenda?van=2026-03-01&tot=2026-03-31
export async function GET(req: NextRequest) {
  try {
    await requireAuthOrApiKey(req);
    const { searchParams } = new URL(req.url);
    const van = searchParams.get("van");
    const tot = searchParams.get("tot");

    const conditions = [];
    if (van) conditions.push(gte(agendaItems.startDatum, van));
    if (tot) conditions.push(lte(agendaItems.startDatum, tot + "T23:59:59"));

    // Rows inserted before migration have NULL for eigenaar/gemaakt_door
    // (auto-migrate adds columns nullable without defaults). Coalesce in SQL
    // so consumers always see a valid enum value.
    const items = await db
      .select({
        id: agendaItems.id,
        gebruikerId: agendaItems.gebruikerId,
        gebruikerNaam: gebruikers.naam,
        titel: agendaItems.titel,
        omschrijving: agendaItems.omschrijving,
        type: agendaItems.type,
        startDatum: agendaItems.startDatum,
        eindDatum: agendaItems.eindDatum,
        heleDag: agendaItems.heleDag,
        herinneringMinuten: agendaItems.herinneringMinuten,
        googleEventId: agendaItems.googleEventId,
        eigenaar: sql<Eigenaar>`COALESCE(${agendaItems.eigenaar}, 'vrij')`,
        gemaaktDoor: sql<GemaaktDoor>`COALESCE(${agendaItems.gemaaktDoor}, 'user')`,
        projectId: agendaItems.projectId,
        projectNaam: projecten.naam,
        pijler: agendaItems.pijler,
        taakId: agendaItems.taakId,
        taakTitel: taken.titel,
        taakFase: taken.fase,
        taakStatus: taken.status,
        taakPrioriteit: taken.prioriteit,
        taakUitvoerder: taken.uitvoerder,
        taakPrompt: taken.prompt,
        taakCluster: taken.cluster,
        stappenplan: agendaItems.stappenplan,
        aiContext: agendaItems.aiContext,
        geschatteDuurMinuten: agendaItems.geschatteDuurMinuten,
        parallelActiviteit: agendaItems.parallelActiviteit,
      })
      .from(agendaItems)
      .leftJoin(gebruikers, eq(agendaItems.gebruikerId, gebruikers.id))
      .leftJoin(projecten, eq(agendaItems.projectId, projecten.id))
      .leftJoin(taken, eq(agendaItems.taakId, taken.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(agendaItems.startDatum);

    return NextResponse.json({ items }, {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/agenda
export async function POST(req: NextRequest) {
  try {
    // requireAuthOrApiKey: zowel sessie-cookie (UI) als Bearer token (bridge).
    // Zonder apikey-fallback kan de plan-avond bridge geen blokken posten.
    const gebruiker = await requireAuthOrApiKey(req);
    const body = await req.json();

    if (!body.titel?.trim()) {
      return NextResponse.json({ fout: "Titel is verplicht." }, { status: 400 });
    }
    if (!body.startDatum) {
      return NextResponse.json({ fout: "Startdatum is verplicht." }, { status: 400 });
    }

    const eigenaar: Eigenaar = body.eigenaar ?? "vrij";
    if (!VALID_EIGENAAR.includes(eigenaar)) {
      return NextResponse.json(
        {
          fout: `Ongeldige eigenaar '${eigenaar}'. Verwacht één van: ${VALID_EIGENAAR.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    const gemaaktDoor: GemaaktDoor = body.gemaaktDoor ?? "user";
    if (!VALID_GEMAAKT_DOOR.includes(gemaaktDoor)) {
      return NextResponse.json(
        {
          fout: `Ongeldige gemaaktDoor '${gemaaktDoor}'. Verwacht één van: ${VALID_GEMAAKT_DOOR.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    const projectId = typeof body.projectId === "number" ? body.projectId : null;
    const taakId = typeof body.taakId === "number" ? body.taakId : null;
    const pijler = typeof body.pijler === "string" ? body.pijler : null;
    // stappenplan accepteren als array óf als al-gestringifeerde JSON; normaliseer
    // naar string voor opslag (sqlite TEXT). Invalid shapes worden genegeerd.
    let stappenplan: string | null = null;
    if (Array.isArray(body.stappenplan)) {
      stappenplan = JSON.stringify(body.stappenplan);
    } else if (typeof body.stappenplan === "string" && body.stappenplan.trim()) {
      stappenplan = body.stappenplan;
    }
    const aiContext = typeof body.aiContext === "string" && body.aiContext.trim() ? body.aiContext : null;
    const geschatteDuurMinuten = typeof body.geschatteDuurMinuten === "number" && body.geschatteDuurMinuten > 0
      ? body.geschatteDuurMinuten
      : null;
    const parallelActiviteit = typeof body.parallelActiviteit === "string" && body.parallelActiviteit.trim()
      ? body.parallelActiviteit.trim()
      : null;

    const [nieuw] = await db
      .insert(agendaItems)
      .values({
        gebruikerId: gebruiker.id,
        titel: body.titel.trim(),
        omschrijving: body.omschrijving?.trim() || null,
        type: body.type || "afspraak",
        startDatum: body.startDatum,
        eindDatum: body.eindDatum || null,
        heleDag: body.heleDag ? 1 : 0,
        herinneringMinuten: body.herinneringMinuten ?? null,
        eigenaar,
        gemaaktDoor,
        projectId,
        taakId,
        pijler,
        stappenplan,
        aiContext,
        geschatteDuurMinuten,
        parallelActiviteit,
      })
      .returning();

    // Push to Google Calendar (fire-and-forget)
    pushEventToGoogle(gebruiker.id, {
      summary: body.titel.trim(),
      description: body.omschrijving?.trim(),
      start: body.startDatum,
      end: body.eindDatum || undefined,
      allDay: !!body.heleDag,
    })
      .then(async (event) => {
        if (event?.id) {
          await db.update(agendaItems)
            .set({ googleEventId: event.id })
            .where(eq(agendaItems.id, nieuw.id))
            .execute();
        }
      })
      .catch(() => {
        // Google sync failed silently — item is still saved locally
      });

    return NextResponse.json({ item: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
