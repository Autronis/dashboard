import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { screenTimeEntries } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// Vercel cron — elke 10 min.
// Tijdens werk-uren 08:00-23:00 NL: alert naar Discord #alerts als de tracker
// van Sem (gebruikerId 1) of Syb (2) geen nieuwe entry heeft in de laatste 15 min.
// Dan weet je binnen 10 min dat de tracker stilligt ipv het volgende dag pas te ontdekken.

const CHECK_MINUTES_STALE = 15;
const WORK_START_HOUR_NL = 8;
const WORK_END_HOUR_NL = 23;
const DISCORD_ALERTS_CHANNEL_ID = "1494674479954002020";
const SEM_MENTION = "509743836009070603";
const SYB_MENTION = "595878176018792460";

const USERS = [
  { id: 1, naam: "Sem", mention: SEM_MENTION },
  { id: 2, naam: "Syb", mention: SYB_MENTION },
];

function nlHour(): number {
  const fmt = new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    hour12: false,
  });
  return parseInt(fmt.format(new Date()), 10);
}

async function postDiscordAlert(message: string): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.error("[screen-time-health] DISCORD_BOT_TOKEN missing — skipping alert");
    return;
  }
  const res = await fetch(
    `https://discord.com/api/v10/channels/${DISCORD_ALERTS_CHANNEL_ID}/messages`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: message,
        allowed_mentions: { users: [SEM_MENTION, SYB_MENTION] },
      }),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[screen-time-health] Discord POST failed: ${res.status} ${body}`);
  }
}

export async function GET(req: NextRequest) {
  try {
    // Auth: Bearer CRON_SECRET (same pattern as other cron routes).
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ fout: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";
    const hour = nlHour();
    if (!force && (hour < WORK_START_HOUR_NL || hour >= WORK_END_HOUR_NL)) {
      return NextResponse.json({ checked: false, reason: "outside work hours", hour });
    }

    const nowMs = Date.now();
    const staleMs = CHECK_MINUTES_STALE * 60 * 1000;
    const alerts: string[] = [];
    const results: Array<{ user: string; latest: string | null; staleMin: number; stale: boolean }> = [];

    for (const u of USERS) {
      const rows = await db
        .select({ startTijd: screenTimeEntries.startTijd })
        .from(screenTimeEntries)
        .where(eq(screenTimeEntries.gebruikerId, u.id))
        .orderBy(desc(screenTimeEntries.startTijd))
        .limit(1);
      const latest = rows[0]?.startTijd ?? null;
      const ageMs = latest ? nowMs - new Date(latest).getTime() : Number.POSITIVE_INFINITY;
      const ageMin = Math.round(ageMs / 60000);
      const stale = ageMs > staleMs;
      results.push({ user: u.naam, latest, staleMin: ageMin, stale });
      if (stale) {
        alerts.push(
          `<@${u.mention}> screen-time tracker van ${u.naam} staat stil — laatste entry ${ageMin} min geleden (${latest ?? "nooit"}). Open /Applications/Autronis Dashboard.app of check launchagent.`
        );
      }
    }

    if (alerts.length > 0) {
      await postDiscordAlert(alerts.join("\n"));
    }

    return NextResponse.json({ checked: true, hour, results, alertsSent: alerts.length });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 500 }
    );
  }
}
