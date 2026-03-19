import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { externeKalenders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface Attendee {
  naam: string | null;
  email: string;
}

interface ExternEvent {
  id: string;
  titel: string;
  omschrijving: string | null;
  startDatum: string;
  eindDatum: string | null;
  heleDag: boolean;
  locatie: string | null;
  meetingUrl: string | null;
  organisator: string | null;
  deelnemers: Attendee[];
  bron: string;
  bronNaam: string;
  kleur: string;
}

// GET /api/agenda/sync?van=2026-03-01&tot=2026-03-31
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const van = searchParams.get("van");
    const tot = searchParams.get("tot");

    const vanDate = van ? new Date(van) : new Date();
    const totDate = tot ? new Date(tot + "T23:59:59") : new Date(vanDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    const kalenders = await db
      .select()
      .from(externeKalenders)
      .where(eq(externeKalenders.isActief, 1));

    const alleEvents: ExternEvent[] = [];

    for (const kalender of kalenders) {
      try {
        const events = await fetchICSEvents(kalender.url, kalender.bron, kalender.naam, kalender.kleur ?? "#17B8A5", vanDate, totDate);
        alleEvents.push(...events);

        await db
          .update(externeKalenders)
          .set({ laatstGesyncOp: new Date().toISOString() })
          .where(eq(externeKalenders.id, kalender.id));
      } catch {
        // Skip failed calendars
      }
    }

    alleEvents.sort((a, b) => a.startDatum.localeCompare(b.startDatum));

    return NextResponse.json({ events: alleEvents });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 500 }
    );
  }
}

// ============ ICS PARSER ============

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

// Unfold ICS continuation lines (lines starting with space/tab are continuations)
function unfoldICS(text: string): string {
  return text.replace(/\r?\n[ \t]/g, "");
}

// Extract email from ATTENDEE/ORGANIZER line
function extractEmail(line: string): string {
  const match = line.match(/mailto:([^\s;]+)/i);
  return match ? match[1] : "";
}

// Extract CN (common name) from line
function extractCN(line: string): string | null {
  const match = line.match(/CN=([^;:]+)/i);
  return match ? match[1].trim() : null;
}

// Extract URL from description or location
function extractMeetingUrl(description: string, location: string): string | null {
  // Check location first (often a direct URL)
  if (location && /^https?:\/\//.test(location)) return location;
  // Check description for common meeting URLs
  const urlMatch = description.match(/(https?:\/\/(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com|app\.cal\.com)[^\s\\)]+)/i);
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
      }
      else if (line.startsWith("LOCATION:")) location = line.slice(9).trim();
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

async function fetchICSEvents(
  url: string,
  bron: string,
  bronNaam: string,
  kleur: string,
  van: Date,
  tot: Date
): Promise<ExternEvent[]> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Autronis-Dashboard/1.0" },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) throw new Error(`ICS fetch failed: ${response.status}`);

  const icsText = await response.text();
  const parsed = parseICS(icsText);
  const events: ExternEvent[] = [];

  for (const event of parsed) {
    const start = parseICSDate(event.dtstart);
    const end = event.dtend ? parseICSDate(event.dtend) : null;

    if (!start || isNaN(start.getTime())) continue;
    if (start > tot) continue;
    if (end && end < van) continue;
    if (!end && start < van) continue;

    const meetingUrl = extractMeetingUrl(event.description, event.location);

    events.push({
      id: `${bron}-${event.uid}-${start.toISOString()}`,
      titel: event.summary || "Zonder titel",
      omschrijving: event.description || null,
      startDatum: start.toISOString(),
      eindDatum: end ? end.toISOString() : null,
      heleDag: event.heleDag,
      locatie: event.location || null,
      meetingUrl,
      organisator: event.organisator,
      deelnemers: event.deelnemers,
      bron,
      bronNaam,
      kleur,
    });
  }

  return events;
}
