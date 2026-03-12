import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificaties, facturen, klanten, projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, lt, sql, like } from "drizzle-orm";

// POST /api/notificaties/genereer — genereer notificaties automatisch
export async function POST() {
  try {
    const gebruiker = await requireAuth();
    const vandaag = new Date().toISOString().slice(0, 10);
    let aangemaakt = 0;

    // 1. Facturen te laat: status=verzonden en vervaldatum < vandaag
    const teLaatFacturen = await db
      .select({
        id: facturen.id,
        factuurnummer: facturen.factuurnummer,
        klantNaam: klanten.bedrijfsnaam,
        vervaldatum: facturen.vervaldatum,
      })
      .from(facturen)
      .innerJoin(klanten, eq(facturen.klantId, klanten.id))
      .where(
        and(
          eq(facturen.status, "verzonden"),
          eq(facturen.isActief, 1),
          lt(facturen.vervaldatum, vandaag)
        )
      );

    for (const factuur of teLaatFacturen) {
      // Check of notificatie al bestaat
      const [bestaand] = await db
        .select({ id: notificaties.id })
        .from(notificaties)
        .where(
          and(
            eq(notificaties.gebruikerId, gebruiker.id),
            eq(notificaties.type, "factuur_te_laat"),
            like(notificaties.titel, `%${factuur.factuurnummer}%`)
          )
        )
        .limit(1);

      if (!bestaand) {
        await db.insert(notificaties).values({
          gebruikerId: gebruiker.id,
          type: "factuur_te_laat",
          titel: `Factuur ${factuur.factuurnummer} is te laat`,
          omschrijving: `Factuur voor ${factuur.klantNaam} had betaald moeten zijn op ${factuur.vervaldatum}`,
          link: `/financien/${factuur.id}`,
        });
        aangemaakt++;
      }
    }

    // 2. Deadlines die naderen (projecten met deadline binnen 3 dagen)
    const drieDAgenVooruit = new Date();
    drieDAgenVooruit.setDate(drieDAgenVooruit.getDate() + 3);
    const drieDAgenStr = drieDAgenVooruit.toISOString().slice(0, 10);

    const naderendeDeadlines = await db
      .select({
        id: projecten.id,
        naam: projecten.naam,
        klantNaam: klanten.bedrijfsnaam,
        deadline: projecten.deadline,
      })
      .from(projecten)
      .innerJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(
        and(
          eq(projecten.isActief, 1),
          eq(projecten.status, "actief"),
          sql`${projecten.deadline} IS NOT NULL`,
          sql`${projecten.deadline} >= ${vandaag}`,
          sql`${projecten.deadline} <= ${drieDAgenStr}`
        )
      );

    for (const project of naderendeDeadlines) {
      const [bestaand] = await db
        .select({ id: notificaties.id })
        .from(notificaties)
        .where(
          and(
            eq(notificaties.gebruikerId, gebruiker.id),
            eq(notificaties.type, "deadline_nadert"),
            like(notificaties.titel, `%${project.naam}%`),
            sql`date(${notificaties.aangemaaktOp}) = ${vandaag}`
          )
        )
        .limit(1);

      if (!bestaand) {
        await db.insert(notificaties).values({
          gebruikerId: gebruiker.id,
          type: "deadline_nadert",
          titel: `Deadline nadert: ${project.naam}`,
          omschrijving: `Project voor ${project.klantNaam} heeft deadline op ${project.deadline}`,
          link: `/klanten/${project.id}`,
        });
        aangemaakt++;
      }
    }

    // 3. Recent betaalde facturen (betaald_op vandaag)
    const betaaldeFacturen = await db
      .select({
        id: facturen.id,
        factuurnummer: facturen.factuurnummer,
        klantNaam: klanten.bedrijfsnaam,
        bedragInclBtw: facturen.bedragInclBtw,
      })
      .from(facturen)
      .innerJoin(klanten, eq(facturen.klantId, klanten.id))
      .where(
        and(
          eq(facturen.status, "betaald"),
          sql`date(${facturen.betaaldOp}) = ${vandaag}`
        )
      );

    for (const factuur of betaaldeFacturen) {
      const [bestaand] = await db
        .select({ id: notificaties.id })
        .from(notificaties)
        .where(
          and(
            eq(notificaties.gebruikerId, gebruiker.id),
            eq(notificaties.type, "factuur_betaald"),
            like(notificaties.titel, `%${factuur.factuurnummer}%`)
          )
        )
        .limit(1);

      if (!bestaand) {
        const bedragStr = factuur.bedragInclBtw
          ? new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(factuur.bedragInclBtw)
          : "";
        await db.insert(notificaties).values({
          gebruikerId: gebruiker.id,
          type: "factuur_betaald",
          titel: `Factuur ${factuur.factuurnummer} is betaald`,
          omschrijving: `${factuur.klantNaam} heeft ${bedragStr} betaald`,
          link: `/financien/${factuur.id}`,
        });
        aangemaakt++;
      }
    }

    return NextResponse.json({ succes: true, aangemaakt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
