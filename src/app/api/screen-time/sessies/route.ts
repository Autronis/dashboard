import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { screenTimeEntries, projecten, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, asc, sql } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

const SESSION_GAP_SECONDS = 1800; // 30 minutes gap = new session (~3-5 per dag)

interface RawEntry {
  app: string;
  vensterTitel: string | null;
  categorie: string;
  projectId: number | null;
  projectNaam: string | null;
  klantNaam: string | null;
  startTijd: string;
  eindTijd: string;
  duurSeconden: number;
}

interface Sessie {
  app: string;
  categorie: string;
  projectId: number | null;
  projectNaam: string | null;
  klantNaam: string | null;
  startTijd: string;
  eindTijd: string;
  duurSeconden: number;
  venstertitels: string[];
  isIdle: boolean;
  beschrijving: string;
}

function fallbackBeschrijving(sessie: Omit<Sessie, "beschrijving">): string {
  // Quick fallback while AI generates
  const apps = sessie.app.split(", ").filter(a => a !== "Inactief");
  return apps.length > 0 ? apps.join(", ") : sessie.app;
}

async function generateAIBeschrijvingen(sessies: Omit<Sessie, "beschrijving">[]): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || sessies.length === 0) return sessies.map(s => fallbackBeschrijving(s));

  // Build context per session
  const sessionDescriptions = sessies.map((s, i) => {
    const start = new Date(s.startTijd).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
    const end = new Date(s.eindTijd).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
    const duur = Math.round(s.duurSeconden / 60);
    const titels = s.venstertitels.slice(0, 10).join("\n    ");
    return `Sessie ${i + 1} (${start}-${end}, ${duur}m, apps: ${s.app}):
    ${titels || "geen venstertitels"}`;
  }).join("\n\n");

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Je bent een productiviteits-tracker voor Sem, developer bij Autronis (AI/automation bureau).

Beschrijf per sessie WAT er gedaan is op basis van de venstertitels. Wees specifiek en menselijk.

Regels:
- Beschrijf de ACTIVITEIT, niet de app naam. Niet "TradingView geopend" maar wat er GEDAAN werd
- Lees de venstertitels GOED — ze bevatten specifieke context:
  - Crypto pairs (BTCUSD, ETHBTC, SUIUSD, SOLUSD) = "Crypto portfolio analyse: BTC, ETH, SUI en SOL pairs bekeken"
  - Liquidation Heatmap / CoinAnk = "Liquidation data en marktanalyse gecheckt"
  - TradingView met pairs = "Investerings analyse: [noem de specifieke coins/pairs]"
- VS Code bestanden (schema.ts, page.tsx, route.ts) = "Development aan [projectnaam]: [wat er gebouwd/aangepast werd]"
- Claude Code = "AI-assisted development aan [project]"
- GitHub = "Code reviews en repository beheer"
- Notion = "Planning en documentatie bijgewerkt"
- Discord #channel | Server = "Communicatie in [server]"
- Spotify/muziek = negeer (achtergrondmuziek)
- Wees specifiek en concreet. Noem coins, projectnamen, specifieke taken
- Max 2 zinnen per sessie
- Schrijf in het Nederlands

${sessionDescriptions}

Antwoord als JSON array met exact ${sessies.length} strings, één per sessie:
["beschrijving sessie 1", "beschrijving sessie 2", ...]
Alleen JSON.`,
      }],
    });

    const tekst = response.content[0].type === "text" ? response.content[0].text : "";
    const match = tekst.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]) as string[];
      if (parsed.length === sessies.length) return parsed;
    }
  } catch {
    // AI failed, use fallback
  }

  return sessies.map(s => fallbackBeschrijving(s));
}

function groupIntoSessions(entries: RawEntry[]): Sessie[] {
  if (entries.length === 0) return [];

  const sessions: Sessie[] = [];

  // Time-based grouping: gap > 30 min = new session
  // Results in ~3-5 sessions per day (ochtend, middag, avond)
  let currentEntries: RawEntry[] = [entries[0]];

  for (let i = 1; i < entries.length; i++) {
    const prevEnd = new Date(entries[i - 1].eindTijd).getTime();
    const thisStart = new Date(entries[i].startTijd).getTime();
    const gapSeconds = (thisStart - prevEnd) / 1000;

    if (gapSeconds > SESSION_GAP_SECONDS) {
      // Gap too large — finalize current session
      sessions.push(buildSession(currentEntries));
      currentEntries = [entries[i]];
    } else {
      currentEntries.push(entries[i]);
    }
  }
  if (currentEntries.length > 0) {
    sessions.push(buildSession(currentEntries));
  }

  return sessions;
}

function buildSession(entries: RawEntry[]): Sessie {
  // Find dominant app (most seconds)
  const appSeconds: Record<string, number> = {};
  const catSeconds: Record<string, number> = {};
  const allTitles: string[] = [];
  let projectId: number | null = null;
  let projectNaam: string | null = null;
  let klantNaam: string | null = null;

  for (const e of entries) {
    appSeconds[e.app] = (appSeconds[e.app] || 0) + e.duurSeconden;
    catSeconds[e.categorie] = (catSeconds[e.categorie] || 0) + e.duurSeconden;
    if (e.vensterTitel && !allTitles.includes(e.vensterTitel)) {
      allTitles.push(e.vensterTitel);
    }
    if (!projectId && e.projectId) {
      projectId = e.projectId;
      projectNaam = e.projectNaam;
      klantNaam = e.klantNaam;
    }
  }

  const dominantApp = Object.entries(appSeconds).sort(([, a], [, b]) => b - a)[0]?.[0] || entries[0].app;
  const dominantCat = Object.entries(catSeconds).sort(([, a], [, b]) => b - a)[0]?.[0] || "overig";
  const totalSeconds = entries.reduce((s, e) => s + e.duurSeconden, 0);
  const isIdle = dominantApp === "Inactief" || dominantCat === "inactief";

  // Build description: top 3 apps used
  const topApps = Object.entries(appSeconds)
    .filter(([app]) => app !== "Inactief")
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([app]) => app);

  const baseSessie = {
    app: topApps.length > 0 ? topApps.join(", ") : dominantApp,
    categorie: dominantCat,
    projectId,
    projectNaam,
    klantNaam,
    startTijd: entries[0].startTijd,
    eindTijd: entries[entries.length - 1].eindTijd,
    duurSeconden: totalSeconds,
    venstertitels: allTitles.slice(0, 20),
    isIdle,
  };

  return {
    ...baseSessie,
    beschrijving: fallbackBeschrijving(baseSessie),
  };
}

export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { searchParams } = new URL(req.url);
    const datum = searchParams.get("datum");
    const gebruikerId = searchParams.get("gebruikerId");

    if (!datum) {
      return NextResponse.json({ fout: "Datum is verplicht" }, { status: 400 });
    }

    const conditions = [];
    if (gebruikerId && gebruiker.rol === "admin") {
      conditions.push(eq(screenTimeEntries.gebruikerId, parseInt(gebruikerId)));
    } else {
      conditions.push(eq(screenTimeEntries.gebruikerId, gebruiker.id));
    }
    // Timestamps have timezone offsets (+00:00). Use SUBSTR for date-only comparison.
    conditions.push(sql`SUBSTR(${screenTimeEntries.startTijd}, 1, 10) = ${datum}`);

    const entries = db
      .select({
        app: screenTimeEntries.app,
        vensterTitel: screenTimeEntries.vensterTitel,
        categorie: screenTimeEntries.categorie,
        projectId: screenTimeEntries.projectId,
        projectNaam: projecten.naam,
        klantNaam: klanten.bedrijfsnaam,
        startTijd: screenTimeEntries.startTijd,
        eindTijd: screenTimeEntries.eindTijd,
        duurSeconden: screenTimeEntries.duurSeconden,
      })
      .from(screenTimeEntries)
      .leftJoin(projecten, eq(screenTimeEntries.projectId, projecten.id))
      .leftJoin(klanten, eq(screenTimeEntries.klantId, klanten.id))
      .where(and(...conditions))
      .orderBy(asc(screenTimeEntries.startTijd))
      .all();

    // Filter out system apps AND idle entries (idle = gaps in timeline)
    const SYSTEM_APPS = ["LockApp", "SearchHost", "ShellHost", "ShellExperienceHost", "StartMenuExperienceHost", "ApplicationFrameHost", "Inactief"];

    const filteredEntries = entries
      .filter(e => !SYSTEM_APPS.includes(e.app) && e.categorie !== "inactief")
      .map(e => ({
        ...e,
        categorie: e.categorie ?? "overig",
      }));

    const rawSessies = groupIntoSessions(filteredEntries);

    // Generate AI descriptions (one call for all sessions)
    const aiBeschrijvingen = await generateAIBeschrijvingen(rawSessies);
    const sessies = rawSessies.map((s, i) => ({
      ...s,
      beschrijving: aiBeschrijvingen[i] || s.beschrijving,
    }));

    // Compute stats from sessions (all are active since idle was filtered pre-grouping)
    const totaalActief = sessies.reduce((sum, s) => sum + s.duurSeconden, 0);
    // Calculate idle from original entries (before filtering)
    const totaalIdle = entries
      .filter(e => e.app === "Inactief" || (e.categorie ?? "overig") === "inactief")
      .reduce((sum, e) => sum + e.duurSeconden, 0);
    const actiefSessies = sessies;
    const productiefSeconden = actiefSessies
      .filter(s => ["development", "design", "administratie"].includes(s.categorie))
      .reduce((sum, s) => sum + s.duurSeconden, 0);
    const werkSeconden = actiefSessies
      .filter(s => ["development", "design", "administratie", "communicatie", "afleiding"].includes(s.categorie))
      .reduce((sum, s) => sum + s.duurSeconden, 0);
    const productiefPercentage = werkSeconden > 0 ? Math.round((productiefSeconden / werkSeconden) * 100) : 0;

    // Context switches: count unique app changes in raw entries
    let contextSwitches = 0;
    let lastApp = "";
    for (const e of filteredEntries) {
      if (e.app !== lastApp && lastApp !== "") contextSwitches++;
      lastApp = e.app;
    }

    // Longest focus streak: longest continuous period in same app category
    let longestFocusMinutes = 0;
    let currentStreakStart = filteredEntries[0]?.startTijd;
    let currentStreakCat = filteredEntries[0]?.categorie;
    for (let i = 1; i < filteredEntries.length; i++) {
      if (filteredEntries[i].categorie !== currentStreakCat) {
        const streakDuration = (new Date(filteredEntries[i - 1].eindTijd).getTime() - new Date(currentStreakStart!).getTime()) / 60000;
        if (streakDuration > longestFocusMinutes) longestFocusMinutes = Math.round(streakDuration);
        currentStreakStart = filteredEntries[i].startTijd;
        currentStreakCat = filteredEntries[i].categorie;
      }
    }
    // Check final streak
    if (filteredEntries.length > 0) {
      const lastEntry = filteredEntries[filteredEntries.length - 1];
      const finalStreak = (new Date(lastEntry.eindTijd).getTime() - new Date(currentStreakStart!).getTime()) / 60000;
      if (finalStreak > longestFocusMinutes) longestFocusMinutes = Math.round(finalStreak);
    }

    // Focus score: 0-100 based on:
    // - Less context switching = higher score (max 40 points)
    // - Higher productive % = higher score (max 40 points)
    // - Longer focus streaks = higher score (max 20 points)
    const switchScore = Math.max(0, 40 - contextSwitches * 0.5);
    const productiviteitScore = productiefPercentage * 0.4;
    const focusStreakScore = Math.min(20, longestFocusMinutes / 3);
    const focusScore = Math.round(switchScore + productiviteitScore + focusStreakScore);

    // Break analysis: find gaps > 5 min between active entries
    const pauzes: Array<{ start: string; eind: string; duurMinuten: number }> = [];
    for (let i = 1; i < filteredEntries.length; i++) {
      const prevEnd = new Date(filteredEntries[i - 1].eindTijd).getTime();
      const thisStart = new Date(filteredEntries[i].startTijd).getTime();
      const gapMin = (thisStart - prevEnd) / 60000;
      if (gapMin >= 5 && gapMin <= 120) {
        pauzes.push({
          start: filteredEntries[i - 1].eindTijd,
          eind: filteredEntries[i].startTijd,
          duurMinuten: Math.round(gapMin),
        });
      }
    }
    const totaalPauzeMinuten = pauzes.reduce((s, p) => s + p.duurMinuten, 0);

    return NextResponse.json({
      sessies,
      stats: {
        totaalActief,
        totaalIdle,
        productiefPercentage,
        aantalSessies: actiefSessies.length,
        focusScore,
        contextSwitches,
        langsteFocusMinuten: longestFocusMinutes,
        pauzes,
        totaalPauzeMinuten,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
