import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { concurrenten, concurrentScans } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { scanConcurrent } from "@/lib/scan-concurrent";
import { getScanState } from "../route";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const { id } = await params;
    const concurrentId = parseInt(id, 10);

    // Guard: check of deze concurrent al gescand wordt
    const state = getScanState();
    if (state.actief) {
      const item = state.concurrenten.find((c) => c.id === concurrentId);
      if (item?.status === "bezig") {
        return NextResponse.json({ fout: "Deze concurrent wordt al gescand" }, { status: 409 });
      }
    }

    const concurrent = await db
      .select()
      .from(concurrenten)
      .where(eq(concurrenten.id, concurrentId))
      .get();

    if (!concurrent) {
      return NextResponse.json({ fout: "Concurrent niet gevonden" }, { status: 404 });
    }

    const [scanRecord] = await db
      .insert(concurrentScans)
      .values({
        concurrentId,
        status: "bezig",
        scanDatum: new Date().toISOString(),
      })
      .returning();

    try {
      const result = await scanConcurrent(concurrentId);

      await db.update(concurrentScans)
        .set({
          status: "voltooid",
          websiteChanges: result.websiteChanges ? JSON.stringify(result.websiteChanges) : null,
          vacatures: result.vacatures ? JSON.stringify(result.vacatures) : null,
          socialActivity: result.socialActivity ? JSON.stringify(result.socialActivity) : null,
          aiSamenvatting: result.aiSamenvatting,
          aiHighlights: result.aiHighlights ? JSON.stringify(result.aiHighlights) : null,
          trendIndicator: result.trendIndicator,
          kansen: result.kansen ? JSON.stringify(result.kansen) : null,
        })
        .where(eq(concurrentScans.id, scanRecord.id))
        .run();

      return NextResponse.json({ scan: { ...scanRecord, ...result, status: "voltooid" } });
    } catch (error) {
      await db.update(concurrentScans)
        .set({ status: "mislukt" })
        .where(eq(concurrentScans.id, scanRecord.id))
        .run();

      return NextResponse.json(
        { fout: error instanceof Error ? error.message : "Scan mislukt" },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
