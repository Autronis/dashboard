import { db } from "@/lib/db";
import { screenTimeEntries } from "@/lib/db/schema";
import { eq, and, sql, asc } from "drizzle-orm";

const SKIP_APPS = new Set(["LockApp", "SearchHost", "ShellHost", "ShellExperienceHost", "Inactief"]);
const SLOT_MS = 30 * 60 * 1000; // 30 min
const NL_TZ = "Europe/Amsterdam";

/** Convert UTC ISO string to NL local date string (YYYY-MM-DD) */
function nlDatum(isoStr: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: NL_TZ }).format(new Date(isoStr));
}

/**
 * Calculate active screen time hours for a date range using the same
 * 30-min slot merging logic as the Tijd page's sessies API.
 * vanDatum/totDatum are NL local dates (YYYY-MM-DD).
 * Returns hours (not minutes or seconds).
 */
export async function berekenActieveUren(
  gebruikerId: number,
  vanDatum: string,
  totDatum: string
): Promise<number> {
  // Expand UTC range by ±1 day to capture entries near midnight that belong
  // to the right NL local date but fall on a different UTC date.
  const vanExpanded = new Date(vanDatum);
  vanExpanded.setDate(vanExpanded.getDate() - 1);
  const totExpanded = new Date(totDatum);
  totExpanded.setDate(totExpanded.getDate() + 1);
  const vanUtc = vanExpanded.toISOString().slice(0, 10);
  const totUtc = totExpanded.toISOString().slice(0, 10);

  const entries = await db
    .select({
      app: screenTimeEntries.app,
      categorie: screenTimeEntries.categorie,
      startTijd: screenTimeEntries.startTijd,
      eindTijd: screenTimeEntries.eindTijd,
      duurSeconden: screenTimeEntries.duurSeconden,
      projectId: screenTimeEntries.projectId,
      klantId: screenTimeEntries.klantId,
    })
    .from(screenTimeEntries)
    .where(and(
      eq(screenTimeEntries.gebruikerId, gebruikerId),
      sql`SUBSTR(${screenTimeEntries.startTijd}, 1, 10) >= ${vanUtc}`,
      sql`SUBSTR(${screenTimeEntries.startTijd}, 1, 10) <= ${totUtc}`,
    ))
    .orderBy(asc(screenTimeEntries.startTijd))
    .all();

  // Group by NL local date, filtering out skip apps, entries outside range,
  // and entries NOT linked to any project (only company hours count for urencriterium)
  const dagMap = new Map<string, typeof entries>();
  for (const entry of entries) {
    if (SKIP_APPS.has(entry.app) || entry.categorie === "inactief") continue;
    // Only count entries linked to a project — all projects are Autronis work
    if (!entry.projectId) continue;
    const dag = nlDatum(entry.startTijd);
    if (dag < vanDatum || dag > totDatum) continue;
    if (!dagMap.has(dag)) dagMap.set(dag, []);
    dagMap.get(dag)!.push(entry);
  }

  let totaalSeconden = 0;
  let afleidingSeconden = 0;

  for (const dagEntries of dagMap.values()) {
    if (dagEntries.length === 0) continue;

    // Group into 30-min slots
    const firstTime = new Date(dagEntries[0].startTijd).getTime();
    const lastTime = new Date(dagEntries[dagEntries.length - 1].eindTijd).getTime();
    const slotStart = Math.floor(firstTime / SLOT_MS) * SLOT_MS;

    let t = slotStart;
    while (t < lastTime) {
      const tEnd = t + SLOT_MS;
      const slotEntries = dagEntries.filter(e => {
        const eTime = new Date(e.startTijd).getTime();
        return eTime >= t && eTime < tEnd;
      });

      if (slotEntries.length > 0) {
        const sessieStart = new Date(slotEntries[0].startTijd).getTime();
        const sessieEnd = new Date(slotEntries[slotEntries.length - 1].eindTijd).getTime();
        totaalSeconden += Math.max(0, (sessieEnd - sessieStart) / 1000);
      }

      t = tEnd;
    }

    // Sum distraction time for this day
    for (const entry of dagEntries) {
      if (entry.categorie === "afleiding") {
        afleidingSeconden += Math.max(0, (new Date(entry.eindTijd).getTime() - new Date(entry.startTijd).getTime()) / 1000);
      }
    }
  }

  // Company deep work = Autronis activity minus distraction
  const deepWorkSeconden = Math.max(0, totaalSeconden - afleidingSeconden);
  return Math.round((deepWorkSeconden / 3600) * 100) / 100;
}
