import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tijdregistraties, screenTimeEntries } from "@/lib/db/schema";
import { requireAuthOrApiKey } from "@/lib/auth";
import { and, gte, lte, sql } from "drizzle-orm";

// GET /api/briefing/uren-deze-week — totalen voor heel team, deze week (ma t/m zo)
// Returns: { projectMinuten, screenSeconden, van, tot }
export async function GET(req: NextRequest) {
  try {
    await requireAuthOrApiKey(req);

    const now = new Date();
    const day = now.getDay();
    const maandagOffset = day === 0 ? -6 : 1 - day;
    const van = new Date(now);
    van.setDate(now.getDate() + maandagOffset);
    van.setHours(0, 0, 0, 0);
    const tot = new Date(van);
    tot.setDate(van.getDate() + 7);

    const vanIso = van.toISOString();
    const totIso = tot.toISOString();
    const vanDatum = vanIso.slice(0, 10);
    const totDatum = new Date(tot.getTime() - 1).toISOString().slice(0, 10);

    const [projectRow] = await db
      .select({ totaal: sql<number>`COALESCE(SUM(${tijdregistraties.duurMinuten}), 0)` })
      .from(tijdregistraties)
      .where(and(gte(tijdregistraties.startTijd, vanIso), lte(tijdregistraties.startTijd, totIso)));

    const [screenRow] = await db
      .select({ totaal: sql<number>`COALESCE(SUM(${screenTimeEntries.duurSeconden}), 0)` })
      .from(screenTimeEntries)
      .where(and(gte(screenTimeEntries.startTijd, vanIso), lte(screenTimeEntries.startTijd, totIso)));

    return NextResponse.json({
      projectMinuten: Number(projectRow?.totaal ?? 0),
      screenSeconden: Number(screenRow?.totaal ?? 0),
      van: vanDatum,
      tot: totDatum,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message.includes("geauthenticeerd") ? 401 : 500 }
    );
  }
}
