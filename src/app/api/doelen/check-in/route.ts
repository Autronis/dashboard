import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { okrCheckIns, okrObjectives } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, desc } from "drizzle-orm";

function getWeekNumber(): { week: number; jaar: number } {
  const now = new Date();
  const oneJan = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
  return { week: Math.ceil((days + oneJan.getDay() + 1) / 7), jaar: now.getFullYear() };
}

// GET /api/doelen/check-in?objectiveId=X — get check-ins for an objective
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const objectiveId = Number(searchParams.get("objectiveId"));

    if (!objectiveId) {
      return NextResponse.json({ fout: "objectiveId is verplicht" }, { status: 400 });
    }

    const checkIns = db
      .select()
      .from(okrCheckIns)
      .where(eq(okrCheckIns.objectiveId, objectiveId))
      .orderBy(desc(okrCheckIns.aangemaaktOp))
      .limit(10)
      .all();

    return NextResponse.json({ checkIns });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/doelen/check-in — create weekly check-in
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json() as {
      objectiveId: number;
      voortgang: number;
      blocker?: string;
      volgendeStap?: string;
      notities?: string;
    };

    if (!body.objectiveId) {
      return NextResponse.json({ fout: "objectiveId is verplicht" }, { status: 400 });
    }

    // Verify objective exists
    const objective = db
      .select()
      .from(okrObjectives)
      .where(eq(okrObjectives.id, body.objectiveId))
      .get();

    if (!objective) {
      return NextResponse.json({ fout: "Doel niet gevonden" }, { status: 404 });
    }

    const { week, jaar } = getWeekNumber();

    // Check if check-in already exists for this week
    const existing = db
      .select()
      .from(okrCheckIns)
      .where(
        and(
          eq(okrCheckIns.objectiveId, body.objectiveId),
          eq(okrCheckIns.week, week),
          eq(okrCheckIns.jaar, jaar)
        )
      )
      .get();

    if (existing) {
      // Update existing check-in
      db.update(okrCheckIns)
        .set({
          voortgang: body.voortgang,
          blocker: body.blocker?.trim() || null,
          volgendeStap: body.volgendeStap?.trim() || null,
          notities: body.notities?.trim() || null,
        })
        .where(eq(okrCheckIns.id, existing.id))
        .run();

      return NextResponse.json({ checkIn: { ...existing, ...body } });
    }

    // Create new check-in
    const result = db
      .insert(okrCheckIns)
      .values({
        objectiveId: body.objectiveId,
        voortgang: body.voortgang,
        blocker: body.blocker?.trim() || null,
        volgendeStap: body.volgendeStap?.trim() || null,
        notities: body.notities?.trim() || null,
        week,
        jaar,
        aangemaaktDoor: gebruiker.id,
      })
      .returning()
      .all();
    const checkIn = result[0];

    return NextResponse.json({ checkIn }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
