/**
 * Pakket-calculator voor Sales Engine mini-voorstellen.
 *
 * Bepaalt **scope** (welke kansen in welke tier komen) en levert een
 * conservatieve **besparing-range** als hypothese voor het intake gesprek.
 *
 * Wat het NIET doet: concrete investeringsbedragen of ROI berekenen. De
 * exacte prijs wordt nooit in de klant-PDF getoond — die wordt in een
 * gratis intake gesprek vastgesteld op basis van value-based pricing.
 * Zie scope-generator skill (~/.claude/skills/scope/SKILL.md) fase 4.
 *
 * Tiers:
 *   - Basis:      pilot scope (top 2 hoge-impact kansen)
 *   - Pro:        standaard scope (top 4 hoog + middel kansen)
 *   - Enterprise: volledig (alle kansen)
 */

// Conservatieve schatting parameters
const UURTARIEF_HANDMATIG_WERK = 40; // €/uur — backoffice tarief, niet €75-95 consultancy
const CONVERSIE_FACTOR = 0.4; // AI bespaart ~40% van manueel werk (was 60%, verder verlaagd)
const RANGE_SPREAD = 0.25; // ±25% spread voor de range (€X – €Y notatie)
const MAX_BESPARING = 60_000; // realisme cap voor MKB klanten — was 100k

export interface KansInput {
  titel: string;
  beschrijving: string;
  impact: string; // hoog | midden | laag
  geschatteTijdsbesparing: string | null;
  geschatteBesparing: string | null;
  prioriteit: number;
}

export type Tier = "basis" | "pro" | "enterprise";

export interface BesparingRange {
  laag: number;
  hoog: number;
}

export interface TierPakket {
  tier: Tier;
  naam: string;
  subtitle: string;
  scope: string;
  kansen: KansInput[];
  urenPerWeek: number;
  // Besparing als range (laag–hoog), niet als één hard getal
  besparingRange: BesparingRange;
  // Beschrijvende complexiteits-label voor in de PDF
  complexiteitLabel: string;
}

export interface PakketResult {
  basis: TierPakket;
  pro: TierPakket;
  enterprise: TierPakket;
}

function parseUrenPerWeek(text: string | null): number {
  if (!text) return 0;
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*uur/i);
  if (!match) return 0;
  return parseFloat(match[1].replace(",", "."));
}

function roundTo1k(n: number): number {
  return Math.round(n / 1000) * 1000;
}

function calcTier(opts: {
  tier: Tier;
  naam: string;
  subtitle: string;
  scope: string;
  complexiteitLabel: string;
  kansen: KansInput[];
}): TierPakket {
  const urenPerWeek = opts.kansen.reduce(
    (sum, k) => sum + parseUrenPerWeek(k.geschatteTijdsbesparing),
    0
  );

  // Conservatieve besparing schatting
  const rawBesparing = urenPerWeek * 52 * UURTARIEF_HANDMATIG_WERK * CONVERSIE_FACTOR;
  const cappedBesparing = Math.min(rawBesparing, MAX_BESPARING);

  // Range met ±25% spread, afgerond op €1k voor leesbaarheid
  const laag = roundTo1k(cappedBesparing * (1 - RANGE_SPREAD));
  const hoog = roundTo1k(cappedBesparing * (1 + RANGE_SPREAD));

  return {
    tier: opts.tier,
    naam: opts.naam,
    subtitle: opts.subtitle,
    scope: opts.scope,
    complexiteitLabel: opts.complexiteitLabel,
    kansen: opts.kansen,
    urenPerWeek,
    besparingRange: { laag, hoog },
  };
}

/**
 * Genereert drie pakket-varianten uit een lijst scan-kansen.
 *
 * - Basis: top 2 hoge-impact kansen (pilot insteek)
 * - Pro: top 4 kansen (hoog + middel, standaard offering)
 * - Enterprise: alle kansen (volledige rollout)
 */
export function berekenPakketten(kansen: KansInput[]): PakketResult {
  const sorted = [...kansen].sort((a, b) => a.prioriteit - b.prioriteit);
  const hoog = sorted.filter((k) => k.impact === "hoog");
  const hoogMiddel = sorted.filter(
    (k) => k.impact === "hoog" || k.impact === "midden"
  );

  const basis = calcTier({
    tier: "basis",
    naam: "Basis",
    subtitle: "Pilot · 1-2 quick wins",
    scope: "Eén workflow automatiseren als proof-of-concept. Perfect om te starten zonder grote investering.",
    complexiteitLabel: "Simpel",
    kansen: hoog.slice(0, 2),
  });

  const pro = calcTier({
    tier: "pro",
    naam: "Pro",
    subtitle: "Standaard · kernprocessen",
    scope: "De belangrijkste processen automatiseren met meerdere workflows en integraties. Onze meest gekozen optie.",
    complexiteitLabel: "Medium",
    kansen: hoogMiddel.slice(0, 4),
  });

  const enterprise = calcTier({
    tier: "enterprise",
    naam: "Enterprise",
    subtitle: "Volledig · end-to-end",
    scope: "Alle geïdentificeerde kansen aanpakken. AI agents, custom logic, dashboards en 6 maanden onderhoud.",
    complexiteitLabel: "Complex",
    kansen: sorted,
  });

  return { basis, pro, enterprise };
}

export function getTier(pakketten: PakketResult, tier: Tier): TierPakket {
  return pakketten[tier];
}

export function isValidTier(t: unknown): t is Tier {
  return t === "basis" || t === "pro" || t === "enterprise";
}
