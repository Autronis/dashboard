import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, teamActiviteit, projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, sql, and, or, isNull, isNotNull, ne, like } from "drizzle-orm";
import { pushEventToGoogle, deleteGoogleEvent, updateGoogleEvent } from "@/lib/google-calendar";
import { inferClusterOwner } from "@/lib/cluster";

// PUT /api/taken/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    // Fetch current state for Google Calendar sync comparison
    const [huidig] = await db.select().from(taken).where(eq(taken.id, Number(id))).limit(1);

    // Task locking: als taak al toegewezen is aan iemand anders, blokkeer claim
    if (body.toegewezenAan !== undefined && huidig?.toegewezenAan && huidig.toegewezenAan !== gebruiker.id && body.toegewezenAan === gebruiker.id) {
      return NextResponse.json(
        { fout: "Deze taak is al opgepakt door iemand anders." },
        { status: 409 }
      );
    }

    // Als status naar "bezig" gaat en nog niet toegewezen, wijs automatisch toe
    if (body.status === "bezig" && !huidig?.toegewezenAan) {
      body.toegewezenAan = gebruiker.id;
    }


    // Anti-overlap: als de incoming start botst met een andere taak van dezelfde
    // eigenaar op dezelfde dag (Claude OF handmatig), schuif op naar het eind van
    // het laatste overlappende blok + 1 min. Als er géén botsing is, respecteer
    // de gekozen tijd exact (front-end/modal bepaalt de intentie).
    if (body.ingeplandStart) {
      const inkomendStart = new Date(body.ingeplandStart);
      if (!isNaN(inkomendStart.getTime())) {
        const inkomendEind = body.ingeplandEind
          ? new Date(body.ingeplandEind)
          : new Date(inkomendStart.getTime() + (Number(body.geschatteDuur ?? huidig?.geschatteDuur ?? 30)) * 60000);
        const duurMs = Math.max(5 * 60000, inkomendEind.getTime() - inkomendStart.getTime());
        const datumStr = (typeof body.ingeplandStart === "string" ? body.ingeplandStart : inkomendStart.toISOString()).slice(0, 10);
        const eigenaarId = (body.toegewezenAan ?? huidig?.toegewezenAan ?? gebruiker.id) as number;

        const bestaandeTaken = await db
          .select({ ingeplandStart: taken.ingeplandStart, ingeplandEind: taken.ingeplandEind })
          .from(taken)
          .where(
            and(
              isNotNull(taken.ingeplandStart),
              like(taken.ingeplandStart, `${datumStr}%`),
              ne(taken.id, Number(id)),
              or(eq(taken.toegewezenAan, eigenaarId), isNull(taken.toegewezenAan))
            )
          );

        // Check op overlap: incoming [start, eind) overlapt bestaande [s, e)
        let cursorStart = inkomendStart.getTime();
        let cursorEind = cursorStart + duurMs;
        let moved = false;
        // Max 20 iteraties om oneindige lussen te voorkomen
        for (let iter = 0; iter < 20; iter++) {
          const botsing = bestaandeTaken.find((t) => {
            const s = new Date(t.ingeplandStart!).getTime();
            const e = new Date(t.ingeplandEind || t.ingeplandStart!).getTime();
            return cursorStart < e && cursorEind > s;
          });
          if (!botsing) break;
          const botsingEind = new Date(botsing.ingeplandEind || botsing.ingeplandStart!).getTime();
          cursorStart = botsingEind + 60000; // 1 min buffer na het botsende blok
          cursorEind = cursorStart + duurMs;
          moved = true;
        }

        if (moved) {
          const pad = (n: number) => String(n).padStart(2, "0");
          const fmt = (d: Date) =>
            `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
          body.ingeplandStart = fmt(new Date(cursorStart));
          body.ingeplandEind = fmt(new Date(cursorEind));
        }
      }
    }

    const updateData: Record<string, unknown> = { bijgewerktOp: new Date().toISOString() };
    if (body.toegewezenAan !== undefined) updateData.toegewezenAan = body.toegewezenAan || null;
    if (body.titel !== undefined) updateData.titel = body.titel.trim();
    if (body.omschrijving !== undefined) updateData.omschrijving = body.omschrijving?.trim() || null;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.deadline !== undefined) updateData.deadline = body.deadline || null;
    if (body.prioriteit !== undefined) updateData.prioriteit = body.prioriteit;
    if (body.fase !== undefined) updateData.fase = body.fase || null;
    if (body.cluster !== undefined) {
      const nieuweCluster = body.cluster?.trim() || null;
      updateData.cluster = nieuweCluster;

      // Historische cluster-ownership toepassen als het cluster VERANDERT
      // (en alleen als de taak nog vrij is — we overschrijven geen expliciete
      // claim van de user zelf). Dit zorgt dat als Sem een taak labelt met
      // cluster=backend-infra terwijl Syb historisch eigenaar is van dat
      // (project, cluster) tuple, de taak direct aan Syb komt.
      const clusterVeranderd = nieuweCluster !== huidig?.cluster;
      const nogVrij = body.toegewezenAan === undefined && !huidig?.toegewezenAan;
      const doelProjectId = (body.projectId !== undefined ? body.projectId : huidig?.projectId) as number | null | undefined;
      if (clusterVeranderd && nieuweCluster && nogVrij && doelProjectId) {
        const historischEigenaar = await inferClusterOwner(doelProjectId, nieuweCluster);
        if (historischEigenaar) updateData.toegewezenAan = historischEigenaar;
      }
    }
    if (body.eigenaar !== undefined && ["sem", "syb", "team", "vrij"].includes(body.eigenaar)) {
      updateData.eigenaar = body.eigenaar;
    }
    if (body.volgorde !== undefined) updateData.volgorde = body.volgorde;
    if (body.uitvoerder !== undefined) updateData.uitvoerder = body.uitvoerder;
    if (body.prompt !== undefined) updateData.prompt = body.prompt?.trim() || null;
    if (body.projectId !== undefined) updateData.projectId = body.projectId || null;
    if (body.projectMap !== undefined) updateData.projectMap = body.projectMap || null;
    if (body.geschatteDuur !== undefined) updateData.geschatteDuur = body.geschatteDuur || null;
    if (body.ingeplandStart !== undefined) updateData.ingeplandStart = body.ingeplandStart || null;
    if (body.ingeplandEind !== undefined) updateData.ingeplandEind = body.ingeplandEind || null;
    if (body.kalenderId !== undefined) updateData.kalenderId = body.kalenderId || null;

    const [bijgewerkt] = await db
      .update(taken)
      .set(updateData)
      .where(eq(taken.id, Number(id)))
      .returning();

    if (!bijgewerkt) {
      return NextResponse.json({ fout: "Taak niet gevonden." }, { status: 404 });
    }

    // Log activiteit voor team awareness
    if (huidig) {
      let actieType: "taak_gepakt" | "taak_afgerond" | "taak_update" | "status_wijziging" = "taak_update";
      let bericht = `heeft "${bijgewerkt.titel}" bijgewerkt`;

      if (body.status === "bezig" && huidig.status !== "bezig") {
        actieType = "taak_gepakt";
        bericht = `is begonnen aan "${bijgewerkt.titel}"`;
      } else if (body.status === "afgerond" && huidig.status !== "afgerond") {
        actieType = "taak_afgerond";
        bericht = `heeft "${bijgewerkt.titel}" afgerond`;
      } else if (body.status !== undefined && body.status !== huidig.status) {
        actieType = "status_wijziging";
        bericht = `heeft "${bijgewerkt.titel}" op ${body.status} gezet`;
      } else if (body.toegewezenAan === gebruiker.id && huidig.toegewezenAan !== gebruiker.id) {
        actieType = "taak_gepakt";
        bericht = `heeft "${bijgewerkt.titel}" opgepakt`;
      }

      db.insert(teamActiviteit).values({
        gebruikerId: gebruiker.id,
        type: actieType,
        taakId: Number(id),
        projectId: huidig.projectId,
        bericht,
      }).execute().catch(() => {});
    }

    // Cluster propagation: wijs automatisch gerelateerde taken toe aan deze
    // gebruiker wanneer hij een taak actief maakt. "Actief maken" = status
    // naar 'bezig' zetten OF de taak in de agenda plannen (ingeplandStart).
    //
    // De groeperings-sleutel is ALLEEN een expliciete `cluster` value. Fase
    // werkt NIET als fallback — één fase kan meerdere clusters bevatten
    // (bv. fase 1 heeft zowel backend als frontend taken die niet bij
    // dezelfde persoon horen). Bij nieuwe projecten die door Claude worden
    // aangemaakt moeten taken DIRECT een expliciete cluster krijgen (zie
    // CLAUDE.md regel "Cluster bij nieuwe taken").
    //
    // Taken die al aan een ander zijn toegewezen blijven onaangeraakt
    // (soft lock — de frontend toont een warning dialog voordat de ander
    // ze alsnog probeert te pakken).
    const clusterNaam = bijgewerkt.cluster ?? null;
    const isNuBezig = body.status === "bezig" && huidig?.status !== "bezig";
    const isNuIngepland = body.ingeplandStart !== undefined && body.ingeplandStart && !huidig?.ingeplandStart;
    const isNuActief = isNuBezig || isNuIngepland;
    let propagatie: {
      aantal: number;
      groupLabel: string;
    } | null = null;

    if (isNuActief && bijgewerkt.projectId && clusterNaam) {
      const aanbevolen = await db
        .update(taken)
        .set({
          toegewezenAan: gebruiker.id,
          bijgewerktOp: new Date().toISOString(),
        })
        .where(
          and(
            eq(taken.projectId, bijgewerkt.projectId),
            eq(taken.cluster, clusterNaam),
            eq(taken.status, "open"),
            isNull(taken.toegewezenAan),
            ne(taken.id, Number(id))
          )
        )
        .returning({ id: taken.id });

      if (aanbevolen.length > 0) {
        propagatie = {
          aantal: aanbevolen.length,
          groupLabel: clusterNaam,
        };
        db.insert(teamActiviteit).values({
          gebruikerId: gebruiker.id,
          type: "taak_update",
          taakId: Number(id),
          projectId: bijgewerkt.projectId,
          bericht: `heeft cluster "${clusterNaam}" geclaimd (${aanbevolen.length} aanbevolen vervolgtaken)`,
          metadata: JSON.stringify({
            cluster: clusterNaam,
            aanbevolenTaakIds: aanbevolen.map((t) => t.id),
          }),
        }).execute().catch(() => {});
      }
    }

    // Sync with Google Calendar in the background — skip for status-only changes
    const isCalendarRelevant = body.deadline !== undefined || body.ingeplandStart !== undefined || body.ingeplandEind !== undefined || body.titel !== undefined;
    if (huidig && isCalendarRelevant) {
      const nieuweDeadline = (body.deadline !== undefined ? body.deadline : huidig.deadline) as string | null;
      const nieuweIngeplandStart = (body.ingeplandStart !== undefined ? body.ingeplandStart : huidig.ingeplandStart) as string | null;
      const nieuweIngeplandEind = (body.ingeplandEind !== undefined ? body.ingeplandEind : huidig.ingeplandEind) as string | null;
      const nieuweTitel = ((body.titel !== undefined ? body.titel : huidig.titel) as string).trim();
      const nieuweOmschrijving = (body.omschrijving !== undefined ? body.omschrijving : huidig.omschrijving) as string | null;

      // Deadline sync
      if (nieuweDeadline && huidig.googleEventId) {
        updateGoogleEvent(gebruiker.id, huidig.googleEventId, {
          summary: nieuweTitel,
          description: nieuweOmschrijving ?? undefined,
          start: nieuweDeadline,
          allDay: true,
        }).catch(() => {});
      } else if (nieuweDeadline && !huidig.googleEventId) {
        pushEventToGoogle(gebruiker.id, {
          summary: nieuweTitel,
          description: nieuweOmschrijving ?? undefined,
          start: nieuweDeadline,
          allDay: true,
        })
          .then(async (event) => {
            if (event?.id) {
              await db.update(taken).set({ googleEventId: event.id }).where(eq(taken.id, Number(id))).execute();
            }
          })
          .catch(() => {});
      } else if (!nieuweDeadline && huidig.googleEventId) {
        deleteGoogleEvent(gebruiker.id, huidig.googleEventId).catch(() => {});
        await db.update(taken).set({ googleEventId: null }).where(eq(taken.id, Number(id))).execute();
      }

      // Ingepland (planned block) sync
      const ingeplandChanged = body.ingeplandStart !== undefined || body.ingeplandEind !== undefined || body.titel !== undefined;
      if (ingeplandChanged) {
        if (nieuweIngeplandStart && huidig.googlePlanEventId) {
          updateGoogleEvent(gebruiker.id, huidig.googlePlanEventId, {
            summary: nieuweTitel,
            description: nieuweOmschrijving ?? undefined,
            start: nieuweIngeplandStart,
            end: nieuweIngeplandEind ?? undefined,
            allDay: false,
          }).catch(() => {});
        } else if (nieuweIngeplandStart && !huidig.googlePlanEventId) {
          pushEventToGoogle(gebruiker.id, {
            summary: nieuweTitel,
            description: nieuweOmschrijving ?? undefined,
            start: nieuweIngeplandStart,
            end: nieuweIngeplandEind ?? undefined,
            allDay: false,
          })
            .then(async (event) => {
              if (event?.id) {
                await db.update(taken).set({ googlePlanEventId: event.id }).where(eq(taken.id, Number(id))).execute();
              }
            })
            .catch(() => {});
        } else if (!nieuweIngeplandStart && huidig.googlePlanEventId) {
          deleteGoogleEvent(gebruiker.id, huidig.googlePlanEventId).catch(() => {});
          await db.update(taken).set({ googlePlanEventId: null }).where(eq(taken.id, Number(id))).execute();
        }
      }
    }

    // Auto-update project status when task status changes
    if (body.status !== undefined && bijgewerkt.projectId) {
      const stats = await db
        .select({
          totaal: sql<number>`COUNT(*)`,
          afgerond: sql<number>`SUM(CASE WHEN ${taken.status} = 'afgerond' THEN 1 ELSE 0 END)`,
        })
        .from(taken)
        .where(eq(taken.projectId, bijgewerkt.projectId))
        .get();

      if (stats && stats.totaal > 0) {
        const voortgang = Math.round(((stats.afgerond ?? 0) / stats.totaal) * 100);
        await db.update(projecten).set({
          voortgangPercentage: voortgang,
          status: voortgang >= 100 ? "afgerond" : "actief",
          bijgewerktOp: sql`(datetime('now'))`,
        }).where(eq(projecten.id, bijgewerkt.projectId));
      }
    }

    return NextResponse.json({ taak: bijgewerkt, propagatie });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/taken/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;

    // Fetch before deleting to get googleEventId
    const [taak] = await db.select().from(taken).where(eq(taken.id, Number(id))).limit(1);

    await db.delete(taken).where(eq(taken.id, Number(id)));

    // Remove from Google Calendar if linked
    if (taak?.googleEventId) {
      deleteGoogleEvent(gebruiker.id, taak.googleEventId).catch(() => {});
    }
    if (taak?.googlePlanEventId) {
      deleteGoogleEvent(gebruiker.id, taak.googlePlanEventId).catch(() => {});
    }

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
