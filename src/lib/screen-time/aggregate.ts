import { db } from "@/lib/db";
import { screenTimeEntries } from "@/lib/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";

// ────────────────────────────────────────────────────────────────────────────
// Single source of truth voor periode-stats (week/maand) op de /tijd pagina,
// Discord weekrapport en alle andere consumers. Aggregeert raw entries uit
// screen_time_entries, cap op 16u per dag (= filter idle noise), zonder
// overlap / slot dubbeltelling zoals de sessies/route deed.
//
// Definities (Sem's mental model — matcht heatmap per-dag totalen):
//   actieve tijd     = alle entries waar de Mac registreerde dat Sem
//                      werkte/kijkt (INCL. "inactief" category entries,
//                      want die representeren tijd aan de laptop zonder
//                      duidelijke categorie — dus wél op te tellen).
//   productief %     = productief_sec / totaalActief_sec × 100
//   deep work        = max(0, totaalActief - afleiding - inactief)
//                      → puur werk, zonder afleiding en zonder ongespecificeerde tijd.
//   afleiding        = categorie "afleiding"
//   inactief         = categorie "inactief" (aan laptop, geen categorie)
//
// Deze definities zorgen dat heatmap per-dag totalen (som van dag.totaalActiefSeconden)
// EXACT matcht met de KPI "Actieve tijd" — non-negotiable requirement.
// ────────────────────────────────────────────────────────────────────────────

export const MAX_DAG_SECONDEN = 57600; // 16 uur
const PRODUCTIEF_CATEGORIEEN = new Set(["development", "design", "administratie", "finance", "communicatie", "meeting"]);

export interface PerDagAggregatie {
  datum: string;
  totaalActiefSeconden: number;
  productiefSeconden: number;
  afleidingSeconden: number;
  inactiefSeconden: number;
  deepWorkSeconden: number;
  deepWorkMinuten: number;
  productiefPercentage: number;
}

export interface PeriodeAggregatie {
  van: string;
  tot: string;
  dagen: number;
  totaalActiefSeconden: number;
  productiefSeconden: number;
  productiefPercentage: number;
  deepWorkSeconden: number;
  deepWorkMinuten: number;
  afleidingSeconden: number;
  inactiefSeconden: number;
  perDag: PerDagAggregatie[];
  topProject: string | null;
  perProject: Array<{ naam: string; seconden: number }>;
}

export interface AggregatieOpties {
  gebruikerId: number;
  van: string; // YYYY-MM-DD (inclusief)
  tot: string; // YYYY-MM-DD (inclusief)
}

interface RawEntry {
  categorie: string | null;
  duurSeconden: number;
  startTijd: string;
  eindTijd: string | null;
  projectNaam: string | null;
}

// Merge overlappende intervallen en tel de unieke "wall-clock" tijd.
// [{0,5},{3,10},{12,15}] → [{0,10},{12,15}] → 10+3 = 13 seconden.
// Dit is de bruto actieve-tijd-definitie (Sem's model): "tijd waarin je ergens
// achter je Mac was", niet netto-duur met overlap van parallel actieve apps.
function mergeIntervalsSeconden(ranges: Array<[number, number]>): number {
  if (ranges.length === 0) return 0;
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [curStart, curEnd] = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const [s, e] = sorted[i];
    if (s <= curEnd) {
      curEnd = Math.max(curEnd, e);
    } else {
      total += curEnd - curStart;
      curStart = s;
      curEnd = e;
    }
  }
  total += curEnd - curStart;
  return total;
}

// ────────────────────────────────────────────────────────────────────────────
// aggregeerPeriode
// ────────────────────────────────────────────────────────────────────────────
export async function aggregeerPeriode(
  opties: AggregatieOpties,
  rijenFetcher?: (o: AggregatieOpties) => Promise<RawEntry[]>,
): Promise<PeriodeAggregatie> {
  const rijen = rijenFetcher
    ? await rijenFetcher(opties)
    : await fetchEntries(opties);

  // Per-dag buckets met interval-lijsten (niet direct sommen) zodat we
  // later kunnen mergen. Overlap tussen parallelle entries (bijv. twee apps
  // tegelijk) wordt zo niet dubbel geteld.
  const perDagMap = new Map<string, {
    totaal: Array<[number, number]>;
    productief: Array<[number, number]>;
    afleiding: Array<[number, number]>;
    inactief: Array<[number, number]>;
  }>();
  const perProject = new Map<string, number>();
  const NL_TZ_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" });

  for (const e of rijen) {
    const startDate = new Date(e.startTijd);
    const dag = NL_TZ_FMT.format(startDate); // NL-local YYYY-MM-DD
    const startMs = startDate.getTime();
    const endMs = e.eindTijd
      ? new Date(e.eindTijd).getTime()
      : startMs + (e.duurSeconden ?? 0) * 1000;
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;
    const range: [number, number] = [Math.floor(startMs / 1000), Math.floor(endMs / 1000)];

    const bucket = perDagMap.get(dag) ?? {
      totaal: [], productief: [], afleiding: [], inactief: [],
    };
    bucket.totaal.push(range);
    if (e.categorie && PRODUCTIEF_CATEGORIEEN.has(e.categorie)) bucket.productief.push(range);
    if (e.categorie === "afleiding") bucket.afleiding.push(range);
    if (e.categorie === "inactief") bucket.inactief.push(range);
    perDagMap.set(dag, bucket);

    // Project-totaal: houd duurSeconden aan (merging per project is overkill
    // voor top-N ranking; bij benadering prima).
    if (e.projectNaam && e.categorie !== "inactief") {
      perProject.set(e.projectNaam, (perProject.get(e.projectNaam) ?? 0) + (e.duurSeconden ?? 0));
    }
  }

  // Cap per-dag op 16 uur (idle noise filter) — proportional reductie van alle
  // sub-totalen zodat invariant (productief + afleiding + inactief ≤ totaal) blijft gelden.
  const perDag: PerDagAggregatie[] = [];
  let totaalActief = 0;
  let productiefSec = 0;
  let afleidingSec = 0;
  let inactiefSec = 0;
  let deepWorkSec = 0;

  for (const [datum, bucket] of [...perDagMap.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    // Merge intervallen per categorie → bruto wall-clock seconden (geen overlap dubbeltelling).
    let dagTotaal = mergeIntervalsSeconden(bucket.totaal);
    let dagProductief = mergeIntervalsSeconden(bucket.productief);
    let dagAfleiding = mergeIntervalsSeconden(bucket.afleiding);
    let dagInactief = mergeIntervalsSeconden(bucket.inactief);
    if (dagTotaal > MAX_DAG_SECONDEN) {
      const ratio = MAX_DAG_SECONDEN / dagTotaal;
      dagProductief = Math.round(dagProductief * ratio);
      dagAfleiding = Math.round(dagAfleiding * ratio);
      dagInactief = Math.round(dagInactief * ratio);
      dagTotaal = MAX_DAG_SECONDEN;
    }

    // Deep work per dag: totaal - afleiding - inactief, nooit meer dan totaal
    const dagDeepWorkSec = Math.max(0, dagTotaal - dagAfleiding - dagInactief);
    const dagDeepWorkMin = Math.round(dagDeepWorkSec / 60);
    const dagProductiefPct = dagTotaal > 0 ? Math.round((dagProductief / dagTotaal) * 100) : 0;

    perDag.push({
      datum,
      totaalActiefSeconden: dagTotaal,
      productiefSeconden: dagProductief,
      afleidingSeconden: dagAfleiding,
      inactiefSeconden: dagInactief,
      deepWorkSeconden: dagDeepWorkSec,
      deepWorkMinuten: dagDeepWorkMin,
      productiefPercentage: dagProductiefPct,
    });

    totaalActief += dagTotaal;
    productiefSec += dagProductief;
    afleidingSec += dagAfleiding;
    inactiefSec += dagInactief;
    deepWorkSec += dagDeepWorkSec;
  }

  const productiefPercentage = totaalActief > 0 ? Math.round((productiefSec / totaalActief) * 100) : 0;
  const deepWorkMin = Math.round(deepWorkSec / 60);

  const perProjectArr = [...perProject.entries()]
    .map(([naam, seconden]) => ({ naam, seconden }))
    .sort((a, b) => b.seconden - a.seconden);
  const topProject = perProjectArr[0]?.naam ?? null;

  return {
    van: opties.van,
    tot: opties.tot,
    dagen: perDag.length,
    totaalActiefSeconden: totaalActief,
    productiefSeconden: productiefSec,
    productiefPercentage,
    deepWorkSeconden: deepWorkSec,
    deepWorkMinuten: deepWorkMin,
    afleidingSeconden: afleidingSec,
    inactiefSeconden: inactiefSec,
    perDag,
    topProject,
    perProject: perProjectArr,
  };
}

// Raw entries ophalen uit de database. Left join op projecten voor topProject.
// We widen UTC range met ±1 dag en filteren JS-side op NL-local datum,
// want entries rond middernacht NL vallen op een andere UTC datum.
// Zelfde pattern als /api/screen-time/sessies (regel 198-229).
async function fetchEntries(opties: AggregatieOpties): Promise<RawEntry[]> {
  const { projecten } = await import("@/lib/db/schema");

  // Widen UTC range ±1 dag
  const vanExp = new Date(opties.van); vanExp.setDate(vanExp.getDate() - 1);
  const totExp = new Date(opties.tot); totExp.setDate(totExp.getDate() + 1);
  const vanUtc = vanExp.toISOString().slice(0, 10);
  const totUtc = totExp.toISOString().slice(0, 10);

  const rows = await db
    .select({
      categorie: screenTimeEntries.categorie,
      duurSeconden: screenTimeEntries.duurSeconden,
      startTijd: screenTimeEntries.startTijd,
      eindTijd: screenTimeEntries.eindTijd,
      projectNaam: projecten.naam,
    })
    .from(screenTimeEntries)
    .leftJoin(projecten, eq(screenTimeEntries.projectId, projecten.id))
    .where(
      and(
        eq(screenTimeEntries.gebruikerId, opties.gebruikerId),
        sql`SUBSTR(${screenTimeEntries.startTijd}, 1, 10) >= ${vanUtc}`,
        sql`SUBSTR(${screenTimeEntries.startTijd}, 1, 10) <= ${totUtc}`,
      ),
    )
    .orderBy(asc(screenTimeEntries.startTijd))
    .all();

  // Filter JS-side op exacte NL-local datum-range, en voeg NL-datum als eigen
  // veld toe zodat per-dag bucketing correct op NL loopt. startTijd/eindTijd
  // blijven originele UTC strings — parseable als epoch timestamps.
  const NL_TZ_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" });
  return rows
    .filter((r) => {
      const nlDatum = NL_TZ_FMT.format(new Date(r.startTijd));
      return nlDatum >= opties.van && nlDatum <= opties.tot;
    });
}
