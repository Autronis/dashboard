import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { okrObjectives, okrKeyResults, facturen, taken, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, sql, gte, lt } from "drizzle-orm";
import { berekenActieveUren } from "@/lib/screen-time-uren";

function getQuarterDateRange(kwartaal: number, jaar: number): { start: string; end: string } {
  const startMonth = (kwartaal - 1) * 3;
  const start = `${jaar}-${String(startMonth + 1).padStart(2, "0")}-01`;
  const endMonth = startMonth + 3;
  const end = endMonth > 12
    ? `${jaar + 1}-01-01`
    : `${jaar}-${String(endMonth + 1).padStart(2, "0")}-01`;
  return { start, end };
}

async function calculateAutoValue(
  koppeling: string,
  kwartaal: number,
  jaar: number,
  gebruikerId: number
): Promise<number> {
  const { start, end } = getQuarterDateRange(kwartaal, jaar);

  switch (koppeling) {
    case "omzet": {
      const result = await db
        .select({ total: sql<number>`COALESCE(SUM(${facturen.bedragExclBtw}), 0)` })
        .from(facturen)
        .where(
          and(
            eq(facturen.status, "betaald"),
            gte(facturen.betaaldOp, start),
            lt(facturen.betaaldOp, end)
          )
        );
      return result[0]?.total ?? 0;
    }
    case "uren": {
      // Use screen time (same source as Tijd page) filtered to current user
      // end is exclusive (e.g. "2026-04-01"), subtract 1 day for inclusive range
      const endDatum = new Date(end);
      endDatum.setDate(endDatum.getDate() - 1);
      const uren = await berekenActieveUren(gebruikerId, start, endDatum.toISOString().slice(0, 10));
      return Math.round(uren * 10) / 10;
    }
    case "taken": {
      const result = await db
        .select({ total: sql<number>`COUNT(*)` })
        .from(taken)
        .where(
          and(
            eq(taken.status, "afgerond"),
            gte(taken.bijgewerktOp, start),
            lt(taken.bijgewerktOp, end)
          )
        );
      return result[0]?.total ?? 0;
    }
    case "klanten": {
      const result = await db
        .select({ total: sql<number>`COUNT(*)` })
        .from(klanten)
        .where(
          and(
            gte(klanten.aangemaaktOp, start),
            lt(klanten.aangemaaktOp, end)
          )
        );
      return result[0]?.total ?? 0;
    }
    default:
      return 0;
  }
}

// GET /api/doelen — list objectives with key results
export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { searchParams } = new URL(req.url);
    const kwartaal = Number(searchParams.get("kwartaal") || Math.ceil((new Date().getMonth() + 1) / 3));
    const jaar = Number(searchParams.get("jaar") || new Date().getFullYear());

    const objectives = await db
      .select()
      .from(okrObjectives)
      .where(
        and(
          eq(okrObjectives.kwartaal, kwartaal),
          eq(okrObjectives.jaar, jaar)
        )
      );

    const objectivesWithKrs = await Promise.all(
      objectives.map(async (obj) => {
        const krs = await db
          .select()
          .from(okrKeyResults)
          .where(eq(okrKeyResults.objectiveId, obj.id));

        const enrichedKrs = await Promise.all(
          krs.map(async (kr) => {
            if (kr.autoKoppeling && kr.autoKoppeling !== "geen") {
              const autoWaarde = await calculateAutoValue(kr.autoKoppeling, kwartaal, jaar, gebruiker.id);
              // Update the stored value
              await db
                .update(okrKeyResults)
                .set({ huidigeWaarde: autoWaarde })
                .where(eq(okrKeyResults.id, kr.id));
              return { ...kr, huidigeWaarde: autoWaarde };
            }
            return kr;
          })
        );

        // Calculate overall progress
        const voortgang = enrichedKrs.length > 0
          ? enrichedKrs.reduce((sum, kr) => {
              const pct = kr.doelwaarde > 0
                ? Math.min((kr.huidigeWaarde ?? 0) / kr.doelwaarde * 100, 100)
                : 0;
              return sum + pct;
            }, 0) / enrichedKrs.length
          : 0;

        return {
          ...obj,
          keyResults: enrichedKrs,
          voortgang: Math.round(voortgang * 10) / 10,
        };
      })
    );

    return NextResponse.json({ doelen: objectivesWithKrs });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/doelen — create objective with key results
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json() as {
      titel: string;
      omschrijving?: string;
      eigenaarId?: number;
      kwartaal: number;
      jaar: number;
      keyResults: {
        titel: string;
        doelwaarde: number;
        eenheid?: string;
        autoKoppeling?: string;
      }[];
    };

    if (!body.titel?.trim()) {
      return NextResponse.json({ fout: "Titel is verplicht." }, { status: 400 });
    }

    const [objective] = await db
      .insert(okrObjectives)
      .values({
        titel: body.titel.trim(),
        omschrijving: body.omschrijving?.trim() || null,
        eigenaarId: body.eigenaarId || null,
        kwartaal: body.kwartaal,
        jaar: body.jaar,
        status: "actief",
      })
      .returning();

    const keyResults = [];
    if (body.keyResults && body.keyResults.length > 0) {
      for (const kr of body.keyResults) {
        const [inserted] = await db
          .insert(okrKeyResults)
          .values({
            objectiveId: objective.id,
            titel: kr.titel.trim(),
            doelwaarde: kr.doelwaarde,
            huidigeWaarde: 0,
            eenheid: kr.eenheid || null,
            autoKoppeling: (kr.autoKoppeling as "omzet" | "uren" | "taken" | "klanten" | "geen") || "geen",
          })
          .returning();
        keyResults.push(inserted);
      }
    }

    return NextResponse.json(
      { doel: { ...objective, keyResults } },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
