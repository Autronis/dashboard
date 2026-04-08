import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { salesEngineScans, salesEngineKansen, leads, offertes, outreachSequenties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, desc, and, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const conditions = [];
    if (status && status !== "alle") {
      conditions.push(eq(salesEngineScans.status, status as "pending" | "completed" | "failed"));
    }

    const scans = await db
      .select({
        id: salesEngineScans.id,
        leadId: salesEngineScans.leadId,
        websiteUrl: salesEngineScans.websiteUrl,
        samenvatting: salesEngineScans.samenvatting,
        status: salesEngineScans.status,
        foutmelding: salesEngineScans.foutmelding,
        aangemaaktOp: salesEngineScans.aangemaaktOp,
        bedrijfsnaam: leads.bedrijfsnaam,
        contactpersoon: leads.contactpersoon,
        email: leads.email,
      })
      .from(salesEngineScans)
      .leftJoin(leads, eq(salesEngineScans.leadId, leads.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(salesEngineScans.aangemaaktOp))
      .all();

    const scansWithKansen = await Promise.all(scans.map(async (scan) => {
      const kansen = await db
        .select({ impact: salesEngineKansen.impact })
        .from(salesEngineKansen)
        .where(eq(salesEngineKansen.scanId, scan.id))
        .all();

      const hoogsteImpact = kansen.find((k) => k.impact === "hoog")
        ? "hoog"
        : kansen.find((k) => k.impact === "midden")
          ? "midden"
          : kansen.length > 0
            ? "laag"
            : null;

      return { ...scan, aantalKansen: kansen.length, hoogsteImpact };
    }));

    const totaal = scans.length;
    const dezeWeek = scans.filter((s) => {
      if (!s.aangemaaktOp) return false;
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      return s.aangemaaktOp >= weekAgo;
    }).length;
    const completed = scans.filter((s) => s.status === "completed").length;
    const failed = scans.filter((s) => s.status === "failed").length;

    // Conversie analytics: scans → outreach → offertes → geaccepteerd
    const outreachCount = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${outreachSequenties.leadId})` })
      .from(outreachSequenties)
      .get();

    const offerteStats = await db
      .select({
        totaal: sql<number>`COUNT(*)`,
        geaccepteerd: sql<number>`SUM(CASE WHEN ${offertes.status} = 'geaccepteerd' THEN 1 ELSE 0 END)`,
      })
      .from(offertes)
      .get();

    return NextResponse.json({
      scans: scansWithKansen,
      kpis: {
        totaal,
        dezeWeek,
        succesRatio: totaal > 0 ? Math.round((completed / totaal) * 100) : 0,
        failed,
      },
      conversie: {
        scans: completed,
        outreach: outreachCount?.count ?? 0,
        offertes: offerteStats?.totaal ?? 0,
        geaccepteerd: offerteStats?.geaccepteerd ?? 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
