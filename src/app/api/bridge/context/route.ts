import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { klanten, leads, projecten } from "@/lib/db/schema";
import { requireAuthOrApiKey } from "@/lib/auth";
import { and, eq, inArray, desc, sql } from "drizzle-orm";

// GET /api/bridge/context?user=sem
//
// Aggregate context voor de plan-avond bridge. Bundelt de rauwe data die
// Atlas/Autro nodig hebben om concrete slimme acties te genereren met échte
// namen (klant X, lead Y) in plaats van placeholders.
//
// De bridge query's (/api/klant-leads, /api/klanten) draaien onder requireAuth
// en zijn daarom niet bereikbaar voor het script. Deze endpoint is bridge-only,
// heeft API-key auth, en returnt exact de velden die de prompt nodig heeft
// (compact, geen ongebruikt veld — context-window is duur).
export async function GET(req: NextRequest) {
  try {
    await requireAuthOrApiKey(req);

    const { searchParams } = new URL(req.url);
    const user = searchParams.get("user"); // sem | syb — filtert klanten/projecten; leads zijn gedeelde pipeline

    // Leads in actief pitch-bare stadia: nieuw + contact. Leads in `offerte`
    // worden NIET in de pipeline getoond — die wachten op reactie van de
    // prospect. De bridge mag ze niet opnieuw pitchen; dat is dubbel werk.
    // Zodra de prospect reageert zet Sem lead terug naar `contact` (of direct
    // `gewonnen`/`verloren`). Gewonnen/verloren negeren uberhaupt.
    const leadsActief = await db
      .select({
        id: leads.id,
        bedrijfsnaam: leads.bedrijfsnaam,
        contactpersoon: leads.contactpersoon,
        status: leads.status,
        waarde: leads.waarde,
        volgendeActie: leads.volgendeActie,
        volgendeActieDatum: leads.volgendeActieDatum,
      })
      .from(leads)
      .where(and(eq(leads.isActief, 1), inArray(leads.status, ["nieuw", "contact"])))
      .orderBy(
        sql`CASE ${leads.status} WHEN 'contact' THEN 0 WHEN 'nieuw' THEN 1 END`,
        desc(leads.bijgewerktOp)
      )
      .limit(20);

    // Actieve klanten met lopend werk (projecten actief). Voor de context wil de
    // bridge alleen weten "wie zijn de huidige klanten en wat is hun branche",
    // niet de volledige row met notities/adres.
    const klantenActief = await db
      .select({
        id: klanten.id,
        bedrijfsnaam: klanten.bedrijfsnaam,
        branche: klanten.branche,
        contactpersoon: klanten.contactpersoon,
      })
      .from(klanten)
      .where(and(eq(klanten.isActief, 1), eq(klanten.type, "klant")))
      .limit(40);

    // Lopende projecten. Eigenaar-filter zodat Atlas niet Syb's solo werk ziet
    // (en vice versa). Team/vrij projecten zijn altijd zichtbaar.
    const projConditions = [eq(projecten.isActief, 1), eq(projecten.status, "actief")];
    if (user === "sem" || user === "syb") {
      projConditions.push(inArray(projecten.eigenaar, [user, "team", "vrij"]));
    }
    const projectenLopend = await db
      .select({
        id: projecten.id,
        naam: projecten.naam,
        klantId: projecten.klantId,
        klantNaam: klanten.bedrijfsnaam,
        eigenaar: projecten.eigenaar,
        deadline: projecten.deadline,
        voortgangPercentage: projecten.voortgangPercentage,
      })
      .from(projecten)
      .leftJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(and(...projConditions))
      .orderBy(desc(projecten.bijgewerktOp))
      .limit(30);

    return NextResponse.json({
      leads_pipeline: leadsActief,
      klanten_actief: klantenActief,
      projecten_lopend: projectenLopend,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
