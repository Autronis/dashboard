import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { facturen, klanten, bedrijfsinstellingen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, lte } from "drizzle-orm";
import { Resend } from "resend";

// GET /api/facturen/herinneringen — preview: welke herinneringen zouden worden verstuurd
export async function GET() {
  try {
    await requireAuth();
    const nu = new Date().toISOString().split("T")[0];
    const overdueFacturen = await db
      .select({
        id: facturen.id,
        factuurnummer: facturen.factuurnummer,
        bedragInclBtw: facturen.bedragInclBtw,
        vervaldatum: facturen.vervaldatum,
        klantNaam: klanten.bedrijfsnaam,
      })
      .from(facturen)
      .leftJoin(klanten, eq(facturen.klantId, klanten.id))
      .where(and(eq(facturen.status, "verzonden"), eq(facturen.isActief, 1), lte(facturen.vervaldatum, nu)))
      .all();
    return NextResponse.json({ aantal: overdueFacturen.length, facturen: overdueFacturen });
  } catch {
    return NextResponse.json({ fout: "Preview mislukt" }, { status: 500 });
  }
}

// POST /api/facturen/herinneringen — verstuur herinneringen voor alle te late facturen
export async function POST() {
  try {
    await requireAuth();

    const nu = new Date().toISOString().split("T")[0];

    const overdueFacturen = await db
      .select({
        id: facturen.id,
        factuurnummer: facturen.factuurnummer,
        bedragInclBtw: facturen.bedragInclBtw,
        vervaldatum: facturen.vervaldatum,
        klantEmail: klanten.email,
        klantNaam: klanten.bedrijfsnaam,
        klantContactpersoon: klanten.contactpersoon,
      })
      .from(facturen)
      .leftJoin(klanten, eq(facturen.klantId, klanten.id))
      .where(
        and(
          eq(facturen.status, "verzonden"),
          eq(facturen.isActief, 1),
          lte(facturen.vervaldatum, nu)
        )
      )
      .all();

    if (overdueFacturen.length === 0) {
      return NextResponse.json({ verzonden: 0, bericht: "Geen te late facturen gevonden." });
    }

    const [bedrijf] = await db.select().from(bedrijfsinstellingen).limit(1).all();
    const bedrijfNaam = bedrijf?.bedrijfsnaam || "Autronis";
    const iban = bedrijf?.iban;

    const apiKey = process.env.RESEND_API_KEY;
    const resend = apiKey ? new Resend(apiKey) : null;
    const fromEmail = bedrijf?.email || "zakelijk@autronis.com";

    const resultaten: Array<{ factuurId: number; factuurnummer: string; klant: string | null; emailVerstuurd: boolean }> = [];

    for (const f of overdueFacturen) {
      const bedragFormatted = new Intl.NumberFormat("nl-NL", {
        style: "currency",
        currency: "EUR",
      }).format(f.bedragInclBtw || 0);

      const vervaldatumFormatted = f.vervaldatum
        ? new Date(f.vervaldatum).toLocaleDateString("nl-NL", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : "onbekend";

      let emailVerstuurd = false;

      if (resend && f.klantEmail) {
        try {
          await resend.emails.send({
            from: `${bedrijfNaam} <${fromEmail}>`,
            to: f.klantEmail,
            subject: `Herinnering: Factuur ${f.factuurnummer} — ${bedrijfNaam}`,
            text: [
              `Beste ${f.klantContactpersoon || f.klantNaam},`,
              "",
              `Wij willen u er vriendelijk aan herinneren dat factuur ${f.factuurnummer} ter hoogte van ${bedragFormatted} nog niet is voldaan.`,
              `De vervaldatum was ${vervaldatumFormatted}.`,
              "",
              iban
                ? `Gelieve het bedrag over te maken op:\nIBAN: ${iban}\nT.n.v.: ${bedrijfNaam}\nO.v.v.: ${f.factuurnummer}`
                : "",
              "",
              "Indien u deze factuur reeds heeft betaald, kunt u deze herinnering als niet verzonden beschouwen.",
              "",
              "Met vriendelijke groet,",
              bedrijfNaam,
            ]
              .filter(Boolean)
              .join("\n"),
          });
          emailVerstuurd = true;
        } catch {
          // Email failed, still update status
        }
      }

      // Update status to te_laat
      await db.update(facturen)
        .set({ status: "te_laat", bijgewerktOp: new Date().toISOString() })
        .where(eq(facturen.id, f.id))
        .run();

      resultaten.push({
        factuurId: f.id,
        factuurnummer: f.factuurnummer,
        klant: f.klantNaam,
        emailVerstuurd,
      });
    }

    return NextResponse.json({
      verzonden: resultaten.filter((r) => r.emailVerstuurd).length,
      bijgewerkt: resultaten.length,
      resultaten,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Kon herinneringen niet versturen" },
      { status: 500 }
    );
  }
}
