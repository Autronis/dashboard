import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kilometerRegistraties, gebruikers, kmStanden, brandstofKosten } from "@/lib/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ fout: "Niet geautoriseerd" }, { status: 401 });
    }

    const nu = new Date();
    const vorigeMaand = nu.getMonth() === 0 ? 12 : nu.getMonth();
    const jaar = nu.getMonth() === 0 ? nu.getFullYear() - 1 : nu.getFullYear();
    const maandNamen = ["", "januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
    const maandNaam = maandNamen[vorigeMaand];

    const startDatum = `${jaar}-${String(vorigeMaand).padStart(2, "0")}-01`;
    const eindDatum = `${jaar}-${String(vorigeMaand).padStart(2, "0")}-31`;

    const users = await db.select().from(gebruikers).all();

    let verzonden = 0;

    for (const user of users) {
      if (!user.email) continue;

      const stats = await db
        .select({
          totaalKm: sql<number>`COALESCE(SUM(${kilometerRegistraties.kilometers}), 0)`,
          aantalRitten: sql<number>`COUNT(*)`,
        })
        .from(kilometerRegistraties)
        .where(
          and(
            eq(kilometerRegistraties.gebruikerId, user.id),
            gte(kilometerRegistraties.datum, startDatum),
            lte(kilometerRegistraties.datum, eindDatum)
          )
        )
        .get();

      const km = stats?.totaalKm ?? 0;
      const ritten = stats?.aantalRitten ?? 0;
      const aftrekbaar = Math.round(km * 0.23 * 100) / 100;

      const klantenData = await db
        .select({ klantId: kilometerRegistraties.klantId })
        .from(kilometerRegistraties)
        .where(
          and(
            eq(kilometerRegistraties.gebruikerId, user.id),
            gte(kilometerRegistraties.datum, startDatum),
            lte(kilometerRegistraties.datum, eindDatum)
          )
        )
        .groupBy(kilometerRegistraties.klantId)
        .all();
      const aantalKlanten = klantenData.filter((k) => k.klantId !== null).length;

      const brandstof = await db
        .select({
          totaal: sql<number>`COALESCE(SUM(${brandstofKosten.bedrag}), 0)`,
        })
        .from(brandstofKosten)
        .where(
          and(
            eq(brandstofKosten.gebruikerId, user.id),
            gte(brandstofKosten.datum, startDatum),
            lte(brandstofKosten.datum, eindDatum)
          )
        )
        .get();

      const kmStand = await db
        .select()
        .from(kmStanden)
        .where(
          and(
            eq(kmStanden.gebruikerId, user.id),
            eq(kmStanden.jaar, jaar),
            eq(kmStanden.maand, vorigeMaand)
          )
        )
        .get();

      const waarschuwingen: string[] = [];
      if (!kmStand) waarschuwingen.push(`Km-stand ${maandNaam} nog niet ingevuld`);
      if (ritten === 0) waarschuwingen.push("Geen ritten gelogd deze maand");

      const dashboardUrl = process.env.NEXT_PUBLIC_URL ?? "https://dashboard.autronis.nl";

      await resend.emails.send({
        from: "Autronis <noreply@autronis.nl>",
        to: user.email,
        subject: `Kilometerrapport ${maandNaam} ${jaar}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto;">
            <div style="background: #0E1719; padding: 20px 24px; border-radius: 12px 12px 0 0;">
              <div style="color: #17B8A5; font-weight: 600;">Autronis Kilometerrapport</div>
              <div style="color: #888; font-size: 14px;">${maandNaam} ${jaar} &mdash; Samenvatting</div>
            </div>
            <div style="background: #fff; padding: 24px; border-radius: 0 0 12px 12px;">
              <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                <div style="flex: 1; text-align: center; padding: 12px; background: #f5f5f5; border-radius: 8px;">
                  <div style="font-size: 24px; font-weight: 700;">${Math.round(km)} km</div>
                  <div style="font-size: 12px; color: #888;">totaal gereden</div>
                </div>
                <div style="flex: 1; text-align: center; padding: 12px; background: #f5f5f5; border-radius: 8px;">
                  <div style="font-size: 24px; font-weight: 700; color: #17B8A5;">&euro;${aftrekbaar.toFixed(2)}</div>
                  <div style="font-size: 12px; color: #888;">aftrekbaar</div>
                </div>
              </div>
              <div style="font-size: 14px; color: #666; margin-bottom: 16px;">
                ${ritten} ritten &middot; ${aantalKlanten} klanten bezocht &middot; &euro;${(brandstof?.totaal ?? 0).toFixed(2)} brandstof
              </div>
              ${waarschuwingen.length > 0 ? `<div style="padding: 12px; background: #FFF8E1; border-radius: 8px; margin-bottom: 16px; font-size: 14px; color: #F57C00;">${waarschuwingen.join(" &middot; ")}</div>` : ""}
              <div style="text-align: center;">
                <a href="${dashboardUrl}/kilometers" style="display: inline-block; padding: 10px 24px; background: #17B8A5; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">Bekijk in dashboard &rarr;</a>
              </div>
            </div>
          </div>
        `,
      });

      verzonden++;
    }

    return NextResponse.json({ verzonden });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 500 }
    );
  }
}
