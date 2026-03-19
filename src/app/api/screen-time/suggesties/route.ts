import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { screenTimeSuggesties, tijdregistraties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status") || "openstaand";
    const geldigeStatussen = ["openstaand", "goedgekeurd", "afgewezen"] as const;
    type SuggestieStatus = (typeof geldigeStatussen)[number];

    if (!geldigeStatussen.includes(status as SuggestieStatus)) {
      return NextResponse.json(
        { fout: "Ongeldige status filter" },
        { status: 400 }
      );
    }

    const suggesties = await db
      .select()
      .from(screenTimeSuggesties)
      .where(
        and(
          eq(screenTimeSuggesties.gebruikerId, gebruiker.id),
          eq(screenTimeSuggesties.status, status as SuggestieStatus)
        )
      )
      .orderBy(desc(screenTimeSuggesties.aangemaaktOp))
      .all();

    return NextResponse.json({ suggesties });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();
    const { id, status } = body as { id: number; status: string };

    if (!id || !status) {
      return NextResponse.json(
        { fout: "id en status zijn verplicht" },
        { status: 400 }
      );
    }

    const geldigeStatussen = ["goedgekeurd", "afgewezen"] as const;
    type UpdateStatus = (typeof geldigeStatussen)[number];

    if (!geldigeStatussen.includes(status as UpdateStatus)) {
      return NextResponse.json(
        { fout: "Status moet 'goedgekeurd' of 'afgewezen' zijn" },
        { status: 400 }
      );
    }

    const suggestie = await db
      .select()
      .from(screenTimeSuggesties)
      .where(eq(screenTimeSuggesties.id, id))
      .get();

    if (!suggestie) {
      return NextResponse.json(
        { fout: "Suggestie niet gevonden" },
        { status: 404 }
      );
    }

    if (suggestie.gebruikerId !== gebruiker.id) {
      return NextResponse.json(
        { fout: "Geen toegang tot deze suggestie" },
        { status: 403 }
      );
    }

    if (suggestie.status !== "openstaand") {
      return NextResponse.json(
        { fout: "Suggestie is al verwerkt" },
        { status: 400 }
      );
    }

    await db.update(screenTimeSuggesties)
      .set({
        status: status as UpdateStatus,
        verwerktOp: new Date().toISOString(),
      })
      .where(eq(screenTimeSuggesties.id, id))
      .run();

    if (status === "goedgekeurd" && suggestie.type === "tijdregistratie") {
      let voorstelData: {
        projectId?: number;
        omschrijving?: string;
        categorie?: "development" | "meeting" | "administratie" | "overig";
      };

      try {
        voorstelData = JSON.parse(suggestie.voorstel) as typeof voorstelData;
      } catch {
        return NextResponse.json(
          { fout: "Ongeldig voorstel formaat" },
          { status: 400 }
        );
      }

      const overlapping = await db
        .select({ id: tijdregistraties.id })
        .from(tijdregistraties)
        .where(
          and(
            eq(tijdregistraties.gebruikerId, gebruiker.id),
            lte(tijdregistraties.startTijd, suggestie.eindTijd),
            gte(tijdregistraties.eindTijd!, suggestie.startTijd)
          )
        )
        .get();

      if (overlapping) {
        await db.update(screenTimeSuggesties)
          .set({ status: "openstaand", verwerktOp: null })
          .where(eq(screenTimeSuggesties.id, id))
          .run();

        return NextResponse.json(
          { fout: "Er is een overlappende tijdregistratie gevonden" },
          { status: 409 }
        );
      }

      const startMs = new Date(suggestie.startTijd).getTime();
      const eindMs = new Date(suggestie.eindTijd).getTime();
      const duurMinuten = Math.round((eindMs - startMs) / 60000);

      await db.insert(tijdregistraties)
        .values({
          gebruikerId: gebruiker.id,
          projectId: voorstelData.projectId ?? null,
          omschrijving: voorstelData.omschrijving ?? null,
          startTijd: suggestie.startTijd,
          eindTijd: suggestie.eindTijd,
          duurMinuten,
          categorie: voorstelData.categorie ?? "development",
          isHandmatig: 0,
        })
        .run();
    }

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
