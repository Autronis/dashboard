import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { offertes, klanten, bedrijfsinstellingen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, isNull, lte, sql } from "drizzle-orm";
import { Resend } from "resend";

export async function POST() {
  try {
    await requireAuth();

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ fout: "RESEND_API_KEY niet geconfigureerd" }, { status: 500 });
    }

    const resend = new Resend(apiKey);

    const bedrijf = await db.select().from(bedrijfsinstellingen).get();
    const fromEmail = bedrijf?.email || "zakelijk@autronis.com";
    const bedrijfsnaam = bedrijf?.bedrijfsnaam || "Autronis";

    // Find offertes that are "verzonden" for 7+ days and haven't had a reminder yet
    const zevenDagenGeleden = new Date();
    zevenDagenGeleden.setDate(zevenDagenGeleden.getDate() - 7);
    const grens = zevenDagenGeleden.toISOString().split("T")[0] ?? "";

    const teHerinnerenOffertes = await db
      .select({
        id: offertes.id,
        offertenummer: offertes.offertenummer,
        titel: offertes.titel,
        datum: offertes.datum,
        geldigTot: offertes.geldigTot,
        bedragInclBtw: offertes.bedragInclBtw,
        klantEmail: klanten.email,
        klantNaam: klanten.bedrijfsnaam,
        klantContactpersoon: klanten.contactpersoon,
      })
      .from(offertes)
      .innerJoin(klanten, eq(offertes.klantId, klanten.id))
      .where(
        and(
          eq(offertes.status, "verzonden"),
          eq(offertes.isActief, 1),
          lte(offertes.datum, grens),
          isNull(offertes.herinneringVerstuurdOp)
        )
      )
      .all();

    if (teHerinnerenOffertes.length === 0) {
      return NextResponse.json({ succes: true, verstuurd: 0, bericht: "Geen openstaande offertes ouder dan 7 dagen" });
    }

    const resultaten: Array<{ offertenummer: string; succes: boolean; fout?: string }> = [];

    for (const off of teHerinnerenOffertes) {
      if (!off.klantEmail) {
        resultaten.push({ offertenummer: off.offertenummer, succes: false, fout: "Geen email" });
        continue;
      }

      try {
        const aanhef = off.klantContactpersoon
          ? `Beste ${off.klantContactpersoon}`
          : `Beste ${off.klantNaam}`;

        await resend.emails.send({
          from: `${bedrijfsnaam} <${fromEmail}>`,
          to: off.klantEmail,
          subject: `Herinnering: Offerte ${off.offertenummer}${off.titel ? ` — ${off.titel}` : ""}`,
          text: `${aanhef},

Graag herinneren wij u aan onze offerte ${off.offertenummer}${off.titel ? ` "${off.titel}"` : ""} die wij op ${off.datum ? new Date(off.datum).toLocaleDateString("nl-NL") : "recent"} hebben verstuurd.

${off.geldigTot ? `De offerte is geldig tot ${new Date(off.geldigTot).toLocaleDateString("nl-NL")}.` : ""}

Mocht u vragen hebben of de offerte willen bespreken, neem dan gerust contact met ons op.

Met vriendelijke groet,
${bedrijfsnaam}
${fromEmail}`,
        });

        await db.update(offertes)
          .set({
            herinneringVerstuurdOp: new Date().toISOString(),
            bijgewerktOp: sql`(datetime('now'))`,
          })
          .where(eq(offertes.id, off.id))
          .run();

        resultaten.push({ offertenummer: off.offertenummer, succes: true });
      } catch (err) {
        resultaten.push({
          offertenummer: off.offertenummer,
          succes: false,
          fout: err instanceof Error ? err.message : "Onbekende fout",
        });
      }
    }

    const verstuurd = resultaten.filter((r) => r.succes).length;
    return NextResponse.json({ succes: true, verstuurd, totaal: teHerinnerenOffertes.length, resultaten });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
