import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { screenTimeEntries, projecten, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, asc, sql } from "drizzle-orm";

// ─── Cache ───
const cache = new Map<string, { beschrijvingen: string[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;
// Cache version — bump to invalidate all cached descriptions
const CACHE_VERSION = 2;

// ─── Types ───
interface Sessie {
  categorie: string;
  beschrijving: string;
  startTijd: string;
  eindTijd: string;
  duurSeconden: number;
  app: string;
  projectNaam: string | null;
  klantNaam: string | null;
  projectId: number | null;
  venstertitels: string[];
  isIdle: boolean;
}

// ─── AI beschrijvingen (alleen tekst, geen categorie) ───
async function generateBeschrijvingen(sessies: Sessie[]): Promise<string[]> {
  if (sessies.length === 0) return [];

  const noiseRe = /^(Overlay Knipprogramma|Knipprogramma|Spotify|next-server|Nederlands$|Openen$|Nieuw tabblad|Rainmeter|PowerToys|PToyTray|Overloopvenster|Open Folder$|Naamloos$|localhost$)/i;
  const musicRe = /Drake|Giveon|Chicago|Premium$|Siggy/i;
  // Dashboard/localhost titles are only relevant when Code is the dominant app (= actually developing)
  const dashboardNoiseRe = /^(Autronis Dashboard|localhost:\d+)/i;

  const lines = sessies.map((s, i) => {
    const codeIsDominant = /^Code|^cursor/i.test(s.app.split(",")[0] || "");
    const titels = s.venstertitels
      .filter(t => !noiseRe.test(t) && !musicRe.test(t))
      .filter(t => codeIsDominant || !dashboardNoiseRe.test(t)) // Only keep dashboard titles if Code is dominant
      .slice(0, 15).join(" | ");
    const dur = Math.round(s.duurSeconden / 60);
    const appStr = s.app;
    return `${i + 1}. [${dur}m] Apps: ${appStr}. Titels: ${titels || "geen titels"}`;
  }).join("\n");

  const prompt = `Beschrijf elke sessie in 8-12 woorden. Kijk naar de APP TIJDEN en venstertitels.

BELANGRIJK: de app met de MEESTE minuten bepaalt de focus van de beschrijving.
- Code/cursor dominant → "Gewerkt aan [projectnaam uit titel]" (alleen als Code de meeste tijd heeft!)
- TradingView/"System Investing" dominant → investing/trading werk
- Chrome dominant → kijk naar TITELS om te bepalen wat de gebruiker DEED, niet wat er open stond
- YouTube in titels → "YouTube video's gekeken over [onderwerp uit titel]"
- Discord/Slack/WhatsApp dominant → communicatie, noem het onderwerp

KRITIEK — voorkom deze fout:
- "Autronis Dashboard" als Chrome-titel betekent NIET dat iemand aan het dashboard werkte. Het is gewoon een open tabblad.
- Alleen als Code/cursor de DOMINANTE app is EN de Code-titel "autronis-dashboard" bevat → dan werkt iemand aan het dashboard.
- Als Chrome dominant is, beschrijf WAT de gebruiker deed op basis van de INHOUDELIJKE titels (KVK, formulieren, documenten, etc.), niet de achtergrond-tabs.
- Als er geen inhoudelijke titels zijn → "Online onderzoek en administratie" of "Browser sessie" — NIET "Gewerkt aan dashboard".

Voorbeelden:
- "Code (20m), chrome (5m)" + "page.tsx — autronis-dashboard" → "Gewerkt aan Autronis dashboard pagina's"
- "chrome (25m)" + "Claude Code Agent Team - YouTube" → "YouTube video's gekeken over Claude Code Agent teams"
- "chrome (20m), Code (5m)" + "KVK inschrijving | mijn.kvk.nl" → "KVK inschrijving en bedrijfsregistratie geregeld"
- "chrome (8m), Discord (5m)" + "#links | Business" → "Business links en ideeën uitgewisseld via Discord"
- "chrome (15m), TradingView (9m)" + "System Investing V8" → "Investerings systeem bijgewerkt en marktdata geanalyseerd"
- "Code (20m)" + "schema.ts — autronis-dashboard" → "Database schema aangepast voor Autronis dashboard"
- "chrome (25m)" + "geen titels" → "Online onderzoek en browsing"

Regels:
- 8-12 woorden, Nederlands, NOOIT app namen noemen (behalve YouTube als bron)
- Focus op de app met de MEESTE tijd
- Noem SPECIFIEKE onderwerpen uit de titels (projectnamen, features, video onderwerpen)
- Achtergrond-apps en achtergrond-tabs NEGEREN
- "Autronis Dashboard" als Chrome-titel is RUIS — negeer het tenzij Code dominant is
- Begin NOOIT met "Gebruiker", "De gebruiker", "Er werd" of andere onpersoonlijke vormen
- Schrijf ALTIJD in directe stijl: "Gewerkt aan...", "Marktdata geanalyseerd...", "YouTube video's gekeken over..."
- Doe alsof je een logboek schrijft voor jezelf, niet een rapport voor iemand anders

${lines}

JSON array met exact ${sessies.length} strings:`;

  const groqKey = process.env.GROQ_API_KEY;

  // Groq API
  if (groqKey) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "llama-3.3-70b-versatile", max_tokens: 1024, messages: [{ role: "user", content: prompt }] }),
      });
      if (r.ok) {
        const d = await r.json() as { choices: Array<{ message: { content: string } }> };
        const t = d.choices?.[0]?.message?.content || "";
        const m = t.match(/\[[\s\S]*\]/);
        if (m) {
          const p = JSON.parse(m[0]) as string[];
          // Accept if length matches OR pad/trim to match
          if (p.length >= sessies.length) return p.slice(0, sessies.length);
          // If AI returned fewer, pad with fallback
          while (p.length < sessies.length) p.push(sessies[p.length].app);
          return p;
        }
      } else {
        console.error("[sessies] Groq error:", r.status, await r.text().catch(() => ""));
      }
    } catch (err) {
      console.error("[sessies] Groq exception:", err);
    }
  } else {
    console.error("[sessies] No GROQ_API_KEY found");
  }

  // OpenAI fallback
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 1024, messages: [{ role: "user", content: prompt }] }),
      });
      if (r.ok) {
        const d = await r.json() as { choices: Array<{ message: { content: string } }> };
        const t = d.choices?.[0]?.message?.content || "";
        const m = t.match(/\[[\s\S]*\]/);
        if (m) {
          const p = JSON.parse(m[0]) as string[];
          if (p.length >= sessies.length) return p.slice(0, sessies.length);
          while (p.length < sessies.length) p.push(sessies[p.length].app);
          return p;
        }
      } else {
        console.error("[sessies] OpenAI error:", r.status);
      }
    } catch (err) {
      console.error("[sessies] OpenAI exception:", err);
    }
  }

  return sessies.map(s => s.app.split(", ").filter(a => a !== "Inactief").slice(0, 2).join(", ") || "Activiteit");
}

// ─── GET /api/screen-time/sessies ───
export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { searchParams } = new URL(req.url);
    const datum = searchParams.get("datum");
    if (!datum) return NextResponse.json({ fout: "Datum is verplicht" }, { status: 400 });

    const gebruikerId = searchParams.get("gebruikerId") && gebruiker.rol === "admin"
      ? parseInt(searchParams.get("gebruikerId")!)
      : gebruiker.id;

    // Fetch entries for this day
    const entries = await db
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
      .where(and(
        eq(screenTimeEntries.gebruikerId, gebruikerId),
        sql`SUBSTR(${screenTimeEntries.startTijd}, 1, 10) = ${datum}`,
      ))
      .orderBy(asc(screenTimeEntries.startTijd))
      .all();

    // Filter system apps and idle
    const SKIP = new Set(["LockApp", "SearchHost", "ShellHost", "ShellExperienceHost", "Inactief"]);
    const active = entries.filter(e => !SKIP.has(e.app) && e.categorie !== "inactief");
    const idle = entries.filter(e => e.app === "Inactief" || e.categorie === "inactief");

    // ─── SIMPLE: Fixed 30-min slots ───
    if (active.length === 0) {
      return NextResponse.json({ sessies: [], stats: { totaalActief: 0, totaalIdle: 0, productiefPercentage: 0, aantalSessies: 0, mogelijkOnnauwkeurig: false } });
    }

    const firstTime = new Date(active[0].startTijd).getTime();
    const lastTime = new Date(active[active.length - 1].eindTijd).getTime();
    const SLOT = 30 * 60 * 1000;
    const slotStart = Math.floor(firstTime / SLOT) * SLOT;

    const slots: typeof active[] = [];
    let t = slotStart;
    while (t < lastTime) {
      const tEnd = t + SLOT;
      const slotEntries = active.filter(e => {
        const eTime = new Date(e.startTijd).getTime();
        return eTime >= t && eTime < tEnd;
      });
      if (slotEntries.length > 0) slots.push(slotEntries);
      t = tEnd;
    }

    // Fetch all active projects for title-based matching
    const alleProjecten = await db
      .select({ id: projecten.id, naam: projecten.naam, klantNaam: klanten.bedrijfsnaam })
      .from(projecten)
      .leftJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(eq(projecten.isActief, 1))
      .all();

    // Build lookup: lowercase keywords → project
    // Match on project name parts (e.g. "autronis-dashboard" matches "Autronis Dashboard")
    const projectMatchers = alleProjecten.map(p => {
      const naam = p.naam.toLowerCase();
      const variants = new Set<string>();
      // Full name + hyphenated + no-spaces
      variants.add(naam);
      variants.add(naam.replace(/\s+/g, "-"));
      variants.add(naam.replace(/\s+/g, ""));
      // Split on "/" for compound names like "Agent Office / Ops Room"
      // Each part gets its own variants (≥6 chars to avoid false positives)
      for (const part of naam.split(/\s*\/\s*/)) {
        const trimmed = part.trim();
        if (trimmed.length >= 6) {
          variants.add(trimmed);
          variants.add(trimmed.replace(/\s+/g, "-"));
          variants.add(trimmed.replace(/\s+/g, ""));
        }
      }
      return { id: p.id, naam: p.naam, klantNaam: p.klantNaam, variants: [...variants] };
    });

    function matchProject(titles: string[], _dominantApp: string): { id: number; naam: string; klantNaam: string | null } | null {
      // Match from VS Code / Cursor titles (intentional work, not background tabs)
      // Only assign if ONE project clearly dominates — skip if multiple projects are open
      const projectHits = new Map<number, { naam: string; klantNaam: string | null; count: number }>();

      for (const title of titles) {
        const vsMatch = title.match(/^.+?\s*[—-]\s*(.+?)\s*[—-]\s*Visual Studio Code$/);
        const cursorMatch = !vsMatch ? title.match(/^.+?\s*[—-]\s*(.+?)\s*[—-]\s*Cursor$/) : null;
        const editorProject = (vsMatch?.[1] || cursorMatch?.[1])?.trim().toLowerCase();
        if (editorProject) {
          for (const p of projectMatchers) {
            if (p.variants.some(v => editorProject.includes(v) || v.includes(editorProject))) {
              const existing = projectHits.get(p.id);
              projectHits.set(p.id, { naam: p.naam, klantNaam: p.klantNaam, count: (existing?.count ?? 0) + 1 });
              break;
            }
          }
        }
      }

      if (projectHits.size === 0) return null;
      // Multiple projects open → too ambiguous, don't assign
      if (projectHits.size > 1) return null;

      const [[id, hit]] = [...projectHits.entries()];
      return { id, naam: hit.naam, klantNaam: hit.klantNaam };
    }

    // Build sessies from slots — categorie from DB, never AI
    const sessies: Sessie[] = slots.map(slot => {
      const catSec: Record<string, number> = {};
      const appSec: Record<string, number> = {};
      const titles: string[] = [];
      const seen = new Set<string>();
      let pId: number | null = null;
      let pNaam: string | null = null;
      let kNaam: string | null = null;
      let projectCandidate: { id: number; naam: string | null; klant: string | null; cat: string } | null = null;

      for (const e of slot) {
        catSec[e.categorie ?? "overig"] = (catSec[e.categorie ?? "overig"] || 0) + e.duurSeconden;
        appSec[e.app] = (appSec[e.app] || 0) + e.duurSeconden;
        if (e.vensterTitel) {
          const prefix = /^[A-Z]{3,}USD.*[▲▼]/.test(e.vensterTitel) ? e.vensterTitel.slice(0, 10) : e.vensterTitel.slice(0, 50);
          if (!seen.has(prefix)) { seen.add(prefix); titles.push(e.vensterTitel); }
        }
        // Only inherit project from entries that match the dominant category
        if (!pId && e.projectId) {
          // Store candidate — we'll verify after determining dominant category
          if (!projectCandidate) projectCandidate = { id: e.projectId, naam: e.projectNaam, klant: e.klantNaam, cat: e.categorie ?? "overig" };
        }
      }

      const cat = Object.entries(catSec).sort(([, a], [, b]) => b - a)[0][0];
      const topApps = Object.entries(appSec).filter(([a]) => a !== "Inactief").sort(([, a], [, b]) => b - a).slice(0, 4);
      const dominantApp = topApps[0]?.[0] ?? "";

      // Only use DB project if it came from an entry matching the dominant category
      if (projectCandidate && projectCandidate.cat === cat) {
        pId = projectCandidate.id; pNaam = projectCandidate.naam; kNaam = projectCandidate.klant;
      }

      // If still no project, try to match from window titles (only for code editors)
      if (!pId) {
        const matched = matchProject(titles, dominantApp);
        if (matched) { pId = matched.id; pNaam = matched.naam; kNaam = matched.klantNaam; }
      }
      const appLabel = topApps.map(([a, sec]) => `${a} (${Math.round(sec / 60)}m)`).join(", ");
      const appShort = topApps.map(([a]) => a).slice(0, 3).join(", ");

      return {
        categorie: cat,
        beschrijving: appShort,
        startTijd: slot[0].startTijd,
        eindTijd: slot[slot.length - 1].eindTijd,
        duurSeconden: slot.reduce((s, e) => s + e.duurSeconden, 0),
        app: appLabel,
        projectNaam: pNaam,
        klantNaam: kNaam,
        projectId: pId,
        venstertitels: titles.slice(0, 25),
        isIdle: false,
      };
    });

    // AI beschrijvingen (tekst only, categorie stays from DB)
    const cacheKey = `v${CACHE_VERSION}:${datum}:${gebruikerId}`;
    const cached = cache.get(cacheKey);
    let beschrijvingen: string[];

    // Cache hit only if same number of sessions (slot algorithm change = cache miss)
    if (cached && cached.beschrijvingen.length === sessies.length && (Date.now() - cached.ts) < CACHE_TTL) {
      beschrijvingen = cached.beschrijvingen;
    } else {
      beschrijvingen = await generateBeschrijvingen(sessies);
      cache.set(cacheKey, { beschrijvingen, ts: Date.now() });
    }

    for (let i = 0; i < sessies.length; i++) {
      if (beschrijvingen[i]) sessies[i].beschrijving = beschrijvingen[i];
    }

    // ─── Focus Metrics ───
    const PRODUCTIEF_CATS = new Set(["development", "design", "administratie", "finance", "communicatie"]);
    const DEEP_WORK_GAP_MAX_MIN = 15; // Max gap between sessions to still count as one deep work block
    const DEEP_WORK_INTERRUPT_MAX_MIN = 5; // Short non-productive interruptions (≤5 min) don't break the block

    // Session durations in minutes (using time span, not raw duurSeconden)
    const sessieDuurMin = sessies.map(s => Math.max(0, (new Date(s.eindTijd).getTime() - new Date(s.startTijd).getTime()) / 60000));

    const totaalActief = sessies.reduce((s, sess) =>
      s + Math.max(0, (new Date(sess.eindTijd).getTime() - new Date(sess.startTijd).getTime()) / 1000), 0);
    const totaalIdle = idle.reduce((s, e) => s + e.duurSeconden, 0);

    // Productief = alles behalve afleiding en inactief
    const productiefSec = sessies
      .filter(s => !["afleiding", "inactief", "overig"].includes(s.categorie))
      .reduce((sum, s) => sum + Math.max(0, (new Date(s.eindTijd).getTime() - new Date(s.startTijd).getTime()) / 1000), 0);
    const productiefPercentage = totaalActief > 0 ? Math.min(100, Math.round((productiefSec / totaalActief) * 100)) : 0;

    // Deep work: merge consecutive productive sessions with gaps ≤10 min into blocks
    // A deep work block must be ≥25 min total
    const DEEP_WORK_BLOCK_MIN = 15;
    interface DeepWorkBlock { startTijd: string; eindTijd: string; duurMin: number; beschrijvingen: string[] }
    const deepWorkBlocks: DeepWorkBlock[] = [];
    let currentBlock: DeepWorkBlock | null = null;

    for (let i = 0; i < sessies.length; i++) {
      const isProd = PRODUCTIEF_CATS.has(sessies[i].categorie);

      if (isProd) {
        if (currentBlock) {
          // Check gap from previous block end to this session start
          const gapMin = (new Date(sessies[i].startTijd).getTime() - new Date(currentBlock.eindTijd).getTime()) / 60000;
          if (gapMin <= DEEP_WORK_GAP_MAX_MIN) {
            // Extend block (include gap time as part of the block span)
            currentBlock.eindTijd = sessies[i].eindTijd;
            currentBlock.duurMin = (new Date(currentBlock.eindTijd).getTime() - new Date(currentBlock.startTijd).getTime()) / 60000;
            if (sessies[i].beschrijving) currentBlock.beschrijvingen.push(sessies[i].beschrijving);
          } else {
            // Gap too big — save current block and start new one
            if (currentBlock.duurMin >= DEEP_WORK_BLOCK_MIN) deepWorkBlocks.push(currentBlock);
            currentBlock = {
              startTijd: sessies[i].startTijd,
              eindTijd: sessies[i].eindTijd,
              duurMin: sessieDuurMin[i],
              beschrijvingen: sessies[i].beschrijving ? [sessies[i].beschrijving] : [],
            };
          }
        } else {
          // Start new block
          currentBlock = {
            startTijd: sessies[i].startTijd,
            eindTijd: sessies[i].eindTijd,
            duurMin: sessieDuurMin[i],
            beschrijvingen: sessies[i].beschrijving ? [sessies[i].beschrijving] : [],
          };
        }
      } else {
        // Non-productive session — only breaks the block if it's longer than the interrupt threshold
        // Short interruptions (≤5 min like checking Slack, quick email) don't break deep work flow
        if (currentBlock) {
          const interruptMin = sessieDuurMin[i];
          if (interruptMin > DEEP_WORK_INTERRUPT_MAX_MIN) {
            // Long interruption or distraction — break the block
            if (currentBlock.duurMin >= DEEP_WORK_BLOCK_MIN) deepWorkBlocks.push(currentBlock);
            currentBlock = null;
          } else {
            // Short interruption — extend the block through it
            currentBlock.eindTijd = sessies[i].eindTijd;
            currentBlock.duurMin = (new Date(currentBlock.eindTijd).getTime() - new Date(currentBlock.startTijd).getTime()) / 60000;
          }
        }
      }
    }
    // Don't forget the last block
    if (currentBlock && currentBlock.duurMin >= DEEP_WORK_BLOCK_MIN) deepWorkBlocks.push(currentBlock);

    const deepWorkMinuten = Math.round(deepWorkBlocks.reduce((sum, b) => sum + b.duurMin, 0));
    const deepWorkTarget = 4 * 60; // 4 hours target per day

    // Focus sessions: productive sessions of any length
    const focusSessies = sessies.filter(s => PRODUCTIEF_CATS.has(s.categorie));
    const aantalFocusSessies = focusSessies.length;
    const gemSessieLengte = focusSessies.length > 0
      ? Math.round(focusSessies.reduce((sum, s) => {
          const idx = sessies.indexOf(s);
          return sum + sessieDuurMin[idx];
        }, 0) / focusSessies.length)
      : 0;

    // Context switches: count category changes between consecutive sessions
    let contextSwitches = 0;
    for (let i = 1; i < sessies.length; i++) {
      if (sessies[i].categorie !== sessies[i - 1].categorie) {
        contextSwitches++;
      }
    }

    // Longest focus block (from merged deep work blocks)
    const langsteBlok = deepWorkBlocks.length > 0
      ? deepWorkBlocks.reduce((best, b) => b.duurMin > best.duurMin ? b : best, deepWorkBlocks[0])
      : null;
    const langsteFocusMinuten = langsteBlok ? Math.round(langsteBlok.duurMin) : 0;
    const besteFocusBlok = langsteBlok ? {
      beschrijving: langsteBlok.beschrijvingen[0] ?? "Focus blok",
      startTijd: langsteBlok.startTijd,
      eindTijd: langsteBlok.eindTijd,
      duurMin: Math.round(langsteBlok.duurMin),
    } : null;

    // Pauzes: gaps between sessions > 5 min
    const pauzes: Array<{ start: string; eind: string; duurMinuten: number }> = [];
    for (let i = 1; i < sessies.length; i++) {
      const prevEnd = new Date(sessies[i - 1].eindTijd).getTime();
      const thisStart = new Date(sessies[i].startTijd).getTime();
      const gapMin = (thisStart - prevEnd) / 60000;
      if (gapMin >= 5) {
        pauzes.push({ start: sessies[i - 1].eindTijd, eind: sessies[i].startTijd, duurMinuten: Math.round(gapMin) });
      }
    }
    const totaalPauzeMinuten = pauzes.reduce((s, p) => s + p.duurMinuten, 0);

    // Flow score (0-100): weighted combination of metrics
    // High deep work + long sessions + few switches + low distraction = high flow
    const deepWorkRatio = Math.min(1, deepWorkMinuten / deepWorkTarget);
    const sessieLengteScore = Math.min(1, gemSessieLengte / 45); // 45 min = perfect
    const switchPenalty = Math.max(0, 1 - (contextSwitches / Math.max(sessies.length, 1)));
    const afleidingSec = sessies
      .filter(s => s.categorie === "afleiding")
      .reduce((sum, s) => sum + Math.max(0, (new Date(s.eindTijd).getTime() - new Date(s.startTijd).getTime()) / 1000), 0);
    const afleidingPenalty = totaalActief > 0 ? Math.max(0, 1 - (afleidingSec / totaalActief) * 3) : 1;
    const focusScore = sessies.length > 0
      ? Math.round((deepWorkRatio * 35 + sessieLengteScore * 25 + switchPenalty * 20 + afleidingPenalty * 20))
      : 0;

    // ─── Focus Insights ───
    const inzichten: Array<{ type: "positief" | "waarschuwing" | "tip" | "actie"; tekst: string }> = [];

    // Best time of day analysis
    const uurProductief: Record<number, number> = {};
    for (const s of sessies.filter(s => PRODUCTIEF_CATS.has(s.categorie))) {
      const uur = new Date(s.startTijd).getHours();
      const dur = (new Date(s.eindTijd).getTime() - new Date(s.startTijd).getTime()) / 60000;
      uurProductief[uur] = (uurProductief[uur] || 0) + dur;
    }
    const besteUur = Object.entries(uurProductief).sort(([, a], [, b]) => b - a)[0];
    if (besteUur) {
      inzichten.push({
        type: "positief",
        tekst: `Je meest productieve uur is ${besteUur[0]}:00 — plan je moeilijkste werk hier in.`,
      });
    }

    // Short sessions warning
    const korteSessies = focusSessies.filter((s, i) => sessieDuurMin[sessies.indexOf(s)] < 15);
    if (korteSessies.length > focusSessies.length * 0.5 && focusSessies.length >= 3) {
      inzichten.push({
        type: "waarschuwing",
        tekst: `${korteSessies.length} van ${focusSessies.length} focus sessies zijn korter dan 15 min. Probeer notificaties uit te zetten voor langere blokken.`,
      });
    }

    // Deep work achievement
    if (deepWorkMinuten >= deepWorkTarget * 0.75) {
      inzichten.push({ type: "positief", tekst: `${Math.round(deepWorkMinuten)} min deep work — je zit op ${Math.round(deepWorkMinuten / deepWorkTarget * 100)}% van je doel.` });
    } else if (deepWorkMinuten > 0) {
      const tekort = Math.round(deepWorkTarget - deepWorkMinuten);
      inzichten.push({ type: "actie", tekst: `Nog ${tekort / 60 >= 1 ? `${Math.floor(tekort / 60)}u ${tekort % 60}m` : `${tekort}m`} deep work nodig. Blokkeer je agenda voor een ononderbroken sessie.` });
    }

    // Context switch analysis
    if (contextSwitches > sessies.length * 0.7 && sessies.length >= 4) {
      inzichten.push({
        type: "waarschuwing",
        tekst: `${contextSwitches} context switches vandaag — dat kost focus. Groepeer vergelijkbare taken.`,
      });
    }

    // Distraction check
    if (afleidingSec > totaalActief * 0.15 && totaalActief > 0) {
      const afleidingMin = Math.round(afleidingSec / 60);
      inzichten.push({
        type: "actie",
        tekst: `${afleidingMin} min afleiding (${Math.round(afleidingSec / totaalActief * 100)}%). Blokkeer afleidende sites tijdens deep work.`,
      });
    } else if (afleidingSec === 0 && totaalActief > 3600) {
      inzichten.push({ type: "positief", tekst: "Geen afleiding gedetecteerd — sterke discipline vandaag." });
    }

    // Best focus block highlight
    if (besteFocusBlok && besteFocusBlok.duurMin >= 25) {
      const startStr = new Date(besteFocusBlok.startTijd).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
      inzichten.push({
        type: "positief",
        tekst: `Beste focus blok: ${Math.round(besteFocusBlok.duurMin)} min om ${startStr} — "${besteFocusBlok.beschrijving}".`,
      });
    }

    return NextResponse.json({
      sessies,
      stats: {
        totaalActief: Math.min(totaalActief, 57600),
        totaalIdle,
        productiefPercentage,
        aantalSessies: sessies.length,
        focusScore,
        contextSwitches,
        langsteFocusMinuten: Math.round(langsteFocusMinuten),
        deepWorkMinuten: Math.round(deepWorkMinuten),
        deepWorkTarget,
        deepWorkSessies: deepWorkBlocks.length,
        aantalFocusSessies,
        gemSessieLengte,
        afleidingMinuten: Math.round(afleidingSec / 60),
        besteFocusBlok,
        pauzes,
        totaalPauzeMinuten,
        inzichten,
        mogelijkOnnauwkeurig: totaalActief > 43200,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
