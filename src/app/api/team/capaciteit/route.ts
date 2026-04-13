import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gebruikers, feestdagen, verlof } from "@/lib/db/schema";
import { berekenActieveUren } from "@/lib/screen-time-uren";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, sql } from "drizzle-orm";

function getWeekDates(jaar: number, week: number): { maandag: string; zondag: string; werkdagen: string[] } {
  // ISO week date calculation
  const jan4 = new Date(jaar, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const maandagJan4 = new Date(jan4);
  maandagJan4.setDate(jan4.getDate() - dayOfWeek + 1);

  const maandag = new Date(maandagJan4);
  maandag.setDate(maandagJan4.getDate() + (week - 1) * 7);

  const zondag = new Date(maandag);
  zondag.setDate(maandag.getDate() + 6);

  const werkdagen: string[] = [];
  for (let i = 0; i < 5; i++) {
    const dag = new Date(maandag);
    dag.setDate(maandag.getDate() + i);
    werkdagen.push(dag.toISOString().slice(0, 10));
  }

  return {
    maandag: maandag.toISOString().slice(0, 10),
    zondag: zondag.toISOString().slice(0, 10),
    werkdagen,
  };
}

function getISOWeek(date: Date): { week: number; jaar: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week: weekNo, jaar: d.getUTCFullYear() };
}

function countWorkdaysInRange(start: string, end: string, werkdagen: string[]): number {
  return werkdagen.filter((d) => d >= start && d <= end).length;
}

// GET /api/team/capaciteit — capaciteit per gebruiker voor een week
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);

    const now = new Date();
    const currentWeekInfo = getISOWeek(now);

    const week = Number(searchParams.get("week")) || currentWeekInfo.week;
    const jaar = Number(searchParams.get("jaar")) || currentWeekInfo.jaar;

    const { maandag, zondag, werkdagen } = getWeekDates(jaar, week);

    // Get all users
    const users = await db
      .select({ id: gebruikers.id, naam: gebruikers.naam })
      .from(gebruikers);

    // Get feestdagen in this week
    const feestdagenInWeek = await db
      .select()
      .from(feestdagen)
      .where(
        and(
          gte(feestdagen.datum, maandag),
          lte(feestdagen.datum, zondag)
        )
      );

    const feestdagDatums = feestdagenInWeek.map((f) => f.datum);
    const feestdagUren = feestdagDatums.filter((d) => werkdagen.includes(d)).length * 8;

    // Build capacity per user
    const capaciteit = await Promise.all(
      users.map(async (user) => {
        // Get goedgekeurd verlof overlapping this week
        const verlofRecords = await db
          .select()
          .from(verlof)
          .where(
            and(
              eq(verlof.gebruikerId, user.id),
              eq(verlof.status, "goedgekeurd"),
              lte(verlof.startDatum, zondag),
              gte(verlof.eindDatum, maandag)
            )
          );

        // Count verlof days in this week's werkdagen (excluding feestdagen)
        let verlofDagen = 0;
        for (const v of verlofRecords) {
          const overlapDays = werkdagen.filter(
            (d) => d >= v.startDatum && d <= v.eindDatum && !feestdagDatums.includes(d)
          );
          verlofDagen += overlapDays.length;
        }
        const verlofUren = verlofDagen * 8;

        // Productive screen-time uren this week (canonical hour calc)
        const screenTimeUren = await berekenActieveUren(user.id, maandag, zondag);
        const geplandUren = Math.round(screenTimeUren * 10) / 10;

        const basisUren = 40;
        const beschikbaarUren = Math.max(0, basisUren - feestdagUren - verlofUren);
        const percentage = beschikbaarUren > 0
          ? Math.round((geplandUren / beschikbaarUren) * 100)
          : 0;

        return {
          gebruikerId: user.id,
          naam: user.naam,
          basisUren,
          feestdagUren,
          verlofUren,
          beschikbaarUren,
          geplandUren,
          percentage,
        };
      })
    );

    return NextResponse.json({
      capaciteit,
      week,
      jaar,
      maandag,
      zondag,
      feestdagen: feestdagenInWeek,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
