import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bankTransacties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lt, desc, sql } from "drizzle-orm";

// GET /api/financien/transacties?type=af&periode=maand&categorie=software&zoek=coolblue
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);

    const type = searchParams.get("type"); // "bij" | "af" | null (both)
    const periode = searchParams.get("periode") ?? "maand"; // "maand" | "kwartaal" | "jaar" | "alles" | "custom"
    const van = searchParams.get("van"); // YYYY-MM-DD (for custom)
    const tot = searchParams.get("tot"); // YYYY-MM-DD (for custom)
    const categorie = searchParams.get("categorie"); // exact match
    const zoek = searchParams.get("zoek");
    const limiet = Math.min(parseInt(searchParams.get("limiet") ?? "500", 10), 1000);

    // Compute date range based on periode
    const nu = new Date();
    const jaar = nu.getFullYear();
    const maand = nu.getMonth();
    const kwartaal = Math.floor(maand / 3);
    let startDatum: string | null = null;
    let eindDatum: string | null = null;

    if (periode === "custom" && van && tot) {
      startDatum = van;
      eindDatum = tot;
    } else if (periode === "maand") {
      startDatum = `${jaar}-${String(maand + 1).padStart(2, "0")}-01`;
      eindDatum = maand === 11
        ? `${jaar + 1}-01-01`
        : `${jaar}-${String(maand + 2).padStart(2, "0")}-01`;
    } else if (periode === "kwartaal") {
      const kwartaalStartMaand = kwartaal * 3 + 1;
      startDatum = `${jaar}-${String(kwartaalStartMaand).padStart(2, "0")}-01`;
      const kwartaalEindMaand = kwartaalStartMaand + 3;
      eindDatum = kwartaalEindMaand > 12
        ? `${jaar + 1}-01-01`
        : `${jaar}-${String(kwartaalEindMaand).padStart(2, "0")}-01`;
    } else if (periode === "jaar") {
      startDatum = `${jaar}-01-01`;
      eindDatum = `${jaar + 1}-01-01`;
    }
    // "alles" leaves both null

    const conditions = [];
    if (type === "bij" || type === "af") {
      conditions.push(eq(bankTransacties.type, type));
    }
    if (startDatum) conditions.push(gte(bankTransacties.datum, startDatum));
    if (eindDatum) conditions.push(lt(bankTransacties.datum, eindDatum));
    if (categorie && categorie !== "alle") {
      conditions.push(eq(bankTransacties.categorie, categorie));
    }
    if (zoek) {
      const like = `%${zoek}%`;
      conditions.push(sql`(${bankTransacties.omschrijving} LIKE ${like} OR ${bankTransacties.merchantNaam} LIKE ${like})`);
    }

    const transacties = await db
      .select({
        id: bankTransacties.id,
        datum: bankTransacties.datum,
        omschrijving: bankTransacties.omschrijving,
        bedrag: bankTransacties.bedrag,
        type: bankTransacties.type,
        categorie: bankTransacties.categorie,
        merchantNaam: bankTransacties.merchantNaam,
        aiBeschrijving: bankTransacties.aiBeschrijving,
        btwBedrag: bankTransacties.btwBedrag,
        status: bankTransacties.status,
        bank: bankTransacties.bank,
        fiscaalType: bankTransacties.fiscaalType,
        isAbonnement: bankTransacties.isAbonnement,
        gekoppeldFactuurId: bankTransacties.gekoppeldFactuurId,
        storageUrl: bankTransacties.storageUrl,
      })
      .from(bankTransacties)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(bankTransacties.datum))
      .limit(limiet);

    return NextResponse.json({
      transacties,
      aantal: transacties.length,
      periode,
      van: startDatum,
      tot: eindDatum,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
