import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kilometerRegistraties, klanten, kmStanden, autoInstellingen, brandstofKosten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import { BelastingrapportPDF } from "@/lib/belastingrapport-pdf";
import React from "react";

// GET /api/kilometers/belastingrapport?jaar=2026
export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { searchParams } = new URL(req.url);
    const jaar = parseInt(searchParams.get("jaar") || String(new Date().getFullYear()));

    // 1. Get all trips for the year
    const ritten = await db
      .select({
        datum: kilometerRegistraties.datum,
        vanLocatie: kilometerRegistraties.vanLocatie,
        naarLocatie: kilometerRegistraties.naarLocatie,
        kilometers: kilometerRegistraties.kilometers,
        doelType: kilometerRegistraties.doelType,
        klantNaam: klanten.bedrijfsnaam,
        tariefPerKm: kilometerRegistraties.tariefPerKm,
      })
      .from(kilometerRegistraties)
      .leftJoin(klanten, eq(kilometerRegistraties.klantId, klanten.id))
      .where(
        and(
          eq(kilometerRegistraties.gebruikerId, gebruiker.id),
          gte(kilometerRegistraties.datum, `${jaar}-01-01`),
          lte(kilometerRegistraties.datum, `${jaar}-12-31`)
        )
      )
      .orderBy(sql`${kilometerRegistraties.datum} ASC`);

    // 2. Group trips by month
    const rittenPerMaand: Record<number, typeof ritten> = {};
    for (const rit of ritten) {
      const maand = parseInt(rit.datum.slice(5, 7));
      if (!rittenPerMaand[maand]) rittenPerMaand[maand] = [];
      rittenPerMaand[maand].push(rit);
    }

    // 3. Get km-standen
    const standen = await db
      .select({
        maand: kmStanden.maand,
        beginStand: kmStanden.beginStand,
        eindStand: kmStanden.eindStand,
      })
      .from(kmStanden)
      .where(and(eq(kmStanden.gebruikerId, gebruiker.id), eq(kmStanden.jaar, jaar)))
      .orderBy(kmStanden.maand);

    // 4. Get auto instellingen
    const [inst] = await db
      .select()
      .from(autoInstellingen)
      .where(eq(autoInstellingen.gebruikerId, gebruiker.id))
      .limit(1);

    const zakelijkPercentage = inst?.zakelijkPercentage ?? 75;
    const tariefPerKm = inst?.tariefPerKm ?? 0.23;

    // 5. Get brandstofkosten totaal + per maand
    const brandstof = await db
      .select({ datum: brandstofKosten.datum, bedrag: brandstofKosten.bedrag, liters: brandstofKosten.liters })
      .from(brandstofKosten)
      .where(
        and(
          eq(brandstofKosten.gebruikerId, gebruiker.id),
          gte(brandstofKosten.datum, `${jaar}-01-01`),
          lte(brandstofKosten.datum, `${jaar}-12-31`)
        )
      );
    const totaalBrandstof = brandstof.reduce((sum, b) => sum + b.bedrag, 0);

    // Group brandstof by month
    const brandstofMaandMap = new Map<number, { bedrag: number; liters: number | null }>();
    for (const b of brandstof) {
      const maand = parseInt(b.datum.slice(5, 7));
      const existing = brandstofMaandMap.get(maand);
      if (existing) {
        existing.bedrag += b.bedrag;
        if (b.liters !== null) {
          existing.liters = (existing.liters ?? 0) + b.liters;
        }
      } else {
        brandstofMaandMap.set(maand, { bedrag: b.bedrag, liters: b.liters ?? null });
      }
    }
    const brandstofPerMaand = Array.from(brandstofMaandMap.entries()).map(([maand, data]) => ({
      maand,
      bedrag: data.bedrag,
      liters: data.liters,
    }));

    // 6. Calculate totals
    const totaalKm = ritten.reduce((sum, r) => sum + r.kilometers, 0);
    const totaalZakelijkKm = totaalKm * (zakelijkPercentage / 100);
    const totaalAftrekbaar = totaalZakelijkKm * tariefPerKm;

    // Calculate werkelijk percentage from km-standen
    let totaalGereden: number | null = null;
    let werkelijkPercentage: number | null = null;
    if (standen.length > 0) {
      totaalGereden = standen.reduce((sum, k) => sum + (k.eindStand - k.beginStand), 0);
      if (totaalGereden > 0) {
        werkelijkPercentage = (totaalKm / totaalGereden) * 100;
      }
    }

    // 7. Build category summary
    const catMap = new Map<string, { ritten: number; km: number; bedrag: number }>();
    for (const rit of ritten) {
      const type = rit.doelType || "overig";
      const existing = catMap.get(type) || { ritten: 0, km: 0, bedrag: 0 };
      existing.ritten++;
      existing.km += rit.kilometers;
      existing.bedrag += rit.kilometers * (rit.tariefPerKm ?? tariefPerKm);
      catMap.set(type, existing);
    }
    const categorieën = Array.from(catMap.entries()).map(([doelType, data]) => ({
      doelType,
      ...data,
    }));

    // 8. Render PDF
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(
      React.createElement(BelastingrapportPDF, {
        jaar,
        gebruikerNaam: gebruiker.naam,
        rittenPerMaand,
        kmStanden: standen,
        zakelijkPercentage,
        tariefPerKm,
        totaalKm,
        totaalZakelijkKm,
        totaalAftrekbaar,
        categorieën,
        totaalBrandstof,
        werkelijkPercentage,
        totaalGereden,
        brandstofPerMaand,
      }) as any
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Autronis_Kilometerregistratie_${jaar}.pdf"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Kon PDF niet genereren" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
