import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { screenTimeEntries, projecten, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, asc, sql } from "drizzle-orm";

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

function generateBeschrijving(sessie: Omit<Sessie, "beschrijving">): string {
  const titles = sessie.venstertitels;
  if (titles.length === 0) return sessie.app;

  const projects = new Set<string>();
  const files = new Set<string>();
  const websites = new Set<string>();
  const activities = new Set<string>();

  for (const title of titles) {
    // VS Code: "file.tsx — project-name — Visual Studio Code"
    const vscodeMatch = title.match(/^(.+?)\s*[-—]\s*(.+?)\s*[-—]\s*Visual Studio Code$/);
    if (vscodeMatch) {
      files.add(vscodeMatch[1].trim());
      projects.add(vscodeMatch[2].trim());
      continue;
    }

    // Claude Code: "✻ [Claude Code] path"
    if (title.includes("[Claude Code]")) {
      activities.add("Claude Code");
      const pathMatch = title.match(/Projects[/\\]([^/\\]+)/);
      if (pathMatch) projects.add(pathMatch[1]);
      continue;
    }

    // Chrome: "Page Title - Google Chrome"
    const chromeMatch = title.match(/^(.+?)\s*[-—]\s*Google Chrome$/);
    if (chromeMatch) {
      const pageTitle = chromeMatch[1].trim();
      if (pageTitle.includes("GitHub")) websites.add("GitHub");
      else if (pageTitle.includes("Notion")) websites.add("Notion");
      else if (pageTitle.includes("localhost")) websites.add("localhost");
      else if (pageTitle.includes("Dashboard")) websites.add("Autronis Dashboard");
      else if (pageTitle.length < 50) websites.add(pageTitle);
      continue;
    }

    // Discord: "#channel | Server - Discord"
    const discordMatch = title.match(/^(#.+?)\s*\|\s*(.+?)\s*[-—]\s*Discord$/);
    if (discordMatch) {
      activities.add(`Discord (${discordMatch[2].trim()})`);
      continue;
    }

    // Spotify: skip background music
    if (title.includes("Spotify")) {
      continue;
    }

    // Generic: just add the title if short enough
    if (title.length < 60) activities.add(title);
  }

  // Build description
  const parts: string[] = [];

  if (projects.size > 0) {
    const projectList = Array.from(projects).slice(0, 3).join(", ");
    const fileList = Array.from(files).slice(0, 5).join(", ");
    if (files.size > 0) {
      parts.push(`Gewerkt aan ${projectList} (${fileList})`);
    } else {
      parts.push(`Gewerkt aan ${projectList}`);
    }
  }

  if (websites.size > 0) {
    parts.push(Array.from(websites).slice(0, 3).join(", "));
  }

  if (activities.size > 0) {
    parts.push(Array.from(activities).slice(0, 3).join(", "));
  }

  return parts.join(". ") || sessie.app;
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
    beschrijving: generateBeschrijving(baseSessie),
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

    const sessies = groupIntoSessions(filteredEntries);

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

    return NextResponse.json({
      sessies,
      stats: {
        totaalActief,
        totaalIdle,
        productiefPercentage,
        aantalSessies: actiefSessies.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
