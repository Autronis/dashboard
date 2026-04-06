import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { screenTimeEntries } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, sql } from "drizzle-orm";

// PUT /api/screen-time/locatie — Update locatie for all entries in a time range
export async function PUT(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { startTijd, eindTijd, locatie } = await req.json();

    if (!startTijd || !eindTijd) {
      return NextResponse.json({ fout: "startTijd en eindTijd zijn verplicht" }, { status: 400 });
    }
    if (locatie !== "kantoor" && locatie !== "thuis") {
      return NextResponse.json({ fout: "Locatie moet 'kantoor' of 'thuis' zijn" }, { status: 400 });
    }

    const result = await db
      .update(screenTimeEntries)
      .set({ locatie })
      .where(and(
        eq(screenTimeEntries.gebruikerId, gebruiker.id),
        gte(screenTimeEntries.startTijd, startTijd),
        lte(screenTimeEntries.startTijd, eindTijd),
      ))
      .run();

    return NextResponse.json({ succes: true, bijgewerkt: result.changes });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
