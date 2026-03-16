import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { voorlopigeAanslagen, belastingAuditLog } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";

// GET /api/belasting/voorlopige-aanslagen?jaar=2026
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const jaarParam = searchParams.get("jaar");
    const jaar = jaarParam ? parseInt(jaarParam, 10) : new Date().getFullYear();

    const aanslagen = await db
      .select()
      .from(voorlopigeAanslagen)
      .where(eq(voorlopigeAanslagen.jaar, jaar))
      .orderBy(sql`${voorlopigeAanslagen.vervaldatum} ASC`);

    const totaalBedrag = aanslagen.reduce((sum, a) => sum + a.bedrag, 0);
    const totaalBetaald = aanslagen.reduce((sum, a) => sum + (a.betaaldBedrag ?? 0), 0);
    const openstaand = Math.round((totaalBedrag - totaalBetaald) * 100) / 100;

    return NextResponse.json({
      aanslagen,
      samenvatting: {
        totaalBedrag: Math.round(totaalBedrag * 100) / 100,
        totaalBetaald: Math.round(totaalBetaald * 100) / 100,
        openstaand,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/belasting/voorlopige-aanslagen
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();

    const { jaar, type, bedrag, vervaldatum, notities } = body as {
      jaar: number;
      type?: string;
      bedrag: number;
      vervaldatum?: string;
      notities?: string;
    };

    if (!jaar || !bedrag) {
      return NextResponse.json(
        { fout: "Jaar en bedrag zijn verplicht." },
        { status: 400 }
      );
    }

    const result = await db
      .insert(voorlopigeAanslagen)
      .values({
        jaar,
        type: (type as "inkomstenbelasting" | "zvw") ?? "inkomstenbelasting",
        bedrag,
        betaaldBedrag: 0,
        status: "openstaand",
        vervaldatum,
        notities,
      })
      .returning();

    await db.insert(belastingAuditLog).values({
      gebruikerId: gebruiker.id,
      actie: "voorlopige_aanslag_aangemaakt",
      entiteitType: "voorlopige_aanslag",
      entiteitId: result[0]?.id,
      details: JSON.stringify({ jaar, bedrag, type }),
    });

    return NextResponse.json({ aanslag: result[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
