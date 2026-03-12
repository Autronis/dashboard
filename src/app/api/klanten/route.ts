import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { klanten, projecten, tijdregistraties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, sql, and } from "drizzle-orm";

// GET /api/klanten — All active clients with KPIs
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const toonInactief = searchParams.get("inactief") === "1";

    const conditions = toonInactief ? [] : [eq(klanten.isActief, 1)];

    const lijst = await db
      .select({
        id: klanten.id,
        bedrijfsnaam: klanten.bedrijfsnaam,
        contactpersoon: klanten.contactpersoon,
        email: klanten.email,
        telefoon: klanten.telefoon,
        adres: klanten.adres,
        uurtarief: klanten.uurtarief,
        notities: klanten.notities,
        isActief: klanten.isActief,
        aangemaaktOp: klanten.aangemaaktOp,
      })
      .from(klanten)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(klanten.bedrijfsnaam);

    // Fetch KPIs per client
    const klantenMetKPIs = await Promise.all(
      lijst.map(async (klant) => {
        const [projectCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(projecten)
          .where(and(eq(projecten.klantId, klant.id), eq(projecten.isActief, 1)));

        const [urenTotaal] = await db
          .select({ totaal: sql<number>`coalesce(sum(${tijdregistraties.duurMinuten}), 0)` })
          .from(tijdregistraties)
          .innerJoin(projecten, eq(tijdregistraties.projectId, projecten.id))
          .where(eq(projecten.klantId, klant.id));

        return {
          ...klant,
          aantalProjecten: projectCount?.count || 0,
          totaalMinuten: urenTotaal?.totaal || 0,
        };
      })
    );

    return NextResponse.json({ klanten: klantenMetKPIs });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/klanten — Create new client
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();

    const { bedrijfsnaam, contactpersoon, email, telefoon, adres, uurtarief, notities: notitiesTekst } = body;

    if (!bedrijfsnaam?.trim()) {
      return NextResponse.json({ fout: "Bedrijfsnaam is verplicht." }, { status: 400 });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ fout: "Ongeldig e-mailadres." }, { status: 400 });
    }

    if (uurtarief !== undefined && uurtarief !== null && uurtarief <= 0) {
      return NextResponse.json({ fout: "Uurtarief moet positief zijn." }, { status: 400 });
    }

    const [nieuw] = await db
      .insert(klanten)
      .values({
        bedrijfsnaam: bedrijfsnaam.trim(),
        contactpersoon: contactpersoon?.trim() || null,
        email: email?.trim().toLowerCase() || null,
        telefoon: telefoon?.trim() || null,
        adres: adres?.trim() || null,
        uurtarief: uurtarief || null,
        notities: notitiesTekst?.trim() || null,
        aangemaaktDoor: gebruiker.id,
      })
      .returning();

    return NextResponse.json({ klant: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
