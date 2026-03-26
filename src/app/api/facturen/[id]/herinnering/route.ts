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

    const [factuur] = await db
      .select({
        id: facturen.id,
        factuurnummer: facturen.factuurnummer,
        status: facturen.status,
        bedragInclBtw: facturen.bedragInclBtw,
        vervaldatum: facturen.vervaldatum,
        klantEmail: klanten.email,
        klantNaam: klanten.bedrijfsnaam,
        klantContactpersoon: klanten.contactpersoon,
        klantTaal: klanten.taal,
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
      await db.update(facturen)
        .set({ status: "te_laat", bijgewerktOp: new Date().toISOString() })
        .where(eq(facturen.id, factuur.id))
        .run();

      return NextResponse.json({
        succes: true,
        emailVerstuurd: false,
        bericht: "Status bijgewerkt naar te_laat, maar e-mail niet geconfigureerd.",
      });
    }

    const [bedrijf] = await db.select().from(bedrijfsinstellingen).limit(1).all();
    const bedrijfNaam = bedrijf?.bedrijfsnaam || "Autronis";
    const fromEmail = bedrijf?.email || "zakelijk@autronis.com";
    const iban = bedrijf?.iban;

    const taal = (factuur.klantTaal === "en" ? "en" : "nl") as "nl" | "en";
    const locale = taal === "en" ? "en-GB" : "nl-NL";

    const bedragFormatted = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
    }).format(factuur.bedragInclBtw || 0);

    const vervaldatumFormatted = factuur.vervaldatum
      ? new Date(factuur.vervaldatum).toLocaleDateString(locale, {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : taal === "en" ? "unknown" : "onbekend";

    const resend = new Resend(apiKey);
    const naam = factuur.klantContactpersoon || factuur.klantNaam;

    const subject = taal === "en"
      ? `Reminder: Invoice ${factuur.factuurnummer} — ${bedrijfNaam}`
      : `Herinnering: Factuur ${factuur.factuurnummer} — ${bedrijfNaam}`;

    const textLines = taal === "en"
      ? [
          `Dear ${naam},`,
          "",
          `We would like to kindly remind you that invoice ${factuur.factuurnummer} for the amount of ${bedragFormatted} has not yet been paid.`,
          `The due date was ${vervaldatumFormatted}.`,
          "",
          iban
            ? `Please transfer the amount to:\nIBAN: ${iban}\nIn the name of: ${bedrijfNaam}\nReference: ${factuur.factuurnummer}`
            : "",
          "",
          "If you have already made this payment, please disregard this reminder.",
          "",
          "Kind regards,",
          bedrijfNaam,
        ]
      : [
          `Beste ${naam},`,
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
        ];

    await resend.emails.send({
      from: `${bedrijfNaam} <${fromEmail}>`,
      to: factuur.klantEmail,
      subject,
      text: textLines.filter(Boolean).join("\n"),
    });

    // Update status to te_laat
    await db.update(facturen)
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
