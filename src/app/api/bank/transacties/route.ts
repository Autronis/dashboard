import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bankTransacties, facturen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, sql } from "drizzle-orm";

// GET /api/bank/transacties — List bank transactions with optional status filter
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const fiscaalType = searchParams.get("fiscaalType");
    const zoek = searchParams.get("zoek");
    const limiet = parseInt(searchParams.get("limiet") || "200");

    const conditions: ReturnType<typeof eq>[] = [];
    if (status && status !== "alle") {
      conditions.push(eq(bankTransacties.status, status as "onbekend" | "gecategoriseerd" | "gematcht"));
    }
    if (fiscaalType && fiscaalType !== "alle") {
      conditions.push(eq(bankTransacties.fiscaalType, fiscaalType as "investering" | "kosten" | "prive"));
    }
    if (zoek) {
      conditions.push(sql`(${bankTransacties.omschrijving} LIKE ${"%" + zoek + "%"} OR ${bankTransacties.merchantNaam} LIKE ${"%" + zoek + "%"})` as ReturnType<typeof eq>);
    }

    const lijst = await db
      .select({
        id: bankTransacties.id,
        datum: bankTransacties.datum,
        omschrijving: bankTransacties.omschrijving,
        bedrag: bankTransacties.bedrag,
        type: bankTransacties.type,
        categorie: bankTransacties.categorie,
        gekoppeldFactuurId: bankTransacties.gekoppeldFactuurId,
        status: bankTransacties.status,
        bank: bankTransacties.bank,
        tegenrekening: bankTransacties.tegenrekening,
        merchantNaam: bankTransacties.merchantNaam,
        aiBeschrijving: bankTransacties.aiBeschrijving,
        fiscaalType: bankTransacties.fiscaalType,
        btwBedrag: bankTransacties.btwBedrag,
        isAbonnement: bankTransacties.isAbonnement,
        overdodigheidScore: bankTransacties.overdodigheidScore,
        bonPad: bankTransacties.bonPad,
        aangemaaktOp: bankTransacties.aangemaaktOp,
      })
      .from(bankTransacties)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`${bankTransacties.datum} DESC`)
      .limit(limiet);

    // Summary stats
    const [stats] = await db
      .select({
        totaal: sql<number>`count(*)`,
        onbekend: sql<number>`sum(case when ${bankTransacties.status} = 'onbekend' then 1 else 0 end)`,
        gecategoriseerd: sql<number>`sum(case when ${bankTransacties.status} = 'gecategoriseerd' then 1 else 0 end)`,
        gematcht: sql<number>`sum(case when ${bankTransacties.status} = 'gematcht' then 1 else 0 end)`,
      })
      .from(bankTransacties);

    return NextResponse.json({
      transacties: lijst,
      stats: {
        totaal: stats?.totaal ?? 0,
        onbekend: stats?.onbekend ?? 0,
        gecategoriseerd: stats?.gecategoriseerd ?? 0,
        gematcht: stats?.gematcht ?? 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

interface BulkTransaction {
  datum: string;
  omschrijving: string;
  bedrag: number;
  type: "bij" | "af";
  categorie: string;
  bank: string;
  tegenrekening: string;
}

// POST /api/bank/transacties — Bulk insert confirmed transactions
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();
    const { transacties } = body as { transacties: BulkTransaction[] };

    if (!transacties || !Array.isArray(transacties) || transacties.length === 0) {
      return NextResponse.json({ fout: "Geen transacties om op te slaan." }, { status: 400 });
    }

    const values = transacties.map((t) => ({
      datum: t.datum,
      omschrijving: t.omschrijving,
      bedrag: t.bedrag,
      type: t.type as "bij" | "af",
      categorie: t.categorie || null,
      status: (t.categorie && t.categorie !== "overig" ? "gecategoriseerd" : "onbekend") as "onbekend" | "gecategoriseerd" | "gematcht",
      bank: t.bank || null,
      tegenrekening: t.tegenrekening || null,
    }));

    await db.insert(bankTransacties).values(values);

    return NextResponse.json({
      succes: true,
      aantalGeimporteerd: values.length,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
