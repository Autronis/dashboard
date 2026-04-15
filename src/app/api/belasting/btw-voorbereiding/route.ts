import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { btwAangiftes, facturen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, sql, isNull } from "drizzle-orm";
import { getKostenRijen } from "@/lib/belasting-helpers";

// Known foreign suppliers — used to classify whether a bank_transactie
// counts as binnenlandse voorbelasting (btwBedrag → rubriek 5b) or as
// buitenlandse inkoop (no binnenlandse BTW aftrekbaar, wel reverse-charge
// rubriek 4a/4b). The Vision extractor can override this later by setting
// explicit country metadata, but for now we match on leverancier name.
const BUITEN_EU_LEVERANCIERS = [
  "anthropic", "aws", "amazon web services", "openai",
  "vercel", "google cloud", "microsoft azure", "stripe",
  "digitalocean", "cloudflare", "github", "notion",
  "figma", "slack", "zoom", "higgsfield", "fal",
];
const BINNEN_EU_LEVERANCIERS = [
  "google ireland", "google cloud emea", "zoho corporation", "turso",
];

function classificeerBuitenland(leverancier: string): "buiten_eu" | "binnen_eu" | null {
  const lower = leverancier.toLowerCase();
  if (BUITEN_EU_LEVERANCIERS.some((naam) => lower.includes(naam))) return "buiten_eu";
  if (BINNEN_EU_LEVERANCIERS.some((naam) => lower.includes(naam))) return "binnen_eu";
  return null;
}

function getQuarterDateRange(kwartaal: number, jaar: number): { start: string; end: string } {
  switch (kwartaal) {
    case 1: return { start: `${jaar}-01-01`, end: `${jaar}-03-31` };
    case 2: return { start: `${jaar}-04-01`, end: `${jaar}-06-30` };
    case 3: return { start: `${jaar}-07-01`, end: `${jaar}-09-30` };
    case 4: return { start: `${jaar}-10-01`, end: `${jaar}-12-31` };
    default: return { start: `${jaar}-01-01`, end: `${jaar}-12-31` };
  }
}

// POST /api/belasting/btw-voorbereiding
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();
    const kwartaal = Number(body.kwartaal);
    const jaar = Number(body.jaar);

    if (!kwartaal || kwartaal < 1 || kwartaal > 4 || !jaar) {
      return NextResponse.json({ fout: "Ongeldig kwartaal of jaar" }, { status: 400 });
    }

    const { start, end } = getQuarterDateRange(kwartaal, jaar);

    // Rubriek 1a: Omzet binnenland 21%
    const r1a = await db.select({
      omzet: sql<number>`COALESCE(SUM(${facturen.bedragExclBtw}), 0)`,
      btw: sql<number>`COALESCE(SUM(${facturen.btwBedrag}), 0)`,
    }).from(facturen).where(and(
      eq(facturen.status, "betaald"),
      eq(facturen.isActief, 1),
      eq(facturen.btwPercentage, 21),
      gte(facturen.factuurdatum, start),
      lte(facturen.factuurdatum, end),
      isNull(facturen.verwerktInAangifte),
    )).get();

    // Rubriek 1b: Omzet binnenland 9%
    const r1b = await db.select({
      omzet: sql<number>`COALESCE(SUM(${facturen.bedragExclBtw}), 0)`,
      btw: sql<number>`COALESCE(SUM(${facturen.btwBedrag}), 0)`,
    }).from(facturen).where(and(
      eq(facturen.status, "betaald"),
      eq(facturen.isActief, 1),
      eq(facturen.btwPercentage, 9),
      gte(facturen.factuurdatum, start),
      lte(facturen.factuurdatum, end),
      isNull(facturen.verwerktInAangifte),
    )).get();

    // Get all bank_transacties in quarter for rubriek 4 + 5b. We read from
    // bank_transacties (the canonical cost source) and classify suppliers
    // as buiten-EU / binnen-EU / binnenland based on leverancier name.
    const alleKosten = await getKostenRijen(start, end);

    let r4aOmzet = 0;
    let r4bOmzet = 0;
    let voorbelasting = 0;

    for (const u of alleKosten) {
      const exclBtw = u.bedrag - u.btwBedrag;
      const buitenland = classificeerBuitenland(u.leverancier);
      if (buitenland === "buiten_eu") {
        r4aOmzet += exclBtw;
      } else if (buitenland === "binnen_eu") {
        r4bOmzet += exclBtw;
      } else {
        // Binnenland — btw_bedrag is voorbelasting
        voorbelasting += u.btwBedrag;
      }
    }

    const r4aBtw = Math.round(r4aOmzet * 0.21 * 100) / 100;
    const r4bBtw = Math.round(r4bOmzet * 0.21 * 100) / 100;

    const rubriek1aOmzet = Math.round((r1a?.omzet ?? 0) * 100) / 100;
    const rubriek1aBtw = Math.round((r1a?.btw ?? 0) * 100) / 100;
    const rubriek1bOmzet = Math.round((r1b?.omzet ?? 0) * 100) / 100;
    const rubriek1bBtw = Math.round((r1b?.btw ?? 0) * 100) / 100;
    const rubriek4aOmzet = Math.round(r4aOmzet * 100) / 100;
    const rubriek4aBtw = r4aBtw;
    const rubriek4bOmzet = Math.round(r4bOmzet * 100) / 100;
    const rubriek4bBtw = r4bBtw;

    // 5a: totaal verschuldigde BTW
    const rubriek5aBtw = Math.round((rubriek1aBtw + rubriek1bBtw + rubriek4aBtw + rubriek4bBtw) * 100) / 100;

    // 5b: voorbelasting (binnenlandse BTW + verlegde BTW die je terugkrijgt)
    const rubriek5bBtw = Math.round((voorbelasting + rubriek4aBtw + rubriek4bBtw) * 100) / 100;

    // Saldo: positief = betalen, negatief = terugkrijgen
    const saldo = Math.round((rubriek5aBtw - rubriek5bBtw) * 100) / 100;

    // Check for existing aangifte
    const bestaand = await db.select().from(btwAangiftes).where(and(
      eq(btwAangiftes.kwartaal, kwartaal),
      eq(btwAangiftes.jaar, jaar),
    )).get();

    return NextResponse.json({
      rubrieken: {
        rubriek_1a: { omzet: rubriek1aOmzet, btw: rubriek1aBtw },
        rubriek_1b: { omzet: rubriek1bOmzet, btw: rubriek1bBtw },
        rubriek_4a: { omzet: rubriek4aOmzet, btw: rubriek4aBtw },
        rubriek_4b: { omzet: rubriek4bOmzet, btw: rubriek4bBtw },
        rubriek_5a: { btw: rubriek5aBtw },
        rubriek_5b: { btw: rubriek5bBtw },
      },
      saldo,
      kwartaal,
      jaar,
      bestaandeAangifte: bestaand ? {
        id: bestaand.id,
        status: bestaand.status,
        betalingskenmerk: bestaand.betalingskenmerk,
        ingediendOp: bestaand.ingediendOp,
      } : null,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
