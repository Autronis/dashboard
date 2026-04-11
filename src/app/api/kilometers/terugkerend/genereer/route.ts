import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { terugkerendeRitten, kilometerRegistraties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isWeekday(d: Date): boolean {
  const day = d.getDay();
  return day !== 0 && day !== 6; // 0=Sunday, 6=Saturday
}

// Convert our dagVanWeek (0=Monday..6=Sunday) to JS getDay() format (0=Sunday..6=Saturday)
function matchesDayOfWeek(d: Date, dagVanWeek: number): boolean {
  const jsDay = d.getDay();
  // Convert: JS 0=Sun→our 6, JS 1=Mon→our 0, etc.
  const ourDay = jsDay === 0 ? 6 : jsDay - 1;
  return ourDay === dagVanWeek;
}

function matchesDayOfMonth(d: Date, dagVanMaand: number): boolean {
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const targetDay = Math.min(dagVanMaand, lastDay);
  return d.getDate() === targetDay;
}

// POST /api/kilometers/terugkerend/genereer — Generate pending recurring trips
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

    let gebruikerId: number | null = null;
    if (!isCron) {
      const gebruiker = await requireAuth();
      gebruikerId = gebruiker.id;
    }

    const vandaag = formatDate(new Date());

    const actieveRitten = await db
      .select()
      .from(terugkerendeRitten)
      .where(
        gebruikerId
          ? and(eq(terugkerendeRitten.isActief, 1), eq(terugkerendeRitten.gebruikerId, gebruikerId))
          : eq(terugkerendeRitten.isActief, 1)
      );

    let aangemaakt = 0;

    for (const rit of actieveRitten) {
      // Determine start date for generation
      const genStart = rit.laatsteGeneratie
        ? formatDate(addDays(new Date(rit.laatsteGeneratie), 1))
        : rit.startDatum;

      if (genStart > vandaag) continue;
      if (rit.eindDatum && rit.eindDatum < genStart) continue;

      const startDate = new Date(genStart);
      const endDate = rit.eindDatum && rit.eindDatum < vandaag
        ? new Date(rit.eindDatum)
        : new Date(vandaag);

      const kmWaarde = rit.isRetour ? rit.kilometers * 2 : rit.kilometers;

      let current = startDate;
      while (current <= endDate) {
        const datum = formatDate(current);
        let shouldCreate = false;

        switch (rit.frequentie) {
          case "dagelijks":
            shouldCreate = isWeekday(current);
            break;
          case "wekelijks":
            shouldCreate = rit.dagVanWeek != null && matchesDayOfWeek(current, rit.dagVanWeek);
            break;
          case "maandelijks":
            shouldCreate = rit.dagVanMaand != null && matchesDayOfMonth(current, rit.dagVanMaand);
            break;
        }

        if (shouldCreate && datum >= rit.startDatum) {
          // Check for duplicate
          const [bestaand] = await db
            .select({ id: kilometerRegistraties.id })
            .from(kilometerRegistraties)
            .where(
              and(
                eq(kilometerRegistraties.terugkerendeRitId, rit.id),
                eq(kilometerRegistraties.datum, datum)
              )
            )
            .limit(1);

          if (!bestaand) {
            await db.insert(kilometerRegistraties).values({
              gebruikerId: rit.gebruikerId,
              datum,
              vanLocatie: rit.vanLocatie,
              naarLocatie: rit.naarLocatie,
              kilometers: kmWaarde,
              isRetour: rit.isRetour ?? 0,
              doelType: rit.doelType,
              klantId: rit.klantId,
              projectId: rit.projectId,
              terugkerendeRitId: rit.id,
              tariefPerKm: 0.23,
            });
            aangemaakt++;
          }
        }

        current = addDays(current, 1);
      }

      // Update laatsteGeneratie
      await db
        .update(terugkerendeRitten)
        .set({ laatsteGeneratie: vandaag })
        .where(eq(terugkerendeRitten.id, rit.id));
    }

    if (isCron && aangemaakt > 0) {
      const { sendPushToUser } = await import("@/lib/push");
      const uniqueUsers = [...new Set(actieveRitten.map((r) => r.gebruikerId))];
      for (const uid of uniqueUsers) {
        await sendPushToUser(uid, {
          titel: "Ritten toegevoegd",
          bericht: `${aangemaakt} terugkerende rit(ten) automatisch gelogd`,
          url: "/kilometers",
          tag: "km-terugkerend",
        }).catch(() => {});
      }
    }

    return NextResponse.json({ aangemaakt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
