import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dagritme, taken, agendaItems } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, desc, like } from "drizzle-orm";

// GET /api/dagritme?datum=YYYY-MM-DD
export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { searchParams } = new URL(req.url);
    const datum = searchParams.get("datum") ?? new Date().toISOString().slice(0, 10);

    // Today's check-ins
    const records = await db
      .select()
      .from(dagritme)
      .where(and(eq(dagritme.gebruikerId, gebruiker.id), eq(dagritme.datum, datum)))
      .orderBy(desc(dagritme.aangemaaktOp));

    const ochtend = records.find((r) => r.type === "ochtend") ?? null;
    const avond = records.find((r) => r.type === "avond") ?? null;

    // Open high-priority taken (suggestions for priorities)
    const openTaken = await db
      .select({ id: taken.id, titel: taken.titel, prioriteit: taken.prioriteit, deadline: taken.deadline })
      .from(taken)
      .where(and(eq(taken.status, "open"), eq(taken.toegewezenAan, gebruiker.id)))
      .limit(20);

    // Sort: hoog first, then normaal, then deadline soonest
    openTaken.sort((a, b) => {
      const prio = { hoog: 0, normaal: 1, laag: 2 };
      const pa = prio[a.prioriteit as keyof typeof prio] ?? 1;
      const pb = prio[b.prioriteit as keyof typeof prio] ?? 1;
      if (pa !== pb) return pa - pb;
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    });

    // Today's meetings from agenda
    const vandaagMeetings = await db
      .select({ id: agendaItems.id, titel: agendaItems.titel, startDatum: agendaItems.startDatum, eindDatum: agendaItems.eindDatum })
      .from(agendaItems)
      .where(and(
        like(agendaItems.startDatum, `${datum}%`),
        eq(agendaItems.gebruikerId, gebruiker.id),
      ))
      .limit(10);

    // Recent history (last 7 days)
    const history = await db
      .select({ datum: dagritme.datum, type: dagritme.type, stemming: dagritme.stemming, energie: dagritme.energie })
      .from(dagritme)
      .where(eq(dagritme.gebruikerId, gebruiker.id))
      .orderBy(desc(dagritme.datum))
      .limit(14);

    return NextResponse.json({ ochtend, avond, openTaken: openTaken.slice(0, 10), vandaagMeetings, history });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/dagritme
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json() as {
      type: "ochtend" | "avond" | "week";
      datum?: string;
      stemming?: number;
      intentie?: string;
      prioriteiten?: Array<{ id?: number; titel: string; gedaan?: boolean }>;
      voltooide_taken?: string[];
      reflectie?: string;
      verschuivingen?: string[];
      energie?: number;
    };

    const datum = body.datum ?? new Date().toISOString().slice(0, 10);

    // Upsert: delete existing of same type+datum first
    await db
      .delete(dagritme)
      .where(and(
        eq(dagritme.gebruikerId, gebruiker.id),
        eq(dagritme.datum, datum),
        eq(dagritme.type, body.type),
      ));

    const [record] = await db.insert(dagritme).values({
      gebruikerId: gebruiker.id,
      datum,
      type: body.type,
      stemming: body.stemming ?? null,
      intentie: body.intentie ?? null,
      prioriteiten: body.prioriteiten ? JSON.stringify(body.prioriteiten) : null,
      voltooide_taken: body.voltooide_taken ? JSON.stringify(body.voltooide_taken) : null,
      reflectie: body.reflectie ?? null,
      verschuivingen: body.verschuivingen ? JSON.stringify(body.verschuivingen) : null,
      energie: body.energie ?? null,
    }).returning();

    return NextResponse.json({ record });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
