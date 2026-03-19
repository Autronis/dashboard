import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kilometerRegistraties, klanten, projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, sql, gte, lte } from "drizzle-orm";

// GET /api/kilometers — List km registrations with optional month/year filter
export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { searchParams } = new URL(req.url);
    const maand = searchParams.get("maand");
    const jaar = searchParams.get("jaar");

    const conditions = [eq(kilometerRegistraties.gebruikerId, gebruiker.id)];

    if (maand && jaar) {
      const startDatum = `${jaar}-${maand.padStart(2, "0")}-01`;
      const endMonth = parseInt(maand);
      const endYear = parseInt(jaar);
      const nextMonth = endMonth === 12 ? 1 : endMonth + 1;
      const nextYear = endMonth === 12 ? endYear + 1 : endYear;
      const eindDatum = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
      conditions.push(gte(kilometerRegistraties.datum, startDatum));
      conditions.push(lte(kilometerRegistraties.datum, eindDatum));
    } else if (jaar) {
      conditions.push(gte(kilometerRegistraties.datum, `${jaar}-01-01`));
      conditions.push(lte(kilometerRegistraties.datum, `${jaar}-12-31`));
    }

    const lijst = await db
      .select({
        id: kilometerRegistraties.id,
        datum: kilometerRegistraties.datum,
        vanLocatie: kilometerRegistraties.vanLocatie,
        naarLocatie: kilometerRegistraties.naarLocatie,
        kilometers: kilometerRegistraties.kilometers,
        zakelijkDoel: kilometerRegistraties.zakelijkDoel,
        klantId: kilometerRegistraties.klantId,
        projectId: kilometerRegistraties.projectId,
        isRetour: kilometerRegistraties.isRetour,
        doelType: kilometerRegistraties.doelType,
        tariefPerKm: kilometerRegistraties.tariefPerKm,
        aangemaaktOp: kilometerRegistraties.aangemaaktOp,
        klantNaam: klanten.bedrijfsnaam,
        projectNaam: projecten.naam,
      })
      .from(kilometerRegistraties)
      .leftJoin(klanten, eq(kilometerRegistraties.klantId, klanten.id))
      .leftJoin(projecten, eq(kilometerRegistraties.projectId, projecten.id))
      .where(and(...conditions))
      .orderBy(sql`${kilometerRegistraties.datum} DESC`);

    // Calculate monthly total
    const totaalKm = lijst.reduce((sum, r) => sum + r.kilometers, 0);
    const totaalBedrag = lijst.reduce(
      (sum, r) => sum + r.kilometers * (r.tariefPerKm ?? 0.23),
      0
    );

    return NextResponse.json({
      ritten: lijst,
      totaalKm,
      totaalBedrag,
      aantalRitten: lijst.length,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/kilometers — Create new rit
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();

    const { datum, vanLocatie, naarLocatie, kilometers, zakelijkDoel, doelType, isRetour, klantId, projectId, opgeslagenRouteId, tariefPerKm } = body;

    if (!datum || !vanLocatie?.trim() || !naarLocatie?.trim() || !kilometers) {
      return NextResponse.json(
        { fout: "Datum, van, naar en kilometers zijn verplicht." },
        { status: 400 }
      );
    }

    if (kilometers <= 0) {
      return NextResponse.json({ fout: "Kilometers moet positief zijn." }, { status: 400 });
    }

    const kmWaarde = isRetour ? parseFloat(kilometers) * 2 : parseFloat(kilometers);

    const [nieuw] = await db
      .insert(kilometerRegistraties)
      .values({
        gebruikerId: gebruiker.id,
        datum,
        vanLocatie: vanLocatie.trim(),
        naarLocatie: naarLocatie.trim(),
        kilometers: kmWaarde,
        isRetour: isRetour ? 1 : 0,
        zakelijkDoel: zakelijkDoel?.trim() || null,
        doelType: doelType || null,
        klantId: klantId || null,
        projectId: projectId || null,
        opgeslagenRouteId: opgeslagenRouteId || null,
        tariefPerKm: tariefPerKm ?? 0.23,
      })
      .returning();

    return NextResponse.json({ rit: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
