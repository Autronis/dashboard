/**
 * Central config for Sales Engine calculations.
 *
 * Voor deze sessie zijn de waarden constant; later kunnen ze naar een
 * `app_config` DB-tabel zodat Sem/Syb ze in de UI kunnen tunen zonder deploy.
 * Één bron van waarheid betekent dat de overzichtspagina, detail page en PDF
 * presentatie niet meer uit elkaar kunnen lopen.
 */

/** Gemiddeld Autronis uurtarief gebruikt voor besparingsberekeningen. */
export const SALES_ENGINE_UURTARIEF = 95;

/**
 * Pipeline-waarde per scan op basis van de hoogste impact. Gebruikt op de
 * Sales Engine overzichtspagina om "waarde in pipeline" te schatten.
 */
export const SALES_ENGINE_PIPELINE_VALUE: Record<"hoog" | "midden" | "laag", number> = {
  hoog: 4000,
  midden: 1500,
  laag: 500,
};

/**
 * Staffel-investering voor een automatiseringspakket, afhankelijk van het
 * aantal geïdentificeerde automatiseringsuren per week. Gebruikt in de PDF
 * presentatie voor de ROI-berekening.
 */
export interface InvesteringTier {
  /** Minimum aantal uren/week waarop dit tier begint (exclusief). */
  minUrenPerWeek: number;
  /** Eenmalige investering voor dit tier (in hele euro's). */
  bedrag: number;
}

/** Gesorteerd van hoog naar laag — eerste match wint. */
export const SALES_ENGINE_INVESTERING_TIERS: InvesteringTier[] = [
  { minUrenPerWeek: 8, bedrag: 5000 },
  { minUrenPerWeek: 3, bedrag: 3000 },
  { minUrenPerWeek: 0, bedrag: 1500 },
];

/** Kies het juiste investeringsbedrag voor een gegeven aantal uren/week. */
export function investeringVoorUren(totaalUrenPerWeek: number): number {
  for (const tier of SALES_ENGINE_INVESTERING_TIERS) {
    if (totaalUrenPerWeek > tier.minUrenPerWeek) return tier.bedrag;
  }
  return SALES_ENGINE_INVESTERING_TIERS[SALES_ENGINE_INVESTERING_TIERS.length - 1].bedrag;
}

/** Pipeline-waarde voor een scan op basis van de hoogste impact; fallback = laag. */
export function pipelineValueVoorImpact(
  hoogsteImpact: string | null | undefined
): number {
  if (hoogsteImpact === "hoog") return SALES_ENGINE_PIPELINE_VALUE.hoog;
  if (hoogsteImpact === "midden") return SALES_ENGINE_PIPELINE_VALUE.midden;
  return SALES_ENGINE_PIPELINE_VALUE.laag;
}
