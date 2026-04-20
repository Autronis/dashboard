import { db } from "@/lib/db";
import { screenTimeEntries } from "@/lib/db/schema";
import { and, asc, eq, gte, lte } from "drizzle-orm";

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
  projectNaam: string | null;
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

  // Per-dag buckets. totaal = ALLES (incl inactief), productief/afleiding/inactief apart.
  const perDagMap = new Map<string, {
    totaal: number;
    productief: number;
    afleiding: number;
    inactief: number;
  }>();
  const perProject = new Map<string, number>();

  for (const e of rijen) {
    const dag = e.startTijd.substring(0, 10);
    const bucket = perDagMap.get(dag) ?? { totaal: 0, productief: 0, afleiding: 0, inactief: 0 };
    bucket.totaal += e.duurSeconden;
    if (e.categorie && PRODUCTIEF_CATEGORIEEN.has(e.categorie)) {
      bucket.productief += e.duurSeconden;
    }
    if (e.categorie === "afleiding") {
      bucket.afleiding += e.duurSeconden;
    }
    if (e.categorie === "inactief") {
      bucket.inactief += e.duurSeconden;
    }
    perDagMap.set(dag, bucket);

    // Project-totaal telt geen "inactief" — anders schreeuwt het top-project
    // met idle minuten die aan niks te koppelen zijn.
    if (e.projectNaam && e.categorie !== "inactief") {
      perProject.set(e.projectNaam, (perProject.get(e.projectNaam) ?? 0) + e.duurSeconden);
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
    let dagTotaal = bucket.totaal;
    let dagProductief = bucket.productief;
    let dagAfleiding = bucket.afleiding;
    let dagInactief = bucket.inactief;
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
async function fetchEntries(opties: AggregatieOpties): Promise<RawEntry[]> {
  const { projecten } = await import("@/lib/db/schema");

  return db
    .select({
      categorie: screenTimeEntries.categorie,
      duurSeconden: screenTimeEntries.duurSeconden,
      startTijd: screenTimeEntries.startTijd,
      projectNaam: projecten.naam,
    })
    .from(screenTimeEntries)
    .leftJoin(projecten, eq(screenTimeEntries.projectId, projecten.id))
    .where(
      and(
        eq(screenTimeEntries.gebruikerId, opties.gebruikerId),
        gte(screenTimeEntries.startTijd, `${opties.van}T00:00:00`),
        lte(screenTimeEntries.startTijd, `${opties.tot}T23:59:59`),
      ),
    )
    .orderBy(asc(screenTimeEntries.startTijd))
    .all();
}
