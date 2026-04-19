import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bankTransacties } from "@/lib/db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";

const anthropic = Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }, "/api/bank/transacties/analyse");

interface TransactieContext {
  id: number;
  datum: string;
  omschrijving: string;
  bedrag: number;
  type: string;
  merchantNaam: string | null;
  merchantCategorie: string | null;
  aantalKeerGezien: number;
  gemiddeldBedrag: number;
}

interface AnalyseResult {
  aiBeschrijving: string;
  isAbonnement: boolean;
  overdodigheidScore: "noodzakelijk" | "nuttig" | "overbodig";
  fiscaalType: "investering" | "kosten" | "prive";
  subsidieMogelijkheden: string[];
  btwBedrag: number;
  kiaAftrek: number;
}

// KIA 2026 staffel
function berekenKIA(bedrag: number): number {
  if (bedrag < 2801 || bedrag > 69764) return 0;
  // Vereenvoudigd: ~28% aftrek
  return Math.round(bedrag * 0.28);
}

async function analyseTransactie(tx: TransactieContext): Promise<AnalyseResult> {
  const prompt = `Analyseer deze banktransactie voor een klein AI-bureau (Autronis). Geef:

1. beschrijving: Korte NL beschrijving (max 1 zin) — wat is het, waarvoor
2. isAbonnement: true/false (merchant komt ${tx.aantalKeerGezien}x voor, gem €${tx.gemiddeldBedrag.toFixed(2)})
3. score: noodzakelijk/nuttig/overbodig voor een AI-bureau
4. fiscaalType: "investering" (hardware, software, apparatuur > €450), "kosten" (operationele uitgaven), of "prive" (persoonlijk)
5. subsidieMogelijkheden: array van regelingen waarvoor dit mogelijk in aanmerking komt:
   - "WBSO" — als het R&D/innovatie betreft (software development, AI research)
   - "MIA" — milieu-investeringen
   - "VAMIL" — willekeurige afschrijving milieu-investeringen
   - "EIA" — energie-investeringen
   - [] als geen van toepassing

Transactie:
- Merchant: ${tx.merchantNaam || tx.omschrijving}
- Categorie: ${tx.merchantCategorie || "onbekend"}
- Bedrag: €${tx.bedrag.toFixed(2)}
- Type: ${tx.type === "af" ? "uitgave" : "inkomst"}
- Datum: ${tx.datum}
- Frequentie: ${tx.aantalKeerGezien}x in 90 dagen

Context: Autronis is een AI- en automatiseringsbureau (ZZP/VOF). Zakelijke tools/hosting/AI = noodzakelijk.

Antwoord ALLEEN als JSON:
{
  "beschrijving": "...",
  "isAbonnement": true/false,
  "score": "noodzakelijk"|"nuttig"|"overbodig",
  "fiscaalType": "investering"|"kosten"|"prive",
  "subsidieMogelijkheden": ["WBSO"] of []
}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      aiBeschrijving: "",
      isAbonnement: false,
      overdodigheidScore: "nuttig",
      fiscaalType: "kosten",
      subsidieMogelijkheden: [],
      btwBedrag: 0,
      kiaAftrek: 0,
    };
  }

  const result = JSON.parse(jsonMatch[0]) as {
    beschrijving: string;
    isAbonnement: boolean;
    score: "noodzakelijk" | "nuttig" | "overbodig";
    fiscaalType: "investering" | "kosten" | "prive";
    subsidieMogelijkheden: string[];
  };

  // Calculate BTW (21% standard, reverse calculation from incl.)
  const btwBedrag = result.fiscaalType !== "prive"
    ? Math.round((tx.bedrag / 1.21) * 0.21 * 100) / 100
    : 0;

  // Calculate KIA for investments
  const kiaAftrek = result.fiscaalType === "investering"
    ? berekenKIA(tx.bedrag)
    : 0;

  return {
    aiBeschrijving: result.beschrijving,
    isAbonnement: result.isAbonnement,
    overdodigheidScore: result.score,
    fiscaalType: result.fiscaalType,
    subsidieMogelijkheden: result.subsidieMogelijkheden ?? [],
    btwBedrag,
    kiaAftrek,
  };
}

// POST: Analyse unanalysed transactions
export async function POST(req: NextRequest) {
  await requireAuth();

  const { ids } = await req.json() as { ids?: number[] };

  let transacties;
  if (ids?.length) {
    transacties = await db
      .select()
      .from(bankTransacties)
      .where(sql`${bankTransacties.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`)
      .limit(50);
  } else {
    transacties = await db
      .select()
      .from(bankTransacties)
      .where(
        and(
          isNull(bankTransacties.aiBeschrijving),
          eq(bankTransacties.type, "af")
        )
      )
      .orderBy(sql`${bankTransacties.datum} DESC`)
      .limit(20);
  }

  if (transacties.length === 0) {
    return NextResponse.json({ geanalyseerd: 0, bericht: "Geen transacties om te analyseren" });
  }

  let geanalyseerd = 0;

  for (const tx of transacties) {
    const merchantKey = tx.merchantNaam || tx.omschrijving;
    const [freq] = await db
      .select({
        aantal: sql<number>`COUNT(*)`,
        gemiddeld: sql<number>`AVG(ABS(${bankTransacties.bedrag}))`,
      })
      .from(bankTransacties)
      .where(
        and(
          eq(bankTransacties.type, "af"),
          sql`(${bankTransacties.merchantNaam} = ${merchantKey} OR ${bankTransacties.omschrijving} = ${merchantKey})`,
          sql`${bankTransacties.datum} >= date('now', '-90 days')`
        )
      );

    const context: TransactieContext = {
      id: tx.id,
      datum: tx.datum,
      omschrijving: tx.omschrijving,
      bedrag: tx.bedrag,
      type: tx.type,
      merchantNaam: tx.merchantNaam,
      merchantCategorie: tx.merchantCategorie,
      aantalKeerGezien: freq?.aantal ?? 1,
      gemiddeldBedrag: freq?.gemiddeld ?? tx.bedrag,
    };

    try {
      const analyse = await analyseTransactie(context);

      // Defensief updaten: alleen velden vullen die nog leeg zijn.
      // Voorkomt dat Sem's handmatige BTW/categorie/fiscaalType wordt
      // overschreven door een AI-guess.
      const updates: Record<string, string | number | null> = {
        aiBeschrijving: analyse.aiBeschrijving,
        isAbonnement: analyse.isAbonnement ? 1 : 0,
        overdodigheidScore: analyse.overdodigheidScore,
        subsidieMogelijkheden: JSON.stringify(analyse.subsidieMogelijkheden),
      };
      if (tx.fiscaalType == null) updates.fiscaalType = analyse.fiscaalType;
      if (tx.btwBedrag == null) updates.btwBedrag = analyse.btwBedrag;
      if (tx.kiaAftrek == null) updates.kiaAftrek = analyse.kiaAftrek;

      await db
        .update(bankTransacties)
        .set(updates)
        .where(eq(bankTransacties.id, tx.id));

      geanalyseerd++;
    } catch {
      // Skip failed, continue
    }
  }

  return NextResponse.json({ geanalyseerd, totaal: transacties.length });
}

// GET: AI-detected subscriptions + fiscal overview
export async function GET(req: NextRequest) {
  await requireAuth();
  const { searchParams } = new URL(req.url);
  const jaarParam = searchParams.get("jaar");
  const jaarOverride = jaarParam && /^\d{4}$/.test(jaarParam) ? parseInt(jaarParam, 10) : null;

  // Subscriptions
  const abos = await db
    .select({
      merchantNaam: bankTransacties.merchantNaam,
      aiBeschrijving: bankTransacties.aiBeschrijving,
      overdodigheidScore: bankTransacties.overdodigheidScore,
      aantal: sql<number>`COUNT(*)`,
      gemiddeldBedrag: sql<number>`AVG(ABS(${bankTransacties.bedrag}))`,
      laatsteDatum: sql<string>`MAX(${bankTransacties.datum})`,
      eersteDatum: sql<string>`MIN(${bankTransacties.datum})`,
    })
    .from(bankTransacties)
    .where(
      and(
        eq(bankTransacties.type, "af"),
        eq(bankTransacties.isAbonnement, 1),
        sql`${bankTransacties.merchantNaam} IS NOT NULL`
      )
    )
    .groupBy(bankTransacties.merchantNaam)
    .orderBy(sql`AVG(ABS(${bankTransacties.bedrag})) DESC`);

  const totaalMaand = abos.reduce((sum, a) => sum + a.gemiddeldBedrag, 0);

  // Unanalysed count
  const [unanalysed] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(bankTransacties)
    .where(and(isNull(bankTransacties.aiBeschrijving), eq(bankTransacties.type, "af")));

  // Fiscal overview: investments for selected year (defaults to current)
  const jaar = jaarOverride ?? new Date().getFullYear();
  const jaarStart = `${jaar}-01-01`;
  const jaarEind = `${jaar + 1}-01-01`;
  const investeringen = await db
    .select()
    .from(bankTransacties)
    .where(
      and(
        eq(bankTransacties.type, "af"),
        eq(bankTransacties.fiscaalType, "investering"),
        sql`${bankTransacties.datum} >= ${jaarStart}`,
        sql`${bankTransacties.datum} < ${jaarEind}`
      )
    )
    .orderBy(sql`${bankTransacties.datum} DESC`);

  const totaalInvesteringen = investeringen.reduce((s, t) => s + t.bedrag, 0);
  const totaalKIA = investeringen.reduce((s, t) => s + (t.kiaAftrek ?? 0), 0);
  const totaalBTWTerug = await db
    .select({ totaal: sql<number>`SUM(${bankTransacties.btwBedrag})` })
    .from(bankTransacties)
    .where(
      and(
        eq(bankTransacties.type, "af"),
        sql`${bankTransacties.fiscaalType} != 'prive' OR ${bankTransacties.fiscaalType} IS NULL`,
        sql`${bankTransacties.btwBedrag} > 0`,
        sql`${bankTransacties.datum} >= ${jaarStart}`,
        sql`${bankTransacties.datum} < ${jaarEind}`
      )
    );

  // Subsidie mogelijkheden
  const subsidieTransacties = investeringen.filter(t => {
    if (!t.subsidieMogelijkheden) return false;
    try {
      const arr = JSON.parse(t.subsidieMogelijkheden) as string[];
      return arr.length > 0;
    } catch { return false; }
  });

  return NextResponse.json({
    abonnementen: abos,
    totaalMaand,
    totaalJaar: totaalMaand * 12,
    ongeanalyseerd: unanalysed?.count ?? 0,
    fiscaal: {
      investeringen: investeringen.map(t => ({
        id: t.id,
        naam: t.merchantNaam || t.omschrijving,
        bedrag: t.bedrag,
        datum: t.datum,
        aiBeschrijving: t.aiBeschrijving,
        kiaAftrek: t.kiaAftrek ?? 0,
        btwBedrag: t.btwBedrag ?? 0,
        subsidieMogelijkheden: t.subsidieMogelijkheden ? JSON.parse(t.subsidieMogelijkheden) as string[] : [],
      })),
      totaalInvesteringen,
      totaalKIA,
      totaalBTWTerug: totaalBTWTerug[0]?.totaal ?? 0,
      kiaRuimte: Math.max(0, 69764 - totaalInvesteringen),
      kiaMinimum: 2801,
      kiaMaximum: 69764,
      subsidieTransacties: subsidieTransacties.length,
    },
  });
}
