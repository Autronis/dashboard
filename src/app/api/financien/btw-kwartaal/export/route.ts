import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bankTransacties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { and, gte, lt, desc } from "drizzle-orm";
import { notBalansCategorie } from "@/lib/borg";

// CSV field escaping: wrap in double-quotes, escape internal quotes by doubling them.
function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",;\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatEuro(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

// GET /api/financien/btw-kwartaal/export?jaar=2026&kwartaal=2
//
// Returns a CSV file with all bank transactions in the period, one row per
// transaction, plus a summary header. Suitable to forward to a boekhouder
// or use as supporting document for the BTW aangifte.
export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const jaar = parseInt(searchParams.get("jaar") ?? `${new Date().getFullYear()}`, 10);
    const kwartaal = parseInt(searchParams.get("kwartaal") ?? "1", 10);

    if (kwartaal < 1 || kwartaal > 4) {
      return NextResponse.json({ fout: "Ongeldig kwartaal (1-4)" }, { status: 400 });
    }

    const startMaand = (kwartaal - 1) * 3 + 1;
    const start = `${jaar}-${String(startMaand).padStart(2, "0")}-01`;
    const eindMaand = startMaand + 3;
    const eind =
      eindMaand > 12
        ? `${jaar + 1}-01-01`
        : `${jaar}-${String(eindMaand).padStart(2, "0")}-01`;

    const eindDatum = new Date(eind);
    eindDatum.setDate(eindDatum.getDate() - 1);
    const eindStr = eindDatum.toISOString().slice(0, 10);

    // Exclude vermogensstortingen + borgen from the aangifte — beide zijn
    // balans-posten, geen P&L. Worden elders in dashboard getrackt maar
    // horen niet in een BTW aangifte thuis.
    const transacties = await db
      .select()
      .from(bankTransacties)
      .where(
        and(
          gte(bankTransacties.datum, start),
          lt(bankTransacties.datum, eind),
          notBalansCategorie()
        )
      )
      .orderBy(desc(bankTransacties.datum));

    // Totals
    let totInkomsten = 0;
    let totUitgaven = 0;
    let totBtwAfgedragen = 0;
    let totBtwTerug = 0;
    let gekoppeldeBonnen = 0;

    for (const t of transacties) {
      const abs = Math.abs(t.bedrag);
      if (t.type === "bij") {
        totInkomsten += abs;
        totBtwAfgedragen += t.btwBedrag ?? 0;
      } else {
        totUitgaven += abs;
        totBtwTerug += t.btwBedrag ?? 0;
      }
      if (t.storageUrl || t.bonPad) gekoppeldeBonnen++;
    }

    const teBetalen = totBtwAfgedragen - totBtwTerug;

    // Build CSV. Use semicolon separator for NL Excel compatibility.
    const lines: string[] = [];
    const SEP = ";";

    // Header banner
    lines.push(`BTW-aangifte Q${kwartaal} ${jaar}`);
    lines.push(`Periode${SEP}${start} t/m ${eindStr}`);
    lines.push(`Gegenereerd${SEP}${new Date().toISOString().slice(0, 10)}`);
    lines.push("");

    // Summary
    lines.push("Samenvatting");
    lines.push(`Totaal inkomsten${SEP}${formatEuro(totInkomsten)}`);
    lines.push(`Totaal uitgaven${SEP}${formatEuro(totUitgaven)}`);
    lines.push(`BTW afgedragen (over inkomsten)${SEP}${formatEuro(totBtwAfgedragen)}`);
    lines.push(`BTW terug te vragen (over uitgaven)${SEP}${formatEuro(totBtwTerug)}`);
    lines.push(
      `${teBetalen >= 0 ? "Te betalen" : "Te ontvangen"}${SEP}${formatEuro(Math.abs(teBetalen))}`
    );
    lines.push(
      `Transacties met bon/factuur gekoppeld${SEP}${gekoppeldeBonnen} / ${transacties.length}`
    );
    lines.push("");

    // Transaction rows
    lines.push(
      [
        "Datum",
        "Type",
        "Leverancier / Klant",
        "Omschrijving",
        "Categorie",
        "Bedrag incl. BTW",
        "BTW bedrag",
        "Bedrag excl. BTW",
        "Fiscaal type",
        "Bank",
        "Bon gekoppeld",
      ]
        .map(csvField)
        .join(SEP)
    );

    for (const t of transacties) {
      const abs = Math.abs(t.bedrag);
      const btw = t.btwBedrag ?? 0;
      const exclBtw = abs - btw;
      lines.push(
        [
          t.datum,
          t.type === "bij" ? "Inkomst" : "Uitgave",
          t.merchantNaam ?? "",
          t.omschrijving,
          t.categorie ?? "",
          formatEuro(abs),
          formatEuro(btw),
          formatEuro(exclBtw),
          t.fiscaalType ?? "",
          t.bank ?? "",
          t.storageUrl || t.bonPad ? "ja" : "nee",
        ]
          .map(csvField)
          .join(SEP)
      );
    }

    const csv = lines.join("\r\n");
    const filename = `BTW-aangifte_Q${kwartaal}_${jaar}.csv`;

    return new NextResponse("\ufeff" + csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Export mislukt" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
