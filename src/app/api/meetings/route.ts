import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { meetings, klanten, projecten, externeKalenders, verborgenKalenderMeetings } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, desc, sql } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// ============ ICS PARSING (reuse from agenda/sync) ============

interface Attendee {
  naam: string | null;
  email: string;
}

interface CalendarMeeting {
  id: string;
  titel: string;
  datum: string;
  eindDatum: string | null;
  duurMinuten: number | null;
  meetingUrl: string | null;
  deelnemers: Attendee[];
  bron: "kalender";
  bronNaam: string;
  kleur: string;
  locatie: string | null;
  omschrijving: string | null;
  organisator: string | null;
}

function parseICSDate(value: string): Date | null {
  const clean = value.replace(/[^0-9TZ]/g, "");
  if (clean.length >= 8) {
    const y = parseInt(clean.slice(0, 4), 10);
    const m = parseInt(clean.slice(4, 6), 10) - 1;
    const d = parseInt(clean.slice(6, 8), 10);
    if (clean.length >= 15) {
      const h = parseInt(clean.slice(9, 11), 10);
      const min = parseInt(clean.slice(11, 13), 10);
      const s = parseInt(clean.slice(13, 15), 10);
      if (clean.endsWith("Z")) return new Date(Date.UTC(y, m, d, h, min, s));
      return new Date(y, m, d, h, min, s);
    }
    return new Date(y, m, d);
  }
  return null;
}

function unfoldICS(text: string): string {
  return text.replace(/\r?\n[ \t]/g, "");
}

function extractEmail(line: string): string {
  const match = line.match(/mailto:([^\s;]+)/i);
  return match ? match[1] : "";
}

function extractCN(line: string): string | null {
  const match = line.match(/CN=([^;:]+)/i);
  return match ? match[1].trim() : null;
}

function extractMeetingUrl(description: string, location: string): string | null {
  if (location && /^https?:\/\//.test(location)) return location;
  const urlMatch = description.match(
    /(https?:\/\/(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com|app\.cal\.com)[^\s\\)]+)/i
  );
  return urlMatch ? urlMatch[1] : null;
}

interface ParsedEvent {
  uid: string;
  summary: string;
  description: string;
  location: string;
  dtstart: string;
  dtend: string;
  heleDag: boolean;
  organisator: string | null;
  deelnemers: Attendee[];
}

function parseICS(icsText: string): ParsedEvent[] {
  const unfolded = unfoldICS(icsText);
  const events: ParsedEvent[] = [];

  const blocks = unfolded.split("BEGIN:VEVENT");
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split("END:VEVENT")[0];
    const lines = block.split(/\r?\n/);

    let uid = "";
    let summary = "";
    let description = "";
    let location = "";
    let dtstart = "";
    let dtend = "";
    let heleDag = false;
    let organisator: string | null = null;
    const deelnemers: Attendee[] = [];

    for (const line of lines) {
      if (line.startsWith("UID:")) uid = line.slice(4).trim();
      else if (line.startsWith("SUMMARY:")) summary = line.slice(8).trim();
      else if (line.startsWith("DESCRIPTION:")) {
        description = line.slice(12).trim().replace(/\\n/g, "\n").replace(/\\,/g, ",");
      } else if (line.startsWith("LOCATION:")) location = line.slice(9).trim();
      else if (line.startsWith("DTSTART")) {
        const val = line.split(":").pop()?.trim() ?? "";
        dtstart = val;
        heleDag = line.includes("VALUE=DATE") && !line.includes("VALUE=DATE-TIME");
        if (!line.includes("VALUE=") && val.length === 8) heleDag = true;
      } else if (line.startsWith("DTEND")) {
        dtend = line.split(":").pop()?.trim() ?? "";
      } else if (line.startsWith("ORGANIZER")) {
        organisator = extractCN(line) || extractEmail(line) || null;
      } else if (line.startsWith("ATTENDEE")) {
        const email = extractEmail(line);
        if (email) {
          deelnemers.push({ naam: extractCN(line), email });
        }
      }
    }

    if (dtstart) {
      events.push({ uid, summary, description, location, dtstart, dtend, heleDag, organisator, deelnemers });
    }
  }

  return events;
}

async function fetchCalendarMeetings(): Promise<CalendarMeeting[]> {
  const kalenders = await db
    .select()
    .from(externeKalenders)
    .where(eq(externeKalenders.isActief, 1))
    .all();

  const allMeetings: CalendarMeeting[] = [];
  const now = new Date();
  const van = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
  const tot = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days ahead

  for (const kalender of kalenders) {
    try {
      const response = await fetch(kalender.url, {
        headers: { "User-Agent": "Autronis-Dashboard/1.0" },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) continue;

      const icsText = await response.text();
      const parsed = parseICS(icsText);

      for (const event of parsed) {
        const start = parseICSDate(event.dtstart);
        const end = event.dtend ? parseICSDate(event.dtend) : null;

        if (!start || isNaN(start.getTime())) continue;
        if (start > tot || (end && end < van) || (!end && start < van)) continue;
        if (event.heleDag) continue; // Skip all-day events, not meetings

        const meetingUrl = extractMeetingUrl(event.description, event.location);

        // Only include events with meeting URLs or that have attendees
        if (!meetingUrl && event.deelnemers.length === 0) continue;

        let duurMinuten: number | null = null;
        if (end) {
          duurMinuten = Math.round((end.getTime() - start.getTime()) / 60000);
        }

        allMeetings.push({
          id: `cal-${kalender.id}-${event.uid}`,
          titel: event.summary || "Zonder titel",
          datum: start.toISOString(),
          eindDatum: end ? end.toISOString() : null,
          duurMinuten,
          meetingUrl,
          deelnemers: event.deelnemers,
          bron: "kalender",
          bronNaam: kalender.naam,
          kleur: kalender.kleur ?? "#17B8A5",
          locatie: event.location || null,
          omschrijving: event.description || null,
          organisator: event.organisator,
        });
      }
    } catch {
      // Skip failed calendars
    }
  }

  return allMeetings;
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    // Ensure meeting_url column exists
    try { await db.run(sql`ALTER TABLE meetings ADD COLUMN meeting_url TEXT`); } catch { /* already exists */ }

    const { searchParams } = new URL(req.url);
    const klantId = searchParams.get("klantId");
    const projectId = searchParams.get("projectId");
    const includeCalendar = searchParams.get("includeCalendar") !== "false";

    let query = db
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
        samenvatting: meetings.samenvatting,
        actiepunten: meetings.actiepunten,
        sentiment: meetings.sentiment,
        tags: meetings.tags,
        transcript: meetings.transcript,
        audioPad: meetings.audioPad,
        meetingUrl: meetings.meetingUrl,
        recallBotId: meetings.recallBotId,
        recallFout: meetings.recallFout,
        aangemaaktOp: meetings.aangemaaktOp,
      })
      .from(meetings)
      .leftJoin(klanten, eq(meetings.klantId, klanten.id))
      .leftJoin(projecten, eq(meetings.projectId, projecten.id))
      .orderBy(desc(meetings.datum))
      .$dynamic();

    if (klantId) {
      query = query.where(eq(meetings.klantId, Number(klantId)));
    } else if (projectId) {
      query = query.where(eq(meetings.projectId, Number(projectId)));
    }

    let dbMeetings;
    try {
      dbMeetings = await query.all();
    } catch {
      // Fallback without dynamic query
      dbMeetings = await db
        .select({
          id: meetings.id, titel: meetings.titel, datum: meetings.datum,
          duurMinuten: meetings.duurMinuten, status: meetings.status,
          klantId: meetings.klantId, projectId: meetings.projectId,
          klantNaam: klanten.bedrijfsnaam, projectNaam: projecten.naam,
          samenvatting: meetings.samenvatting, actiepunten: meetings.actiepunten,
          sentiment: meetings.sentiment, tags: meetings.tags,
          transcript: meetings.transcript, audioPad: meetings.audioPad,
          meetingUrl: meetings.meetingUrl,
          recallBotId: meetings.recallBotId, recallFout: meetings.recallFout,
          aangemaaktOp: meetings.aangemaaktOp,
        })
        .from(meetings)
        .leftJoin(klanten, eq(meetings.klantId, klanten.id))
        .leftJoin(projecten, eq(meetings.projectId, projecten.id))
        .orderBy(desc(meetings.datum))
        .all();
    }

    // Enrich DB meetings with source info
    const enrichedDbMeetings = dbMeetings.map((m) => ({
      ...m,
      bron: "database" as const,
      // meetingUrl, recallBotId, recallFout komen al uit de select
      deelnemers: [] as Attendee[],
      eindDatum: null as string | null,
      bronNaam: null as string | null,
      locatie: null as string | null,
      omschrijving: null as string | null,
      organisator: null as string | null,
      hasNotities: !!(m.samenvatting || m.transcript),
    }));

    if (!includeCalendar || klantId || projectId) {
      return NextResponse.json({ meetings: enrichedDbMeetings });
    }

    // Fetch calendar meetings
    let calendarMeetings: CalendarMeeting[] = [];
    try {
      calendarMeetings = await fetchCalendarMeetings();
    } catch {
      // Calendar fetch failed, return DB only
    }

    // Fetch hidden calendar event IDs
    let verborgenIds = new Set<string>();
    try {
      await db.run(sql`CREATE TABLE IF NOT EXISTS verborgen_kalender_meetings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kalender_event_id TEXT NOT NULL UNIQUE,
        verborgen_op TEXT DEFAULT (datetime('now'))
      )`);
      const verborgen = await db.select({ kalenderEventId: verborgenKalenderMeetings.kalenderEventId }).from(verborgenKalenderMeetings).all();
      verborgenIds = new Set(verborgen.map((v) => v.kalenderEventId));
    } catch { /* table may not exist yet */ }

    // Deduplicate: if a calendar event matches a DB meeting by title+date (same day), skip calendar version
    const dbDateTitles = new Set(
      dbMeetings.map(
        (m) => `${m.titel.toLowerCase().trim()}|${m.datum.slice(0, 10)}`
      )
    );

    const uniqueCalendarMeetings = calendarMeetings
      .filter((cm) => {
        if (verborgenIds.has(cm.id)) return false;
        const key = `${cm.titel.toLowerCase().trim()}|${cm.datum.slice(0, 10)}`;
        return !dbDateTitles.has(key);
      })
      .map((cm) => ({
        ...cm,
        status: null as string | null,
        klantId: null as number | null,
        projectId: null as number | null,
        klantNaam: null as string | null,
        projectNaam: null as string | null,
        samenvatting: null as string | null,
        actiepunten: "[]",
        sentiment: null as string | null,
        tags: "[]",
        transcript: null as string | null,
        audioPad: null as string | null,
        recallBotId: null as string | null,
        recallFout: null as string | null,
        aangemaaktOp: null as string | null,
        hasNotities: false,
      }));

    // Merge and sort by date desc
    const combined = [
      ...enrichedDbMeetings,
      ...uniqueCalendarMeetings,
    ].sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime());

    return NextResponse.json({ meetings: combined });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    if (message === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: message }, { status: 401 });
    }
    return NextResponse.json({ fout: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();

    // Ensure meeting_url column exists
    try { await db.run(sql`ALTER TABLE meetings ADD COLUMN meeting_url TEXT`); } catch { /* already exists */ }

    const formData = await req.formData();
    const titel = formData.get("titel") as string | null;
    const datum = formData.get("datum") as string | null;
    const klantId = formData.get("klantId") as string | null;
    const projectId = formData.get("projectId") as string | null;
    const meetingUrl = formData.get("meetingUrl") as string | null;
    const audio = formData.get("audio") as File | null;

    if (!titel || !datum) {
      return NextResponse.json(
        { fout: "Titel en datum zijn verplicht" },
        { status: 400 }
      );
    }

    let audioPad: string | null = null;

    if (audio) {
      const uploadsDir = path.join(
        process.cwd(),
        "data",
        "uploads",
        "meetings"
      );
      await mkdir(uploadsDir, { recursive: true });

      const ext = audio.name.split(".").pop() || "webm";
      const timestamp = Date.now();
      const fileName = `meeting_${timestamp}.${ext}`;
      audioPad = path.join(uploadsDir, fileName);

      const buffer = Buffer.from(await audio.arrayBuffer());
      await writeFile(audioPad, buffer);
    }

    const result = await db
      .insert(meetings)
      .values({
        titel,
        datum,
        klantId: klantId ? Number(klantId) : null,
        projectId: projectId ? Number(projectId) : null,
        meetingUrl: meetingUrl || null,
        audioPad,
        status: meetingUrl ? null : "verwerken",
        aangemaaktDoor: gebruiker.id,
      })
      .run();

    const meeting = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, Number(result.lastInsertRowid)))
      .get();

    // Auto-dispatch Recall bot if meeting URL is provided
    let recallBot = null;
    let recallFout: string | null = null;
    if (meetingUrl?.trim()) {
      const { createRecallBot, isRecallConfigured } = await import("@/lib/recall");
      if (!isRecallConfigured()) {
        recallFout = "Recall niet geconfigureerd (RECALL_API_KEY ontbreekt op de server).";
        await db.run(sql`UPDATE meetings SET status = 'mislukt', recall_fout = ${recallFout} WHERE id = ${Number(result.lastInsertRowid)}`);
      } else {
        try {
          // Geef datum mee zodat Recall de bot inplant op de meeting start in plaats van direct te joinen.
          // Voor toekomstige meetings voorkomt dit dat de bot vroegtijdig timeout in de lobby.
          const joinAt = datum ? new Date(datum) : undefined;
          const bot = await createRecallBot(meetingUrl.trim(), titel, joinAt);
          await db.run(sql`UPDATE meetings SET recall_bot_id = ${bot.id}, status = 'verwerken', recall_fout = NULL WHERE id = ${Number(result.lastInsertRowid)}`);
          recallBot = bot;
        } catch (err) {
          recallFout = err instanceof Error ? err.message : String(err);
          console.error("[meetings] Recall bot dispatch failed:", recallFout);
          await db.run(sql`UPDATE meetings SET status = 'mislukt', recall_fout = ${recallFout} WHERE id = ${Number(result.lastInsertRowid)}`);
        }
      }
    }

    return NextResponse.json({ meeting, recallBot, recallFout }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    if (message === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: message }, { status: 401 });
    }
    return NextResponse.json({ fout: message }, { status: 500 });
  }
}
