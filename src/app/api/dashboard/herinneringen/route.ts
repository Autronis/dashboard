import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, leadActiviteiten, projecten, klanten, screenTimeEntries } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, ne, sql, desc, max } from "drizzle-orm";

interface Herinnering {
  id: string;
  type: "lead_inactief" | "project_geen_uren";
  titel: string;
  omschrijving: string;
  urgentie: "laag" | "normaal" | "hoog";
}

// GET /api/dashboard/herinneringen — slimme herinneringen
export async function GET() {
  try {
    await requireAuth();
    const herinneringen: Herinnering[] = [];
    const vandaag = new Date();
    const vandaagStr = vandaag.toISOString().slice(0, 10);

    // 1. Leads zonder activiteit > 7 dagen
    const actieveLeads = await db
      .select({
        id: leads.id,
        bedrijfsnaam: leads.bedrijfsnaam,
        status: leads.status,
        aangemaaktOp: leads.aangemaaktOp,
      })
      .from(leads)
      .where(
        and(
          eq(leads.isActief, 1),
          sql`${leads.status} NOT IN ('gewonnen', 'verloren')`
        )
      );

    for (const lead of actieveLeads) {
      // Laatste activiteit
      const [laatsteActiviteit] = await db
        .select({
          aangemaaktOp: max(leadActiviteiten.aangemaaktOp),
        })
        .from(leadActiviteiten)
        .where(eq(leadActiviteiten.leadId, lead.id));

      const laatsteDatum = laatsteActiviteit?.aangemaaktOp
        ? new Date(laatsteActiviteit.aangemaaktOp)
        : lead.aangemaaktOp
        ? new Date(lead.aangemaaktOp)
        : null;

      if (laatsteDatum) {
        const diffDagen = Math.floor(
          (vandaag.getTime() - laatsteDatum.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diffDagen > 7) {
          herinneringen.push({
            id: `lead-${lead.id}`,
            type: "lead_inactief",
            titel: `${diffDagen} dagen geen activiteit op ${lead.bedrijfsnaam}`,
            omschrijving: `De lead "${lead.bedrijfsnaam}" (${lead.status}) heeft al ${diffDagen} dagen geen activiteit gehad.`,
            urgentie: diffDagen > 14 ? "hoog" : "normaal",
          });
        }
      }
    }

    // 2. Projecten zonder tijdregistraties > 3 dagen met naderende deadline
    const veertienDagenVooruit = new Date(vandaag);
    veertienDagenVooruit.setDate(veertienDagenVooruit.getDate() + 14);
    const veertienDagenStr = veertienDagenVooruit.toISOString().slice(0, 10);

    const actieveProjecten = await db
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
          sql`${projecten.deadline} >= ${vandaagStr}`,
          sql`${projecten.deadline} <= ${veertienDagenStr}`
        )
      );

    for (const project of actieveProjecten) {
      // Last screen-time activity on this project
      const [laatsteTijd] = await db
        .select({
          startTijd: max(screenTimeEntries.startTijd),
        })
        .from(screenTimeEntries)
        .where(and(
          eq(screenTimeEntries.projectId, project.id),
          ne(screenTimeEntries.categorie, "inactief"),
        ));

      const laatsteRegistratie = laatsteTijd?.startTijd
        ? new Date(laatsteTijd.startTijd)
        : null;

      const diffDagen = laatsteRegistratie
        ? Math.floor(
            (vandaag.getTime() - laatsteRegistratie.getTime()) / (1000 * 60 * 60 * 24)
          )
        : 999;

      if (diffDagen > 3) {
        const deadlineDagen = project.deadline
          ? Math.floor(
              (new Date(project.deadline).getTime() - vandaag.getTime()) / (1000 * 60 * 60 * 24)
            )
          : null;

        herinneringen.push({
          id: `project-${project.id}`,
          type: "project_geen_uren",
          titel: `Geen uren op ${project.naam}`,
          omschrijving: `Project "${project.naam}" (${project.klantNaam}) heeft ${diffDagen > 100 ? "nog geen" : `${diffDagen} dagen geen`} tijdregistraties${deadlineDagen !== null ? `, deadline over ${deadlineDagen} dagen` : ""}.`,
          urgentie: deadlineDagen !== null && deadlineDagen <= 3 ? "hoog" : "normaal",
        });
      }
    }

    // Sorteer op urgentie (hoog eerst)
    herinneringen.sort((a, b) => {
      const urgentieOrder = { hoog: 0, normaal: 1, laag: 2 };
      return urgentieOrder[a.urgentie] - urgentieOrder[b.urgentie];
    });

    return NextResponse.json({ herinneringen });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
