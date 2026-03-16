import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { concurrenten, concurrentScans } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { scanConcurrent } from "@/lib/scan-concurrent";

export interface ScanState {
  actief: boolean;
  concurrenten: Array<{
    id: number;
    naam: string;
    status: "wachtend" | "bezig" | "voltooid" | "mislukt";
    stap?: string;
    fout?: string;
  }>;
}

declare global {
  // eslint-disable-next-line no-var
  var scanState: ScanState | undefined;
}

export function getScanState(): ScanState {
  return globalThis.scanState ?? { actief: false, concurrenten: [] };
}

export async function POST() {
  try {
    await requireAuth();

    if (globalThis.scanState?.actief) {
      return NextResponse.json({ fout: "Scan is al bezig" }, { status: 409 });
    }

    const actieveConcurrenten = db
      .select()
      .from(concurrenten)
      .where(eq(concurrenten.isActief, 1))
      .all();

    if (actieveConcurrenten.length === 0) {
      return NextResponse.json({ fout: "Geen actieve concurrenten" }, { status: 400 });
    }

    globalThis.scanState = {
      actief: true,
      concurrenten: actieveConcurrenten.map((c) => ({
        id: c.id,
        naam: c.naam,
        status: "wachtend" as const,
      })),
    };

    runScanAll(actieveConcurrenten).catch(() => {
      if (globalThis.scanState) globalThis.scanState.actief = false;
    });

    return NextResponse.json({ gestart: true, aantal: actieveConcurrenten.length });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

async function runScanAll(
  lijst: Array<{ id: number; naam: string; websiteUrl: string }>
) {
  const state = globalThis.scanState!;

  for (const concurrent of lijst) {
    const stateItem = state.concurrenten.find((c) => c.id === concurrent.id);
    if (!stateItem) continue;

    stateItem.status = "bezig";

    const [scanRecord] = await db
      .insert(concurrentScans)
      .values({
        concurrentId: concurrent.id,
        status: "bezig",
        scanDatum: new Date().toISOString(),
      })
      .returning();

    try {
      const result = await scanConcurrent(concurrent.id, (stap) => {
        stateItem.stap = stap;
      });

      db.update(concurrentScans)
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

      stateItem.status = "voltooid";
      stateItem.stap = undefined;
    } catch (error) {
      db.update(concurrentScans)
        .set({ status: "mislukt" })
        .where(eq(concurrentScans.id, scanRecord.id))
        .run();

      stateItem.status = "mislukt";
      stateItem.fout = error instanceof Error ? error.message : "Onbekende fout";
      stateItem.stap = undefined;
    }
  }

  state.actief = false;
}
