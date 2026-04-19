import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { leads } from "@/lib/db/schema";
import { and, or, eq, lte, gte, sql, desc } from "drizzle-orm";

// GET /api/dashboard/hot-prospects
// Drie buckets: actie-vereist (volgendeActie gepland vandaag of eerder),
// stille proposals (status=offerte >7d stil), stille contacten
// (status=contact >14d stil). Max 5 per bucket, gesorteerd op urgentie.
export async function GET() {
  try {
    await requireAuth();

    const now = new Date();
    const vandaagIso = now.toISOString();
    const zevenDagenGeleden = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const veertienDagenGeleden = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const actieLeads = await db
      .select({
        id: leads.id,
        bedrijfsnaam: leads.bedrijfsnaam,
        status: leads.status,
        volgendeActie: leads.volgendeActie,
        volgendeActieDatum: leads.volgendeActieDatum,
        waarde: leads.waarde,
      })
      .from(leads)
      .where(
        and(
          eq(leads.isActief, 1),
          lte(leads.volgendeActieDatum, vandaagIso),
          sql`${leads.volgendeActieDatum} IS NOT NULL`,
          sql`${leads.status} NOT IN ('gewonnen', 'verloren')`,
        ),
      )
      .orderBy(leads.volgendeActieDatum)
      .limit(5);

    const stilleOffertes = await db
      .select({
        id: leads.id,
        bedrijfsnaam: leads.bedrijfsnaam,
        status: leads.status,
        waarde: leads.waarde,
        bijgewerktOp: leads.bijgewerktOp,
      })
      .from(leads)
      .where(
        and(
          eq(leads.isActief, 1),
          eq(leads.status, "offerte"),
          lte(leads.bijgewerktOp, zevenDagenGeleden),
        ),
      )
      .orderBy(leads.bijgewerktOp)
      .limit(5);

    const stilleContacten = await db
      .select({
        id: leads.id,
        bedrijfsnaam: leads.bedrijfsnaam,
        status: leads.status,
        waarde: leads.waarde,
        bijgewerktOp: leads.bijgewerktOp,
      })
      .from(leads)
      .where(
        and(
          eq(leads.isActief, 1),
          eq(leads.status, "contact"),
          lte(leads.bijgewerktOp, veertienDagenGeleden),
        ),
      )
      .orderBy(leads.bijgewerktOp)
      .limit(5);

    return NextResponse.json({
      actieVereist: actieLeads.map((l) => ({
        id: l.id,
        bedrijfsnaam: l.bedrijfsnaam,
        status: l.status,
        actie: l.volgendeActie,
        datum: l.volgendeActieDatum,
        waarde: l.waarde,
      })),
      stilleOffertes: stilleOffertes.map((l) => ({
        id: l.id,
        bedrijfsnaam: l.bedrijfsnaam,
        status: l.status,
        sinds: l.bijgewerktOp,
        waarde: l.waarde,
      })),
      stilleContacten: stilleContacten.map((l) => ({
        id: l.id,
        bedrijfsnaam: l.bedrijfsnaam,
        status: l.status,
        sinds: l.bijgewerktOp,
        waarde: l.waarde,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message.includes("geauthenticeerd") ? 401 : 500 },
    );
  }
}
