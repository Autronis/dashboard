import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { salesEngineScans, leads, klanten } from "@/lib/db/schema";
import { and, gte, eq, sql } from "drizzle-orm";

// GET /api/dashboard/pipeline-week
// Weekly funnel snapshot voor de SalesPipelineWidget. Maandag = start week.
// Alle counts zijn scoped op deze week (zodat de voortgang vs target klopt).
export async function GET() {
  try {
    await requireAuth();

    const now = new Date();
    const day = now.getDay();
    const maandagOffset = day === 0 ? -6 : 1 - day;
    const maandag = new Date(now);
    maandag.setDate(now.getDate() + maandagOffset);
    maandag.setHours(0, 0, 0, 0);
    const maandagIso = maandag.toISOString();

    const [scansRow] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(salesEngineScans)
      .where(gte(salesEngineScans.aangemaaktOp, maandagIso));

    // Outreach = leads waarvan de status deze week op 'contact' of verder
    // staat (bijgewerktOp als proxy voor state-transition).
    const [outreachRow] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(leads)
      .where(
        and(
          gte(leads.bijgewerktOp, maandagIso),
          sql`${leads.status} IN ('contact', 'offerte', 'gewonnen')`,
        ),
      );

    // Replies = positieve reactie → status offerte of gewonnen deze week.
    const [repliesRow] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(leads)
      .where(
        and(
          gte(leads.bijgewerktOp, maandagIso),
          sql`${leads.status} IN ('offerte', 'gewonnen')`,
        ),
      );

    // Deals = nieuwe echte klanten (niet facturatie-adressen) deze week.
    const [dealsRow] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(klanten)
      .where(
        and(
          gte(klanten.aangemaaktOp, maandagIso),
          eq(klanten.isActief, 1),
          sql`COALESCE(${klanten.type}, 'klant') = 'klant'`,
        ),
      );

    return NextResponse.json({
      scansDezeWeek: Number(scansRow?.count ?? 0),
      outreachVerstuurd: Number(outreachRow?.count ?? 0),
      repliesOntvangen: Number(repliesRow?.count ?? 0),
      dealsGesloten: Number(dealsRow?.count ?? 0),
      maandTarget: { scans: 200, deals: 3 },
      vanISO: maandagIso,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message.includes("geauthenticeerd") ? 401 : 500 },
    );
  }
}
