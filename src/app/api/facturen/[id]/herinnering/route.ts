import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { facturen, klanten, bedrijfsinstellingen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { Resend } from "resend";

// POST /api/facturen/[id]/herinnering — verstuur herinnering voor één factuur
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const [factuur] = db
      .select({
        id: facturen.id,
        factuurnummer: facturen.factuurnummer,
        status: facturen.status,
        bedragInclBtw: facturen.bedragInclBtw,
        vervaldatum: facturen.vervaldatum,
        klantEmail: klanten.email,
        klantNaam: klanten.bedrijfsnaam,
        klantContactpersoon: klanten.contactpersoon,
      })
      .from(facturen)
      .leftJoin(klanten, eq(facturen.klantId, klanten.id))
      .where(eq(facturen.id, Number(id)))
      .all();

    if (!factuur) {
      return NextResponse.json({ fout: "Factuur niet gevonden." }, { status: 404 });
    }

    if (factuur.status !== "verzonden" && factuur.status !== "te_laat") {
      return NextResponse.json(
        { fout: "Alleen verzonden of te late facturen kunnen een herinnering krijgen." },
        { status: 400 }
      );
    }

    if (!factuur.klantEmail) {
      return NextResponse.json(
        { fout: "Klant heeft geen e-mailadres." },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      // Update status only
      db.update(facturen)
        .set({ status: "te_laat", bijgewerktOp: new Date().toISOString() })
        .where(eq(facturen.id, factuur.id))
        .run();

      return NextResponse.json({
        succes: true,
        emailVerstuurd: false,
        bericht: "Status bijgewerkt naar te_laat, maar e-mail niet geconfigureerd.",
      });
    }

    const [bedrijf] = db.select().from(bedrijfsinstellingen).limit(1).all();
    const bedrijfNaam = bedrijf?.bedrijfsnaam || "Autronis";
    const fromEmail = bedrijf?.email || "zakelijk@autronis.com";
    const iban = bedrijf?.iban;

    const bedragFormatted = new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
    }).format(factuur.bedragInclBtw || 0);

    const vervaldatumFormatted = factuur.vervaldatum
      ? new Date(factuur.vervaldatum).toLocaleDateString("nl-NL", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "onbekend";

    const resend = new Resend(apiKey);

    await resend.emails.send({
      from: `${bedrijfNaam} <${fromEmail}>`,
      to: factuur.klantEmail,
      subject: `Herinnering: Factuur ${factuur.factuurnummer} — ${bedrijfNaam}`,
      text: [
        `Beste ${factuur.klantContactpersoon || factuur.klantNaam},`,
        "",
        `Wij willen u er vriendelijk aan herinneren dat factuur ${factuur.factuurnummer} ter hoogte van ${bedragFormatted} nog niet is voldaan.`,
        `De vervaldatum was ${vervaldatumFormatted}.`,
        "",
        iban
          ? `Gelieve het bedrag over te maken op:\nIBAN: ${iban}\nT.n.v.: ${bedrijfNaam}\nO.v.v.: ${factuur.factuurnummer}`
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

    // Update status to te_laat
    db.update(facturen)
      .set({ status: "te_laat", bijgewerktOp: new Date().toISOString() })
      .where(eq(facturen.id, factuur.id))
      .run();

    return NextResponse.json({ succes: true, emailVerstuurd: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Kon herinnering niet versturen" },
      { status: 500 }
    );
  }
}
