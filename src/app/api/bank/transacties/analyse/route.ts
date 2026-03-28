import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bankTransacties } from "@/lib/db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

async function analyseTransactie(tx: TransactieContext): Promise<{
  aiBeschrijving: string;
  isAbonnement: boolean;
  overdodigheidScore: "noodzakelijk" | "nuttig" | "overbodig";
}> {
  const prompt = `Analyseer deze banktransactie voor een klein AI-bureau (Autronis) en geef:
1. Een korte Nederlandse beschrijving: wat is het, waarvoor wordt het gebruikt
2. Is dit een abonnement? (dezelfde merchant komt ${tx.aantalKeerGezien}x voor, gemiddeld €${tx.gemiddeldBedrag.toFixed(2)})
3. Overbodigheid score: noodzakelijk (essentieel voor bedrijfsvoering), nuttig (handig maar niet kritiek), overbodig (niet zakelijk of er zijn gratis alternatieven)

Transactie:
- Merchant: ${tx.merchantNaam || tx.omschrijving}
- Categorie: ${tx.merchantCategorie || "onbekend"}
- Bedrag: €${tx.bedrag.toFixed(2)}
- Type: ${tx.type === "af" ? "uitgave" : "inkomst"}
- Datum: ${tx.datum}
- Aantal keer gezien: ${tx.aantalKeerGezien}x in 90 dagen

Context: Autronis is een AI- en automatiseringsbureau. Zakelijke tools (hosting, AI, development) zijn noodzakelijk. Persoonlijke uitgaven zijn overbodig.

Antwoord ALLEEN als JSON:
{
  "beschrijving": "Korte Nederlandse beschrijving, max 1 zin",
  "isAbonnement": true/false,
  "score": "noodzakelijk" | "nuttig" | "overbodig"
}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { aiBeschrijving: "", isAbonnement: false, overdodigheidScore: "nuttig" };
  }

  const result = JSON.parse(jsonMatch[0]) as {
    beschrijving: string;
    isAbonnement: boolean;
    score: "noodzakelijk" | "nuttig" | "overbodig";
  };

  return {
    aiBeschrijving: result.beschrijving,
    isAbonnement: result.isAbonnement,
    overdodigheidScore: result.score,
  };
}

// POST: Analyse all unanalysed transactions (bulk)
export async function POST(req: NextRequest) {
  await requireAuth();

  const { ids } = await req.json() as { ids?: number[] };

  // Get transactions that need analysis
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
    // Count how often this merchant appears
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

      await db
        .update(bankTransacties)
        .set({
          aiBeschrijving: analyse.aiBeschrijving,
          isAbonnement: analyse.isAbonnement ? 1 : 0,
          overdodigheidScore: analyse.overdodigheidScore,
        })
        .where(eq(bankTransacties.id, tx.id));

      geanalyseerd++;
    } catch {
      // Skip failed analyses, continue with next
    }
  }

  return NextResponse.json({ geanalyseerd, totaal: transacties.length });
}

// GET: Get AI-detected subscriptions overview
export async function GET() {
  await requireAuth();

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

  // Count unanalysed
  const [unanalysed] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(bankTransacties)
    .where(
      and(
        isNull(bankTransacties.aiBeschrijving),
        eq(bankTransacties.type, "af")
      )
    );

  return NextResponse.json({
    abonnementen: abos,
    totaalMaand,
    totaalJaar: totaalMaand * 12,
    ongeanalyseerd: unanalysed?.count ?? 0,
  });
}
