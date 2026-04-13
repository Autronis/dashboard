import { db } from "@/lib/db";
import { screenTimeEntries, klanten, projecten } from "@/lib/db/schema";
import { eq, and, sql, asc } from "drizzle-orm";

const SKIP_APPS = new Set(["LockApp", "SearchHost", "ShellHost", "ShellExperienceHost", "Inactief"]);
const PRODUCTIEF_CATS = new Set(["development", "design", "administratie", "finance", "communicatie"]);
// Billable = klant-werk. administratie en finance zijn intern (non-billable).
const BILLABLE_CATS = new Set(["development", "design", "communicatie"]);
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

  // Group by NL local date. Only count productive categories (Autronis deep work).
  // Non-productive activity (entertainment, social, afleiding, etc.) is excluded —
  // if it's clearly not Autronis work, it doesn't count.
  const dagMap = new Map<string, typeof entries>();
  for (const entry of entries) {
    if (SKIP_APPS.has(entry.app) || entry.categorie === "inactief") continue;
    if (!entry.categorie || !PRODUCTIEF_CATS.has(entry.categorie)) continue;
    const dag = nlDatum(entry.startTijd);
    if (dag < vanDatum || dag > totDatum) continue;
    if (!dagMap.has(dag)) dagMap.set(dag, []);
    dagMap.get(dag)!.push(entry);
  }

  let totaalSeconden = 0;

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
  }

  // Deep work = productive Autronis activity only (non-productive already filtered out)
  return Math.round((totaalSeconden / 3600) * 100) / 100;
}

// ─── Aggregation helpers (raw productive seconds, not slot-merged) ──────────
//
// These helpers sum raw productive screen-time seconds grouped by some key
// (project, client, day). They DON'T use the 30-min slot-merging logic that
// `berekenActieveUren` uses for "deep work" totals, because slot merging is
// inherently per-user-per-day and can't be sub-aggregated by project/client
// without losing accuracy. The numbers are close but not identical to
// `berekenActieveUren` — slot-merging includes small gaps within a session
// while raw seconds only counts active entries.
//
// Use `berekenActieveUren` for "X hours worked this week" totals.
// Use these helpers for "X hours per project / per client / per day" splits.

interface ProductiefEntry {
  projectId: number | null;
  klantId: number | null;
  startTijd: string;
  duurSeconden: number;
}

async function fetchProductieveEntries(
  vanDatum: string,
  totDatum: string,
  opts: { gebruikerId?: number } = {}
): Promise<ProductiefEntry[]> {
  // Expand UTC range by ±1 day to capture entries near midnight that belong
  // to the right NL local date but fall on a different UTC date.
  const vanExpanded = new Date(vanDatum);
  vanExpanded.setDate(vanExpanded.getDate() - 1);
  const totExpanded = new Date(totDatum);
  totExpanded.setDate(totExpanded.getDate() + 1);
  const vanUtc = vanExpanded.toISOString().slice(0, 10);
  const totUtc = totExpanded.toISOString().slice(0, 10);

  const conditions = [
    sql`SUBSTR(${screenTimeEntries.startTijd}, 1, 10) >= ${vanUtc}`,
    sql`SUBSTR(${screenTimeEntries.startTijd}, 1, 10) <= ${totUtc}`,
  ];
  if (opts.gebruikerId !== undefined) {
    conditions.push(eq(screenTimeEntries.gebruikerId, opts.gebruikerId));
  }

  const rows = await db
    .select({
      projectId: screenTimeEntries.projectId,
      klantId: screenTimeEntries.klantId,
      app: screenTimeEntries.app,
      categorie: screenTimeEntries.categorie,
      startTijd: screenTimeEntries.startTijd,
      duurSeconden: screenTimeEntries.duurSeconden,
    })
    .from(screenTimeEntries)
    .where(and(...conditions))
    .all();

  return rows
    .filter((r) => {
      if (SKIP_APPS.has(r.app) || r.categorie === "inactief") return false;
      if (!r.categorie || !PRODUCTIEF_CATS.has(r.categorie)) return false;
      const dag = nlDatum(r.startTijd);
      return dag >= vanDatum && dag <= totDatum;
    })
    .map((r) => ({
      projectId: r.projectId,
      klantId: r.klantId ?? null,
      startTijd: r.startTijd,
      duurSeconden: r.duurSeconden,
    }));
}

/** Productive hours per project across all users in date range. */
export async function berekenUrenPerProject(
  vanDatum: string,
  totDatum: string
): Promise<Map<number, number>> {
  const entries = await fetchProductieveEntries(vanDatum, totDatum);
  const map = new Map<number, number>();
  for (const e of entries) {
    if (!e.projectId) continue;
    map.set(e.projectId, (map.get(e.projectId) ?? 0) + e.duurSeconden / 3600);
  }
  return map;
}

/** Productive hours per client across all users in date range.
 *  Resolves klantId either directly from the entry or via project link. */
export async function berekenUrenPerKlant(
  vanDatum: string,
  totDatum: string
): Promise<Map<number, number>> {
  const expanded = new Date(vanDatum); expanded.setDate(expanded.getDate() - 1);
  const expandedTot = new Date(totDatum); expandedTot.setDate(expandedTot.getDate() + 1);
  const vanUtc = expanded.toISOString().slice(0, 10);
  const totUtc = expandedTot.toISOString().slice(0, 10);

  const rows = await db
    .select({
      klantIdResolved: sql<number | null>`COALESCE(${screenTimeEntries.klantId}, ${projecten.klantId})`.as("klantIdResolved"),
      app: screenTimeEntries.app,
      categorie: screenTimeEntries.categorie,
      startTijd: screenTimeEntries.startTijd,
      duurSeconden: screenTimeEntries.duurSeconden,
    })
    .from(screenTimeEntries)
    .leftJoin(projecten, eq(screenTimeEntries.projectId, projecten.id))
    .where(and(
      sql`SUBSTR(${screenTimeEntries.startTijd}, 1, 10) >= ${vanUtc}`,
      sql`SUBSTR(${screenTimeEntries.startTijd}, 1, 10) <= ${totUtc}`,
    ))
    .all();

  const map = new Map<number, number>();
  for (const r of rows) {
    if (!r.klantIdResolved) continue;
    if (SKIP_APPS.has(r.app) || r.categorie === "inactief") continue;
    if (!r.categorie || !PRODUCTIEF_CATS.has(r.categorie)) continue;
    const dag = nlDatum(r.startTijd);
    if (dag < vanDatum || dag > totDatum) continue;
    map.set(r.klantIdResolved, (map.get(r.klantIdResolved) ?? 0) + r.duurSeconden / 3600);
  }
  return map;
}

/** Total revenue from productive screen-time × klant.uurtarief in date range.
 *  Optionally filter by user. */
export async function berekenOmzet(
  vanDatum: string,
  totDatum: string,
  opts: { gebruikerId?: number } = {}
): Promise<number> {
  const expanded = new Date(vanDatum); expanded.setDate(expanded.getDate() - 1);
  const expandedTot = new Date(totDatum); expandedTot.setDate(expandedTot.getDate() + 1);
  const vanUtc = expanded.toISOString().slice(0, 10);
  const totUtc = expandedTot.toISOString().slice(0, 10);

  const conditions = [
    sql`SUBSTR(${screenTimeEntries.startTijd}, 1, 10) >= ${vanUtc}`,
    sql`SUBSTR(${screenTimeEntries.startTijd}, 1, 10) <= ${totUtc}`,
    sql`${klanten.id} IS NOT NULL`,
  ];
  if (opts.gebruikerId !== undefined) {
    conditions.push(eq(screenTimeEntries.gebruikerId, opts.gebruikerId));
  }

  const rows = await db
    .select({
      app: screenTimeEntries.app,
      categorie: screenTimeEntries.categorie,
      startTijd: screenTimeEntries.startTijd,
      duurSeconden: screenTimeEntries.duurSeconden,
      uurtarief: klanten.uurtarief,
      isDemo: klanten.isDemo,
    })
    .from(screenTimeEntries)
    .leftJoin(projecten, eq(screenTimeEntries.projectId, projecten.id))
    .leftJoin(
      klanten,
      sql`${klanten.id} = COALESCE(${screenTimeEntries.klantId}, ${projecten.klantId})`
    )
    .where(and(...conditions))
    .all();

  let omzet = 0;
  for (const r of rows) {
    if (SKIP_APPS.has(r.app) || r.categorie === "inactief") continue;
    if (!r.categorie || !PRODUCTIEF_CATS.has(r.categorie)) continue;
    if (r.isDemo === 1) continue;
    const dag = nlDatum(r.startTijd);
    if (dag < vanDatum || dag > totDatum) continue;
    omzet += (r.duurSeconden / 3600) * (r.uurtarief ?? 0);
  }
  return Math.round(omzet * 100) / 100;
}

/** Hours per NL local date for one user in date range (raw productive seconds). */
export async function berekenUrenPerDag(
  gebruikerId: number,
  vanDatum: string,
  totDatum: string
): Promise<Map<string, number>> {
  const entries = await fetchProductieveEntries(vanDatum, totDatum, { gebruikerId });
  const map = new Map<string, number>();
  for (const e of entries) {
    const dag = nlDatum(e.startTijd);
    map.set(dag, (map.get(dag) ?? 0) + e.duurSeconden / 3600);
  }
  return map;
}

/** Billable vs non-billable productive hours for one user in date range.
 *  Billable = development/design/communicatie (klant-werk).
 *  Non-billable = administratie/finance (intern). */
export async function berekenBillable(
  gebruikerId: number,
  vanDatum: string,
  totDatum: string
): Promise<{ billableUren: number; nonBillableUren: number; totaleUren: number }> {
  const expanded = new Date(vanDatum); expanded.setDate(expanded.getDate() - 1);
  const expandedTot = new Date(totDatum); expandedTot.setDate(expandedTot.getDate() + 1);
  const vanUtc = expanded.toISOString().slice(0, 10);
  const totUtc = expandedTot.toISOString().slice(0, 10);

  const rows = await db
    .select({
      app: screenTimeEntries.app,
      categorie: screenTimeEntries.categorie,
      startTijd: screenTimeEntries.startTijd,
      duurSeconden: screenTimeEntries.duurSeconden,
    })
    .from(screenTimeEntries)
    .where(and(
      eq(screenTimeEntries.gebruikerId, gebruikerId),
      sql`SUBSTR(${screenTimeEntries.startTijd}, 1, 10) >= ${vanUtc}`,
      sql`SUBSTR(${screenTimeEntries.startTijd}, 1, 10) <= ${totUtc}`,
    ))
    .all();

  let billableSec = 0;
  let nonBillableSec = 0;
  for (const r of rows) {
    if (SKIP_APPS.has(r.app) || r.categorie === "inactief") continue;
    if (!r.categorie || !PRODUCTIEF_CATS.has(r.categorie)) continue;
    const dag = nlDatum(r.startTijd);
    if (dag < vanDatum || dag > totDatum) continue;
    if (BILLABLE_CATS.has(r.categorie)) {
      billableSec += r.duurSeconden;
    } else {
      nonBillableSec += r.duurSeconden;
    }
  }

  return {
    billableUren: Math.round((billableSec / 3600) * 100) / 100,
    nonBillableUren: Math.round((nonBillableSec / 3600) * 100) / 100,
    totaleUren: Math.round(((billableSec + nonBillableSec) / 3600) * 100) / 100,
  };
}
