import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { persoonlijkeHabits, persoonlijkeCheckins, persoonlijkeTodos } from "@/lib/db/schema";
import { requireAuthOrApiKey } from "@/lib/auth";
import { eq, and, gte, asc, desc, sql, or } from "drizzle-orm";

// GET /api/persoonlijk/dag?datum=YYYY-MM-DD
export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuthOrApiKey(req);
    if (gebruiker.id !== 1) {
      return NextResponse.json({ fout: "Geen toegang" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const datum = searchParams.get("datum") || new Date().toISOString().slice(0, 10);

    // 1. Alle actieve habits
    const habits = await db
      .select()
      .from(persoonlijkeHabits)
      .where(eq(persoonlijkeHabits.actief, 1))
      .orderBy(asc(persoonlijkeHabits.volgorde));

    // 2. Checkins van vandaag
    const checkins = await db
      .select()
      .from(persoonlijkeCheckins)
      .where(eq(persoonlijkeCheckins.datum, datum));

    const checkinMap = new Map(checkins.map((c) => [c.habitId, c.gedaan === 1]));

    const habitsMetCheckin = habits.map((h) => ({
      id: h.id,
      naam: h.naam,
      type: h.type,
      tijd: h.tijd,
      volgorde: h.volgorde,
      gedaan: checkinMap.get(h.id) ?? false,
    }));

    // 3. Open todos + recent afgerond (binnen 3 dagen)
    const driedagenGeleden = new Date();
    driedagenGeleden.setDate(driedagenGeleden.getDate() - 3);
    const todos = await db
      .select()
      .from(persoonlijkeTodos)
      .where(
        or(
          eq(persoonlijkeTodos.gedaan, 0),
          and(
            eq(persoonlijkeTodos.gedaan, 1),
            gte(persoonlijkeTodos.gedaanOp, driedagenGeleden.toISOString())
          )
        )
      )
      .orderBy(asc(persoonlijkeTodos.gedaan), desc(persoonlijkeTodos.aangemaaktOp));

    // 4. Heatmap: laatste 14 dagen, score per dag
    const veertienDagenGeleden = new Date();
    veertienDagenGeleden.setDate(veertienDagenGeleden.getDate() - 13);
    const veertienDagenStr = veertienDagenGeleden.toISOString().slice(0, 10);

    const heatmapRaw = await db
      .select({
        datum: persoonlijkeCheckins.datum,
        score: sql<number>`SUM(${persoonlijkeCheckins.gedaan})`,
      })
      .from(persoonlijkeCheckins)
      .where(gte(persoonlijkeCheckins.datum, veertienDagenStr))
      .groupBy(persoonlijkeCheckins.datum);

    const heatmapMap = new Map(heatmapRaw.map((r) => [r.datum, Number(r.score)]));
    const weekHeatmap: { datum: string; score: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      weekHeatmap.push({ datum: ds, score: heatmapMap.get(ds) ?? 0 });
    }

    // 5. Streak: tel terug vanuit vandaag zolang score >= 7
    const STREAK_DREMPEL = 7;
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const score = heatmapMap.get(ds);
      // Vandaag nog niet ≥7: sla over zonder streak te breken
      if (score === undefined || score < STREAK_DREMPEL) {
        if (i === 0) continue;
        break;
      }
      streak++;
    }

    return NextResponse.json({
      datum,
      habits: habitsMetCheckin,
      todos,
      streak,
      weekHeatmap,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
