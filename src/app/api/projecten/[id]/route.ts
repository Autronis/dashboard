import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projecten, klanten, taken, tijdregistraties, screenTimeEntries, notificaties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, sql, and, ne } from "drizzle-orm";

const VALID_EIGENAAR = new Set(["sem", "syb", "team", "vrij"]);

interface Fase {
  naam: string;
  taken: FaseTaak[];
  totaal: number;
  afgerond: number;
}

interface FaseTaak {
  id: number;
  titel: string;
  status: string;
  prioriteit: string;
  deadline: string | null;
  uitvoerder: string | null;
  bijgewerktOp: string | null;
}

// GET /api/projecten/[id] — Single project with tasks grouped by fase
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const projectId = parseInt(id, 10);

    if (isNaN(projectId)) {
      return NextResponse.json({ fout: "Ongeldig project ID" }, { status: 400 });
    }

    // Fetch project with client name
    const project = await db
      .select({
        id: projecten.id,
        naam: projecten.naam,
        omschrijving: projecten.omschrijving,
        klantId: projecten.klantId,
        klantNaam: klanten.bedrijfsnaam,
        status: projecten.status,
        voortgangPercentage: projecten.voortgangPercentage,
        deadline: projecten.deadline,
        geschatteUren: projecten.geschatteUren,
        werkelijkeUren: projecten.werkelijkeUren,
        eigenaar: projecten.eigenaar,
        aangemaaktOp: projecten.aangemaaktOp,
        bijgewerktOp: projecten.bijgewerktOp,
      })
      .from(projecten)
      .leftJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(eq(projecten.id, projectId))
      .get();

    if (!project) {
      return NextResponse.json({ fout: "Project niet gevonden" }, { status: 404 });
    }

    // Fetch all tasks for this project
    const alleTaken = await db
      .select({
        id: taken.id,
        titel: taken.titel,
        fase: taken.fase,
        status: taken.status,
        prioriteit: taken.prioriteit,
        deadline: taken.deadline,
        uitvoerder: taken.uitvoerder,
        volgorde: taken.volgorde,
        bijgewerktOp: taken.bijgewerktOp,
      })
      .from(taken)
      .where(eq(taken.projectId, projectId))
      .orderBy(taken.volgorde)
      .all();

    // Group tasks by fase
    const faseMap = new Map<string, FaseTaak[]>();
    for (const taak of alleTaken) {
      const faseNaam = taak.fase || "Overig";
      if (!faseMap.has(faseNaam)) faseMap.set(faseNaam, []);
      faseMap.get(faseNaam)!.push({
        id: taak.id,
        titel: taak.titel,
        status: taak.status ?? "open",
        prioriteit: taak.prioriteit ?? "normaal",
        deadline: taak.deadline,
        uitvoerder: taak.uitvoerder,
        bijgewerktOp: taak.bijgewerktOp,
      });
    }

    const fases: Fase[] = Array.from(faseMap.entries()).map(([naam, faseTaken]) => ({
      naam,
      taken: faseTaken,
      totaal: faseTaken.length,
      afgerond: faseTaken.filter((t) => t.status === "afgerond").length,
    }));

    // Get total time tracked from screen-time entries (productive activity)
    const PRODUCTIEF = ["development", "design", "administratie", "finance", "communicatie"];
    const urenStats = await db
      .select({
        totaalSeconden: sql<number>`COALESCE(SUM(${screenTimeEntries.duurSeconden}), 0)`,
      })
      .from(screenTimeEntries)
      .where(and(
        eq(screenTimeEntries.projectId, projectId),
        ne(screenTimeEntries.categorie, "inactief"),
        sql`${screenTimeEntries.categorie} IN (${sql.join(PRODUCTIEF.map(c => sql`${c}`), sql`, `)})`,
      ))
      .get();
    const totaalMinutenProject = Math.round((urenStats?.totaalSeconden ?? 0) / 60);

    // Task stats
    const totaalTaken = alleTaken.length;
    const afgerondTaken = alleTaken.filter((t) => t.status === "afgerond").length;
    const voortgang = totaalTaken > 0 ? Math.round((afgerondTaken / totaalTaken) * 100) : 0;

    return NextResponse.json({
      project: {
        ...project,
        totaalTaken,
        afgerondTaken,
        voortgang,
        totaalMinuten: totaalMinutenProject,
      },
      fases,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// PUT /api/projecten/[id] — Update project (status, isActief, naam, etc.)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ fout: "Ongeldig project ID" }, { status: 400 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if ("naam" in body && typeof body.naam === "string") updates.naam = body.naam.trim();
    if ("omschrijving" in body) updates.omschrijving = body.omschrijving;
    if ("status" in body) updates.status = body.status;
    if ("isActief" in body) updates.isActief = body.isActief ? 1 : 0;
    if ("klantId" in body) updates.klantId = body.klantId;
    if ("deadline" in body) updates.deadline = body.deadline;
    if ("voortgangPercentage" in body) updates.voortgangPercentage = body.voortgangPercentage;
    if ("eigenaar" in body && typeof body.eigenaar === "string" && VALID_EIGENAAR.has(body.eigenaar)) {
      updates.eigenaar = body.eigenaar;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ fout: "Geen velden om bij te werken" }, { status: 400 });
    }

    // Haal de huidige eigenaar op vóór de update zodat we kunnen detecteren
    // of er gewisseld is en zo nodig de andere persoon kunnen notificeren.
    const huidig = await db
      .select({ naam: projecten.naam, eigenaar: projecten.eigenaar })
      .from(projecten)
      .where(eq(projecten.id, projectId))
      .get();

    updates.bijgewerktOp = new Date().toISOString();

    const [bijgewerkt] = await db
      .update(projecten)
      .set(updates)
      .where(eq(projecten.id, projectId))
      .returning();

    // Notificatie bij eigenaarschap-wisseling. Sem=1, Syb=2.
    // We sturen alleen naar de andere user (niet naar jezelf), en alleen
    // als de wijziging zin heeft (overgang naar/van team of solo).
    if (huidig && updates.eigenaar && updates.eigenaar !== huidig.eigenaar) {
      const oud = huidig.eigenaar as string | null;
      const nieuw = updates.eigenaar as string;
      const naam = bijgewerkt.naam ?? huidig.naam;
      const ikId = gebruiker.id;
      const otherId = ikId === 1 ? 2 : 1;
      const ikNaam = ikId === 1 ? "Sem" : "Syb";
      const otherCode = otherId === 1 ? "sem" : "syb";

      // Kreeg de andere persoon nieuwe toegang? (was niet zichtbaar voor 'm)
      const wasVisible = oud === "team" || oud === "vrij" || oud === otherCode;
      const isVisible = nieuw === "team" || nieuw === "vrij" || nieuw === otherCode;

      if (!wasVisible && isVisible) {
        await db.insert(notificaties).values({
          gebruikerId: otherId,
          type: "project_toegewezen",
          titel: `${ikNaam} heeft je toegevoegd aan ${naam}`,
          omschrijving: `Project zichtbaarheid is gewijzigd naar ${nieuw === "team" ? "team" : nieuw === "vrij" ? "vrij (open)" : nieuw}.`,
          link: `/projecten/${projectId}`,
        }).catch(() => {});
      } else if (wasVisible && !isVisible) {
        await db.insert(notificaties).values({
          gebruikerId: otherId,
          type: "project_toegewezen",
          titel: `${ikNaam} heeft ${naam} weer solo gemaakt`,
          omschrijving: `Project is niet meer zichtbaar in jouw overzicht.`,
          link: null,
        }).catch(() => {});
      }
    }

    return NextResponse.json({ project: bijgewerkt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/projecten/[id] — Soft delete (isActief=0) or hard delete with ?hard=true
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ fout: "Ongeldig project ID" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const hard = searchParams.get("hard") === "true";

    // Get project info for the response (local folder cleanup hint)
    const project = await db
      .select({ id: projecten.id, naam: projecten.naam })
      .from(projecten)
      .where(eq(projecten.id, projectId))
      .get();

    if (!project) {
      return NextResponse.json({ fout: "Project niet gevonden" }, { status: 404 });
    }

    if (hard) {
      // Hard delete: remove tasks and time entries first, then project
      await db.delete(taken).where(eq(taken.projectId, projectId)).run();
      await db.delete(tijdregistraties).where(eq(tijdregistraties.projectId, projectId)).run();
      await db.delete(projecten).where(eq(projecten.id, projectId)).run();
    } else {
      // Soft delete: just flip isActief
      await db
        .update(projecten)
        .set({ isActief: 0, status: "afgerond", bijgewerktOp: new Date().toISOString() })
        .where(eq(projecten.id, projectId))
        .run();
    }

    return NextResponse.json({
      succes: true,
      hardDelete: hard,
      project: { id: project.id, naam: project.naam },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
