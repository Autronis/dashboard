/**
 * Pakket-calculator voor Sales Engine mini-voorstellen.
 *
 * Genereert drie tiers (Basis / Pro / Enterprise) volgens de scope-generator
 * skill richtlijnen (~/.claude/skills/scope/SKILL.md fase 4):
 *
 *   - Simpel (1 workflow, 2-3 stappen):    €1.500 – €3.000   → Basis
 *   - Medium (meerdere workflows):          €3.000 – €8.000   → Pro
 *   - Complex (AI agents, custom):          €8.000 – €25.000  → Enterprise
 *
 *   Regel: "de prijs moet maximaal 30-50% van de jaarlijkse besparing zijn
 *   zodat de ROI overtuigend is"
 *
 * De skill rekent value-based: niet uurtje-factuurtje, maar op geschatte
 * jaarlijkse besparing × conversie-factor. Hieronder conservatieve defaults
 * die realistisch klinken voor MKB klanten zonder overdreven beloftes.
 */

const UURTARIEF_HANDMATIG_WERK = 50; // €/uur — backoffice tarief, niet €75-95 consultancy
const CONVERSIE_FACTOR = 0.6;        // AI bespaart ~60% van manueel werk, geen 100%
const PRICE_PCT_VAN_BESPARING = 0.35; // prijs = 35% van jaarlijkse besparing (skill: 30-50%)

export interface KansInput {
  titel: string;
  beschrijving: string;
  impact: string; // hoog | midden | laag
  geschatteTijdsbesparing: string | null;
  geschatteBesparing: string | null;
  prioriteit: number;
}

export type Tier = "basis" | "pro" | "enterprise";

export interface TierPakket {
  tier: Tier;
  naam: string;
  subtitle: string;
  scope: string;
  kansen: KansInput[];
  urenPerWeek: number;
  jaarlijkseBesparing: number;
  investering: number;
  terugverdientijdMaanden: number;
  minPrijs: number;
  maxPrijs: number;
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

function roundTo500(n: number): number {
  return Math.round(n / 500) * 500;
}

function calcTier(opts: {
  tier: Tier;
  naam: string;
  subtitle: string;
  scope: string;
  kansen: KansInput[];
  minPrijs: number;
  maxPrijs: number;
}): TierPakket {
  const urenPerWeek = opts.kansen.reduce(
    (sum, k) => sum + parseUrenPerWeek(k.geschatteTijdsbesparing),
    0
  );
  const rawBesparing = urenPerWeek * 52 * UURTARIEF_HANDMATIG_WERK * CONVERSIE_FACTOR;
  // Cap besparing op €100k/jaar — realisme voor MKB klanten
  const jaarlijkseBesparing = Math.round(Math.min(rawBesparing, 100_000));

  // Prijs = 35% van jaarlijkse besparing, gecapt binnen de tier range
  let investering = roundTo500(jaarlijkseBesparing * PRICE_PCT_VAN_BESPARING);
  if (investering < opts.minPrijs) investering = opts.minPrijs;
  if (investering > opts.maxPrijs) investering = opts.maxPrijs;

  const terugverdientijdMaanden =
    jaarlijkseBesparing > 0
      ? Math.max(1, Math.ceil((investering / jaarlijkseBesparing) * 12))
      : 0;

  return {
    tier: opts.tier,
    naam: opts.naam,
    subtitle: opts.subtitle,
    scope: opts.scope,
    kansen: opts.kansen,
    urenPerWeek,
    jaarlijkseBesparing,
    investering,
    terugverdientijdMaanden,
    minPrijs: opts.minPrijs,
    maxPrijs: opts.maxPrijs,
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
    kansen: hoog.slice(0, 2),
    minPrijs: 1500,
    maxPrijs: 3000,
  });

  const pro = calcTier({
    tier: "pro",
    naam: "Pro",
    subtitle: "Standaard · kernprocessen",
    scope: "De belangrijkste processen automatiseren met meerdere workflows en integraties. Onze meest gekozen optie.",
    kansen: hoogMiddel.slice(0, 4),
    minPrijs: 3000,
    maxPrijs: 8000,
  });

  const enterprise = calcTier({
    tier: "enterprise",
    naam: "Enterprise",
    subtitle: "Volledig · end-to-end",
    scope: "Alle geïdentificeerde kansen aanpakken. AI agents, custom logic, dashboards en 6 maanden onderhoud.",
    kansen: sorted,
    minPrijs: 8000,
    maxPrijs: 25000,
  });

  return { basis, pro, enterprise };
}

export function getTier(pakketten: PakketResult, tier: Tier): TierPakket {
  return pakketten[tier];
}

export function isValidTier(t: unknown): t is Tier {
  return t === "basis" || t === "pro" || t === "enterprise";
}
