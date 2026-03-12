import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { klanten, projecten, tijdregistraties, notities, documenten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, sql, desc } from "drizzle-orm";

// GET /api/klanten/[id] — Client detail with projects, notes, documents, recent time entries
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const [klant] = await db
      .select()
      .from(klanten)
      .where(eq(klanten.id, Number(id)));

    if (!klant) {
      return NextResponse.json({ fout: "Klant niet gevonden." }, { status: 404 });
    }

    // Projects
    const projectenLijst = await db
      .select({
        id: projecten.id,
        naam: projecten.naam,
        omschrijving: projecten.omschrijving,
        status: projecten.status,
        voortgangPercentage: projecten.voortgangPercentage,
        deadline: projecten.deadline,
        geschatteUren: projecten.geschatteUren,
        werkelijkeUren: projecten.werkelijkeUren,
        isActief: projecten.isActief,
      })
      .from(projecten)
      .where(and(eq(projecten.klantId, Number(id)), eq(projecten.isActief, 1)))
      .orderBy(projecten.naam);

    // Calculate actual hours per project
    const projectenMetUren = await Promise.all(
      projectenLijst.map(async (p) => {
        const [uren] = await db
          .select({ totaal: sql<number>`coalesce(sum(${tijdregistraties.duurMinuten}), 0)` })
          .from(tijdregistraties)
          .where(eq(tijdregistraties.projectId, p.id));
        return { ...p, werkelijkeMinuten: uren?.totaal || 0 };
      })
    );

    // Notes
    const notitiesLijst = await db
      .select()
      .from(notities)
      .where(eq(notities.klantId, Number(id)))
      .orderBy(desc(notities.aangemaaktOp));

    // Documents
    const documentenLijst = await db
      .select()
      .from(documenten)
      .where(eq(documenten.klantId, Number(id)))
      .orderBy(desc(documenten.aangemaaktOp));

    // Recent time entries (last 5)
    const recenteTijd = await db
      .select({
        id: tijdregistraties.id,
        omschrijving: tijdregistraties.omschrijving,
        startTijd: tijdregistraties.startTijd,
        duurMinuten: tijdregistraties.duurMinuten,
        categorie: tijdregistraties.categorie,
        projectNaam: projecten.naam,
      })
      .from(tijdregistraties)
      .innerJoin(projecten, eq(tijdregistraties.projectId, projecten.id))
      .where(eq(projecten.klantId, Number(id)))
      .orderBy(desc(tijdregistraties.startTijd))
      .limit(5);

    // KPIs
    const [totaalUren] = await db
      .select({ totaal: sql<number>`coalesce(sum(${tijdregistraties.duurMinuten}), 0)` })
      .from(tijdregistraties)
      .innerJoin(projecten, eq(tijdregistraties.projectId, projecten.id))
      .where(eq(projecten.klantId, Number(id)));

    return NextResponse.json({
      klant,
      projecten: projectenMetUren,
      notities: notitiesLijst,
      documenten: documentenLijst,
      recenteTijdregistraties: recenteTijd,
      kpis: {
        aantalProjecten: projectenMetUren.length,
        totaalMinuten: totaalUren?.totaal || 0,
        omzet: ((totaalUren?.totaal || 0) / 60) * (klant.uurtarief || 0),
        uurtarief: klant.uurtarief || 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// PUT /api/klanten/[id] — Update client
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const [bestaand] = await db.select().from(klanten).where(eq(klanten.id, Number(id)));
    if (!bestaand) {
      return NextResponse.json({ fout: "Klant niet gevonden." }, { status: 404 });
    }

    const { bedrijfsnaam, contactpersoon, email, telefoon, adres, uurtarief, notities: notitiesTekst } = body;

    if (bedrijfsnaam !== undefined && !bedrijfsnaam?.trim()) {
      return NextResponse.json({ fout: "Bedrijfsnaam is verplicht." }, { status: 400 });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ fout: "Ongeldig e-mailadres." }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { bijgewerktOp: new Date().toISOString() };
    if (bedrijfsnaam !== undefined) updateData.bedrijfsnaam = bedrijfsnaam.trim();
    if (contactpersoon !== undefined) updateData.contactpersoon = contactpersoon?.trim() || null;
    if (email !== undefined) updateData.email = email?.trim().toLowerCase() || null;
    if (telefoon !== undefined) updateData.telefoon = telefoon?.trim() || null;
    if (adres !== undefined) updateData.adres = adres?.trim() || null;
    if (uurtarief !== undefined) updateData.uurtarief = uurtarief || null;
    if (notitiesTekst !== undefined) updateData.notities = notitiesTekst?.trim() || null;

    const [bijgewerkt] = await db
      .update(klanten)
      .set(updateData)
      .where(eq(klanten.id, Number(id)))
      .returning();

    return NextResponse.json({ klant: bijgewerkt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/klanten/[id] — Soft-delete (is_actief = 0)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const [bestaand] = await db.select().from(klanten).where(eq(klanten.id, Number(id)));
    if (!bestaand) {
      return NextResponse.json({ fout: "Klant niet gevonden." }, { status: 404 });
    }

    await db
      .update(klanten)
      .set({ isActief: 0, bijgewerktOp: new Date().toISOString() })
      .where(eq(klanten.id, Number(id)));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
