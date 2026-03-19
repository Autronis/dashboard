import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { concurrentScans, concurrenten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, desc } from "drizzle-orm";

export async function GET() {
  try {
    await requireAuth();

    const weekGeleden = new Date();
    weekGeleden.setDate(weekGeleden.getDate() - 7);
    const weekGeledenStr = weekGeleden.toISOString();

    const recenteScans = await db
      .select()
      .from(concurrentScans)
      .where(and(
        eq(concurrentScans.status, "voltooid"),
        gte(concurrentScans.aangemaaktOp, weekGeledenStr)
      ))
      .orderBy(desc(concurrentScans.aangemaaktOp))
      .all();

    let wijzigingenDezeWeek = 0;
    const highlights: Array<{ concurrentNaam: string; tekst: string; type: "waarschuwing" | "kans" }> = [];

    for (const scan of recenteScans) {
      if (scan.websiteChanges) {
        const changes: Array<{ veranderd: boolean }> = JSON.parse(scan.websiteChanges);
        wijzigingenDezeWeek += changes.filter((c) => c.veranderd).length;
      }

      const concurrent = await db.select({ naam: concurrenten.naam })
        .from(concurrenten)
        .where(eq(concurrenten.id, scan.concurrentId!))
        .get();

      if (scan.aiHighlights) {
        const scanHighlights: string[] = JSON.parse(scan.aiHighlights);
        for (const h of scanHighlights.slice(0, 2)) {
          highlights.push({ concurrentNaam: concurrent?.naam ?? "Onbekend", tekst: h, type: "waarschuwing" });
        }
      }

      if (scan.kansen) {
        const kansen: string[] = JSON.parse(scan.kansen);
        for (const k of kansen.slice(0, 1)) {
          highlights.push({ concurrentNaam: concurrent?.naam ?? "Onbekend", tekst: k, type: "kans" });
        }
      }
    }

    return NextResponse.json({
      wijzigingenDezeWeek,
      highlights: highlights.slice(0, 4),
      laatsteScan: recenteScans[0]?.aangemaaktOp ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
