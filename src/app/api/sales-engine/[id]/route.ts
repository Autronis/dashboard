import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { salesEngineScans, salesEngineKansen, leads } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const scanId = parseInt(id, 10);

    if (isNaN(scanId)) {
      return NextResponse.json({ fout: "Ongeldig scan ID" }, { status: 400 });
    }

    const scan = await db
      .select()
      .from(salesEngineScans)
      .where(eq(salesEngineScans.id, scanId))
      .get();

    if (!scan) {
      return NextResponse.json({ fout: "Scan niet gevonden" }, { status: 404 });
    }

    const lead = scan.leadId
      ? db.select().from(leads).where(eq(leads.id, scan.leadId)).get()
      : null;

    const kansen = await db
      .select()
      .from(salesEngineKansen)
      .where(eq(salesEngineKansen.scanId, scanId))
      .orderBy(salesEngineKansen.prioriteit)
      .all();

    return NextResponse.json({
      scan: {
        ...scan,
        scrapeResultaat: scan.scrapeResultaat ? JSON.parse(scan.scrapeResultaat) : null,
        aiAnalyse: scan.aiAnalyse ? JSON.parse(scan.aiAnalyse) : null,
      },
      lead,
      kansen,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
