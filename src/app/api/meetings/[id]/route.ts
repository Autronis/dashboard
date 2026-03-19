import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { meetings, klanten, projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { unlink, writeFile, mkdir } from "fs/promises";
import path from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;

    const meeting = await db
      .select({
        id: meetings.id,
        titel: meetings.titel,
        datum: meetings.datum,
        duurMinuten: meetings.duurMinuten,
        status: meetings.status,
        klantId: meetings.klantId,
        projectId: meetings.projectId,
        klantNaam: klanten.bedrijfsnaam,
        projectNaam: projecten.naam,
        audioPad: meetings.audioPad,
        transcript: meetings.transcript,
        samenvatting: meetings.samenvatting,
        actiepunten: meetings.actiepunten,
        besluiten: meetings.besluiten,
        openVragen: meetings.openVragen,
        sentiment: meetings.sentiment,
        tags: meetings.tags,
        aangemaaktDoor: meetings.aangemaaktDoor,
        aangemaaktOp: meetings.aangemaaktOp,
      })
      .from(meetings)
      .leftJoin(klanten, eq(meetings.klantId, klanten.id))
      .leftJoin(projecten, eq(meetings.projectId, projecten.id))
      .where(eq(meetings.id, Number(id)))
      .get();

    if (!meeting) {
      return NextResponse.json(
        { fout: "Meeting niet gevonden" },
        { status: 404 }
      );
    }

    return NextResponse.json({ meeting });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    if (message === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: message }, { status: 401 });
    }
    return NextResponse.json({ fout: message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();

    const { id } = await params;
    const meetingId = Number(id);
    const body = (await req.json()) as {
      notities?: string;
      titel?: string;
      calendarImport?: boolean;
      datum?: string;
      meetingUrl?: string;
      deelnemers?: Array<{ naam: string | null; email: string }>;
    };

    // If this is a calendar-imported meeting being saved for the first time
    if (body.calendarImport && body.titel && body.datum) {
      // Check if we already have this meeting in DB
      const existing = await db
        .select({ id: meetings.id })
        .from(meetings)
        .where(eq(meetings.id, meetingId))
        .get();

      if (!existing) {
        // Create new DB record for calendar meeting
        const result = await db
          .insert(meetings)
          .values({
            titel: body.titel,
            datum: body.datum,
            samenvatting: body.notities || null,
            status: "klaar",
            aangemaaktDoor: gebruiker.id,
          })
          .run();

        const newMeeting = await db
          .select()
          .from(meetings)
          .where(eq(meetings.id, Number(result.lastInsertRowid)))
          .get();

        return NextResponse.json({ meeting: newMeeting }, { status: 201 });
      }
    }

    const meeting = await db
      .select({ id: meetings.id })
      .from(meetings)
      .where(eq(meetings.id, meetingId))
      .get();

    if (!meeting) {
      return NextResponse.json(
        { fout: "Meeting niet gevonden" },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (body.notities !== undefined) updates.samenvatting = body.notities;
    if (body.titel !== undefined) updates.titel = body.titel;

    if (Object.keys(updates).length > 0) {
      await db.update(meetings)
        .set(updates)
        .where(eq(meetings.id, meetingId))
        .run();
    }

    const updated = await db
      .select({
        id: meetings.id,
        titel: meetings.titel,
        datum: meetings.datum,
        duurMinuten: meetings.duurMinuten,
        status: meetings.status,
        klantId: meetings.klantId,
        projectId: meetings.projectId,
        klantNaam: klanten.bedrijfsnaam,
        projectNaam: projecten.naam,
        audioPad: meetings.audioPad,
        transcript: meetings.transcript,
        samenvatting: meetings.samenvatting,
        actiepunten: meetings.actiepunten,
        besluiten: meetings.besluiten,
        openVragen: meetings.openVragen,
        sentiment: meetings.sentiment,
        tags: meetings.tags,
        aangemaaktDoor: meetings.aangemaaktDoor,
        aangemaaktOp: meetings.aangemaaktOp,
      })
      .from(meetings)
      .leftJoin(klanten, eq(meetings.klantId, klanten.id))
      .leftJoin(projecten, eq(meetings.projectId, projecten.id))
      .where(eq(meetings.id, meetingId))
      .get();

    return NextResponse.json({ meeting: updated });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    if (message === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: message }, { status: 401 });
    }
    return NextResponse.json({ fout: message }, { status: 500 });
  }
}

// Upload audio for an existing meeting
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const meetingId = Number(id);

    const meeting = await db
      .select({ id: meetings.id, audioPad: meetings.audioPad })
      .from(meetings)
      .where(eq(meetings.id, meetingId))
      .get();

    if (!meeting) {
      return NextResponse.json(
        { fout: "Meeting niet gevonden" },
        { status: 404 }
      );
    }

    const formData = await req.formData();
    const audio = formData.get("audio") as File | null;

    if (!audio) {
      return NextResponse.json(
        { fout: "Geen audiobestand meegegeven" },
        { status: 400 }
      );
    }

    const uploadsDir = path.join(process.cwd(), "data", "uploads", "meetings");
    await mkdir(uploadsDir, { recursive: true });

    const ext = audio.name.split(".").pop() || "webm";
    const timestamp = Date.now();
    const fileName = `meeting_${meetingId}_${timestamp}.${ext}`;
    const audioPad = path.join(uploadsDir, fileName);

    const buffer = Buffer.from(await audio.arrayBuffer());
    await writeFile(audioPad, buffer);

    await db.update(meetings)
      .set({ audioPad })
      .where(eq(meetings.id, meetingId))
      .run();

    return NextResponse.json({ succes: true, audioPad });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    if (message === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: message }, { status: 401 });
    }
    return NextResponse.json({ fout: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;

    const meeting = await db
      .select({ id: meetings.id, audioPad: meetings.audioPad })
      .from(meetings)
      .where(eq(meetings.id, Number(id)))
      .get();

    if (!meeting) {
      return NextResponse.json(
        { fout: "Meeting niet gevonden" },
        { status: 404 }
      );
    }

    if (meeting.audioPad) {
      try {
        await unlink(meeting.audioPad);
      } catch {
        // Audio file may already be deleted
      }
    }

    await db.delete(meetings).where(eq(meetings.id, Number(id))).run();

    return NextResponse.json({ succes: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    if (message === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: message }, { status: 401 });
    }
    return NextResponse.json({ fout: message }, { status: 500 });
  }
}
