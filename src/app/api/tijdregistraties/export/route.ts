import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tijdregistraties, projecten, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, desc, isNotNull } from "drizzle-orm";

// GET /api/tijdregistraties/export?van=2026-03-10&tot=2026-03-16
export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { searchParams } = new URL(req.url);
    const van = searchParams.get("van");
    const tot = searchParams.get("tot");

    const conditions = [
      eq(tijdregistraties.gebruikerId, gebruiker.id),
      isNotNull(tijdregistraties.eindTijd),
    ];

    if (van) conditions.push(gte(tijdregistraties.startTijd, van));
    if (tot) {
      const totDate = new Date(tot);
      totDate.setDate(totDate.getDate() + 1);
      conditions.push(lte(tijdregistraties.startTijd, totDate.toISOString()));
    }

    const registraties = await db
      .select({
        startTijd: tijdregistraties.startTijd,
        eindTijd: tijdregistraties.eindTijd,
        duurMinuten: tijdregistraties.duurMinuten,
        omschrijving: tijdregistraties.omschrijving,
        categorie: tijdregistraties.categorie,
        projectNaam: projecten.naam,
        klantNaam: klanten.bedrijfsnaam,
      })
      .from(tijdregistraties)
      .leftJoin(projecten, eq(tijdregistraties.projectId, projecten.id))
      .leftJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(and(...conditions))
      .orderBy(desc(tijdregistraties.startTijd));

    // Build CSV with BOM and semicolon separator for Dutch Excel
    const bom = "\uFEFF";
    const header = "Datum;Project;Klant;Omschrijving;Categorie;Duur (uren)";
    const rows = registraties.map((r) => {
      const datum = r.startTijd ? new Date(r.startTijd).toLocaleDateString("nl-NL") : "";
      const duur = r.duurMinuten ? (r.duurMinuten / 60).toFixed(2).replace(".", ",") : "0";
      return [datum, r.projectNaam || "", r.klantNaam || "", r.omschrijving || "", r.categorie || "", duur]
        .map((v) => `"${v}"`)
        .join(";");
    });

    const csv = bom + header + "\n" + rows.join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tijdregistratie-export.csv"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
