import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { salesEngineScans, leads } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id: batchId } = await params;

    if (!batchId) {
      return NextResponse.json({ fout: "Batch ID is verplicht" }, { status: 400 });
    }

    const scans = await db
      .select({
        id: salesEngineScans.id,
        status: salesEngineScans.status,
        websiteUrl: salesEngineScans.websiteUrl,
        leadId: salesEngineScans.leadId,
        bedrijfsnaam: leads.bedrijfsnaam,
        samenvatting: salesEngineScans.samenvatting,
        foutmelding: salesEngineScans.foutmelding,
      })
      .from(salesEngineScans)
      .leftJoin(leads, eq(salesEngineScans.leadId, leads.id))
      .where(eq(salesEngineScans.batchId, batchId))
      .all();

    if (scans.length === 0) {
      return NextResponse.json({ fout: "Batch niet gevonden" }, { status: 404 });
    }

    const totaal = scans.length;
    const completed = scans.filter((s) => s.status === "completed").length;
    const pending = scans.filter((s) => s.status === "pending").length;
    const failed = scans.filter((s) => s.status === "failed").length;

    return NextResponse.json({
      batchId,
      totaal,
      completed,
      pending,
      failed,
      scans: scans.map((s) => ({
        id: s.id,
        bedrijfsnaam: s.bedrijfsnaam ?? "Onbekend",
        status: s.status,
        websiteUrl: s.websiteUrl,
        samenvatting: s.samenvatting,
        foutmelding: s.foutmelding,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    const status = message === "Niet geauthenticeerd" ? 401 : 400;
    return NextResponse.json({ fout: message }, { status });
  }
}
