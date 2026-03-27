import { db } from "@/lib/db";
import { screenTimeEntries } from "@/lib/db/schema";
import { and, gte, lte, sql } from "drizzle-orm";

interface TimeInterval {
  start: number;
  end: number;
}

/**
 * Bereken unieke actieve uren uit screen time entries.
 * Overlappende entries (meerdere apps tegelijk) worden maar 1x geteld.
 */
function mergeIntervals(intervals: TimeInterval[]): number {
  if (intervals.length === 0) return 0;

  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: TimeInterval[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i];
    const last = merged[merged.length - 1];
    if (curr.start <= last.end) {
      last.end = Math.max(last.end, curr.end);
    } else {
      merged.push({ ...curr });
    }
  }

  return merged.reduce((sum, iv) => sum + (iv.end - iv.start), 0) / 1000; // seconds
}

/**
 * Haal unieke actieve seconden op voor een datumrange.
 * Returned seconden (niet uren) — caller kan converteren.
 */
export async function getUniqueScreenTimeSeconds(
  startDate: string,
  endDate: string
): Promise<number> {
  const entries = await db
    .select({
      startTijd: screenTimeEntries.startTijd,
      eindTijd: screenTimeEntries.eindTijd,
    })
    .from(screenTimeEntries)
    .where(
      and(
        gte(screenTimeEntries.startTijd, startDate),
        lte(screenTimeEntries.startTijd, endDate),
        sql`${screenTimeEntries.categorie} != 'inactief'`
      )
    );

  const intervals: TimeInterval[] = entries.map((e) => ({
    start: new Date(e.startTijd).getTime(),
    end: new Date(e.eindTijd).getTime(),
  }));

  return mergeIntervals(intervals);
}

/**
 * Haal unieke actieve seconden op per dag voor een datumrange.
 */
export async function getUniqueScreenTimePerDay(
  startDate: string,
  endDate: string
): Promise<Map<string, number>> {
  const entries = await db
    .select({
      startTijd: screenTimeEntries.startTijd,
      eindTijd: screenTimeEntries.eindTijd,
    })
    .from(screenTimeEntries)
    .where(
      and(
        gte(screenTimeEntries.startTijd, startDate),
        lte(screenTimeEntries.startTijd, endDate),
        sql`${screenTimeEntries.categorie} != 'inactief'`
      )
    );

  // Group by day
  const perDay = new Map<string, TimeInterval[]>();
  for (const e of entries) {
    const dag = e.startTijd.slice(0, 10);
    const arr = perDay.get(dag) || [];
    arr.push({
      start: new Date(e.startTijd).getTime(),
      end: new Date(e.eindTijd).getTime(),
    });
    perDay.set(dag, arr);
  }

  const result = new Map<string, number>();
  for (const [dag, intervals] of perDay) {
    result.set(dag, mergeIntervals(intervals));
  }

  return result;
}

/**
 * Haal unieke actieve seconden op per maand voor een jaar.
 */
export async function getUniqueScreenTimePerMonth(
  jaar: number
): Promise<Map<string, number>> {
  const startDate = `${jaar}-01-01T00:00:00`;
  const endDate = `${jaar}-12-31T23:59:59`;

  const entries = await db
    .select({
      startTijd: screenTimeEntries.startTijd,
      eindTijd: screenTimeEntries.eindTijd,
    })
    .from(screenTimeEntries)
    .where(
      and(
        gte(screenTimeEntries.startTijd, startDate),
        lte(screenTimeEntries.startTijd, endDate),
        sql`${screenTimeEntries.categorie} != 'inactief'`
      )
    );

  // Group by month
  const perMonth = new Map<string, TimeInterval[]>();
  for (const e of entries) {
    const maand = e.startTijd.slice(0, 7);
    const arr = perMonth.get(maand) || [];
    arr.push({
      start: new Date(e.startTijd).getTime(),
      end: new Date(e.eindTijd).getTime(),
    });
    perMonth.set(maand, arr);
  }

  const result = new Map<string, number>();
  for (const [maand, intervals] of perMonth) {
    result.set(maand, mergeIntervals(intervals));
  }

  return result;
}
