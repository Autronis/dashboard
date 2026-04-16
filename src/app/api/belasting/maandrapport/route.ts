import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bankTransacties, inkomendeFacturen, verdeelRegels, openstaandeVerrekeningen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, sql, or, isNull, ne } from "drizzle-orm";
import { BORG_CONFIG } from "@/lib/borg-config";
import { VERMOGEN_CATEGORIE } from "@/lib/vermogensstorting";
import { schatBtwBedrag } from "@/lib/leverancier-land";

interface RapportItem {
  id: number;
  bron: "bankTransacties" | "uitgaven";
  datum: string;
  omschrijving: string;
  categorie: string | null;
  bankNaam: string | null;
  bedragInclBtw: number;
  btwBedrag: number | null;
  eigenaar: string | null;
  splitRatio: string | null;
}

function parseSplitRatio(ratio: string): [number, number] {
  const parts = ratio.split("/").map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return [parts[0] / 100, parts[1] / 100];
  }
  return [0.5, 0.5];
}

function applyVerdeelRegels(
  item: RapportItem,
  regels: { type: string; waarde: string; eigenaar: string; splitRatio: string }[]
): RapportItem {
  if (item.eigenaar) return item;

  // Match leverancier first
  const leverancierMatch = regels.find(
    (r) => r.type === "leverancier" && item.omschrijving.toLowerCase().includes(r.waarde.toLowerCase())
  );
  if (leverancierMatch) {
    return { ...item, eigenaar: leverancierMatch.eigenaar, splitRatio: leverancierMatch.splitRatio };
  }

  // Then match categorie
  const categorieMatch = regels.find(
    (r) => r.type === "categorie" && item.categorie?.toLowerCase() === r.waarde.toLowerCase()
  );
  if (categorieMatch) {
    return { ...item, eigenaar: categorieMatch.eigenaar, splitRatio: categorieMatch.splitRatio };
  }

  return item;
}

function berekenBtwSplit(items: RapportItem[]): {
  sem: { items: { omschrijving: string; bedrag: number }[]; totaal: number };
  syb: { items: { omschrijving: string; bedrag: number }[]; totaal: number };
} {
  const sem: { omschrijving: string; bedrag: number }[] = [];
  const syb: { omschrijving: string; bedrag: number }[] = [];

  for (const item of items) {
    const btw = item.btwBedrag ?? 0;
    if (btw === 0) continue;

    if (item.eigenaar === "sem") {
      sem.push({ omschrijving: item.omschrijving, bedrag: btw });
    } else if (item.eigenaar === "syb") {
      syb.push({ omschrijving: item.omschrijving, bedrag: btw });
    } else if (item.eigenaar === "gedeeld" && item.splitRatio) {
      const [semPct, sybPct] = parseSplitRatio(item.splitRatio);
      const semBtw = Math.round(btw * semPct * 100) / 100;
      const sybBtw = Math.round(btw * sybPct * 100) / 100;
      if (semBtw > 0) sem.push({ omschrijving: `${item.omschrijving} (${Math.round(semPct * 100)}%)`, bedrag: semBtw });
      if (sybBtw > 0) syb.push({ omschrijving: `${item.omschrijving} (${Math.round(sybPct * 100)}%)`, bedrag: sybBtw });
    } else {
      // Untagged: default to sem
      sem.push({ omschrijving: item.omschrijving, bedrag: btw });
    }
  }

  return {
    sem: { items: sem, totaal: Math.round(sem.reduce((s, i) => s + i.bedrag, 0) * 100) / 100 },
    syb: { items: syb, totaal: Math.round(syb.reduce((s, i) => s + i.bedrag, 0) * 100) / 100 },
  };
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const maandParam = searchParams.get("maand");

    if (!maandParam || !/^\d{4}-\d{2}$/.test(maandParam)) {
      return NextResponse.json({ fout: "Maand parameter vereist in YYYY-MM formaat" }, { status: 400 });
    }

    const [jaar, maandNr] = maandParam.split("-").map(Number);
    const maandStart = `${maandParam}-01`;
    const lastDay = new Date(jaar, maandNr, 0).getDate();
    const maandEind = `${maandParam}-${String(lastDay).padStart(2, "0")}`;

    // Fetch bank transactions for the month (type = "af" = expenses).
    // Consistent met /api/belasting/winst-verlies en /api/financien/btw-kwartaal:
    // - prive uitgaven uitsluiten (fiscaalType = 'prive')
    // - vermogensstortingen uitsluiten (categorie = VERMOGEN_CATEGORIE)
    // - tx gekoppeld aan een inkomende factuur die al verwerkt is in een
    //   eerdere BTW-aangifte uitsluiten (anders double-count)
    const transacties = await db
      .select()
      .from(bankTransacties)
      .where(and(
        eq(bankTransacties.type, "af"),
        gte(bankTransacties.datum, maandStart),
        lte(bankTransacties.datum, maandEind),
        or(isNull(bankTransacties.fiscaalType), ne(bankTransacties.fiscaalType, "prive")),
        or(isNull(bankTransacties.categorie), ne(bankTransacties.categorie, VERMOGEN_CATEGORIE)),
        sql`NOT EXISTS (SELECT 1 FROM ${inkomendeFacturen} WHERE ${inkomendeFacturen.bankTransactieId} = ${bankTransacties.id} AND ${inkomendeFacturen.verwerktInAangifte} IS NOT NULL)`,
      ))
      .orderBy(bankTransacties.datum);

    // Fetch verdeelregels
    const regels = await db.select().from(verdeelRegels);

    function schatBtw(bedrag: number, omschrijving: string): number | null {
      const est = schatBtwBedrag(bedrag, omschrijving);
      return est === 0 ? null : est;
    }

    // Unified list uit bank_transacties (de `uitgaven` tabel is deprecated
    // en wordt niet meer gevuld). Vermogensstortingen zijn al type=bij dus
    // worden hier vanzelf uitgesloten.
    let items: RapportItem[] = transacties.map((t) => ({
      id: t.id,
      bron: "bankTransacties" as const,
      datum: t.datum,
      omschrijving: t.merchantNaam || t.omschrijving,
      categorie: t.categorie,
      bankNaam: t.bank,
      bedragInclBtw: Math.abs(t.bedrag),
      btwBedrag: t.btwBedrag ?? schatBtw(t.bedrag, t.merchantNaam || t.omschrijving),
      eigenaar: t.eigenaar,
      splitRatio: t.splitRatio,
    }));

    // Apply verdeelregels to untagged items
    items = items.map((item) => applyVerdeelRegels(item, regels));

    // Sort by date
    items.sort((a, b) => a.datum.localeCompare(b.datum));

    // Calculate totals
    const totaalUitgaven = Math.round(items.reduce((s, i) => s + i.bedragInclBtw, 0) * 100) / 100;
    const totaalBtw = Math.round(items.reduce((s, i) => s + (i.btwBedrag ?? 0), 0) * 100) / 100;

    // BTW split
    const btwSplit = berekenBtwSplit(items);

    // Fetch verrekeningen (onbetaald)
    const verrekeningen = await db
      .select()
      .from(openstaandeVerrekeningen)
      .where(eq(openstaandeVerrekeningen.betaald, 0));

    const totaalVerrekening = Math.round(
      verrekeningen.reduce((s, v) => s + v.bedrag, 0) * 100
    ) / 100;

    // Trend: last 6 months
    const trend: { maand: string; uitgaven: number; btw: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const trendDate = new Date(jaar, maandNr - 1 - i, 1);
      const trendMaand = `${trendDate.getFullYear()}-${String(trendDate.getMonth() + 1).padStart(2, "0")}`;
      const trendStart = `${trendMaand}-01`;
      const trendLastDay = new Date(trendDate.getFullYear(), trendDate.getMonth() + 1, 0).getDate();
      const trendEind = `${trendMaand}-${String(trendLastDay).padStart(2, "0")}`;

      const trendResult = await db
        .select({
          totaalUitgaven: sql<number>`COALESCE(SUM(ABS(${bankTransacties.bedrag})), 0)`,
          totaalBtw: sql<number>`COALESCE(SUM(${bankTransacties.btwBedrag}), 0)`,
        })
        .from(bankTransacties)
        .where(and(
          eq(bankTransacties.type, "af"),
          gte(bankTransacties.datum, trendStart),
          lte(bankTransacties.datum, trendEind),
        ))
        .get();

      trend.push({
        maand: trendMaand,
        uitgaven: Math.round((trendResult?.totaalUitgaven ?? 0) * 100) / 100,
        btw: Math.round((trendResult?.totaalBtw ?? 0) * 100) / 100,
      });
    }

    return NextResponse.json({
      maandrapport: {
        maand: maandParam,
        uitgaven: items,
        totaalUitgaven,
        totaalBtw,
        btwSplit,
        verrekeningen: verrekeningen.map((v) => ({
          id: v.id,
          omschrijving: v.omschrijving,
          bedrag: v.bedrag,
          betaald: v.betaald === 1,
          vanGebruikerId: v.vanGebruikerId,
          naarGebruikerId: v.naarGebruikerId,
        })),
        totaalVerrekening,
        totaalTerug: Math.round((totaalBtw + totaalVerrekening) * 100) / 100,
        trend,
        borg: BORG_CONFIG,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
