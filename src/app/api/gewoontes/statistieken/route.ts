import { NextResponse } from "next/server";
import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { gewoontes, gewoonteLogboek } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function getMonthStart(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

const dagNamen = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];

function detectPatterns(habitLogs: string[], naam: string, huidigeStreak: number, completionRate: number, besteDag: string, slechteDag: string) {
  const inzichten: Array<{ type: "positief" | "waarschuwing" | "tip" | "actie"; tekst: string }> = [];

  // Streak intelligence
  if (huidigeStreak >= 21) {
    inzichten.push({ type: "positief", tekst: `"${naam}" is een gevestigde gewoonte (${huidigeStreak} dagen). Dit is wetenschappelijk bewezen als ankerpunt.` });
  } else if (huidigeStreak >= 7) {
    inzichten.push({ type: "positief", tekst: `Sterke week voor "${naam}". Nog ${21 - huidigeStreak} dagen tot het een automatisme wordt.` });
  } else if (huidigeStreak === 0 && habitLogs.length > 5) {
    inzichten.push({ type: "waarschuwing", tekst: `Je streak voor "${naam}" is verbroken. Begin vandaag opnieuw — het wordt makkelijker na dag 3.` });
  }

  // Consistency patterns
  if (completionRate >= 90) {
    inzichten.push({ type: "positief", tekst: `${completionRate}% consistentie voor "${naam}" — dat is elite-niveau. Overweeg de lat hoger te leggen.` });
  } else if (completionRate >= 70) {
    inzichten.push({ type: "tip", tekst: `${completionRate}% voor "${naam}" — goed maar niet geweldig. Focus op ${slechteDag} om naar 90%+ te gaan.` });
  } else if (completionRate < 50 && habitLogs.length > 7) {
    inzichten.push({ type: "waarschuwing", tekst: `"${naam}" heeft maar ${completionRate}% consistentie. Verlaag de drempel of koppel het aan een bestaande routine.` });
  }

  // Day pattern intelligence
  if (slechteDag !== "-" && besteDag !== "-" && slechteDag !== besteDag) {
    inzichten.push({ type: "actie", tekst: `${slechteDag} is je zwakste dag voor "${naam}". Zet een herinnering of plan het direct na het opstaan.` });
  }

  // Weekend vs weekday pattern
  const weekdayLogs = habitLogs.filter((d) => {
    const day = new Date(d).getDay();
    return day >= 1 && day <= 5;
  });
  const weekendLogs = habitLogs.filter((d) => {
    const day = new Date(d).getDay();
    return day === 0 || day === 6;
  });
  // Normalize by number of days
  const weekdayRate = weekdayLogs.length / 5;
  const weekendRate = weekendLogs.length / 2;
  if (habitLogs.length > 14 && weekendRate < weekdayRate * 0.5) {
    inzichten.push({ type: "tip", tekst: `"${naam}" zakt in het weekend. Maak een apart weekend-ritueel.` });
  }

  return inzichten;
}

export async function GET() {
  try {
    const gebruiker = await requireAuth();

    const actieveGewoontes = await db
      .select()
      .from(gewoontes)
      .where(
        and(eq(gewoontes.gebruikerId, gebruiker.id), eq(gewoontes.isActief, 1))
      )
      .all();

    if (actieveGewoontes.length === 0) {
      return NextResponse.json({
        statistieken: [],
        weekCompletionRate: 0,
        maandCompletionRate: 0,
        inzichten: [],
        vandaagFocus: null,
        badgeVoortgang: [],
      });
    }

    const nu = new Date();
    const weekStart = getWeekStart(nu);
    const maandStart = getMonthStart(nu);
    const vandaag = nu.toISOString().slice(0, 10);

    // Get all logs for the past year
    const jaarGeleden = new Date(nu);
    jaarGeleden.setFullYear(jaarGeleden.getFullYear() - 1);
    const vanDatum = jaarGeleden.toISOString().slice(0, 10);

    const alleLogs = await db
      .select()
      .from(gewoonteLogboek)
      .where(
        and(
          eq(gewoonteLogboek.gebruikerId, gebruiker.id),
          gte(gewoonteLogboek.datum, vanDatum),
          lte(gewoonteLogboek.datum, vandaag),
          eq(gewoonteLogboek.voltooid, 1)
        )
      )
      .all();

    // Today's logs
    const vandaagLogs = alleLogs.filter((l) => l.datum === vandaag);
    const vandaagSet = new Set(vandaagLogs.map((l) => l.gewoonteId));

    const alleInzichten: Array<{ type: "positief" | "waarschuwing" | "tip" | "actie"; tekst: string }> = [];

    // Calculate per-habit statistics
    const statistieken = actieveGewoontes.map((gewoonte) => {
      const habitLogs = alleLogs
        .filter((l) => l.gewoonteId === gewoonte.id)
        .map((l) => l.datum)
        .sort();

      // Current streak
      let huidigeStreak = 0;
      const checkDatum = new Date(vandaag);

      while (true) {
        const datumStr = checkDatum.toISOString().slice(0, 10);
        if (habitLogs.includes(datumStr)) {
          huidigeStreak++;
          checkDatum.setDate(checkDatum.getDate() - 1);
        } else if (datumStr === vandaag) {
          checkDatum.setDate(checkDatum.getDate() - 1);
        } else {
          break;
        }
      }

      // Longest streak
      let langsteStreak = 0;
      let currentRun = 0;
      const sortedDates = [...new Set(habitLogs)].sort();
      for (let i = 0; i < sortedDates.length; i++) {
        if (i === 0) {
          currentRun = 1;
        } else {
          const prev = new Date(sortedDates[i - 1]);
          const curr = new Date(sortedDates[i]);
          const diffDays = Math.round(
            (curr.getTime() - prev.getTime()) / 86400000
          );
          currentRun = diffDays === 1 ? currentRun + 1 : 1;
        }
        langsteStreak = Math.max(langsteStreak, currentRun);
      }

      // Week / month completion
      const weekLogs = habitLogs.filter((d) => d >= weekStart);
      const maandLogs = habitLogs.filter((d) => d >= maandStart);

      // Heatmap
      const heatmap: Record<string, number> = {};
      for (const datum of habitLogs) {
        heatmap[datum] = (heatmap[datum] || 0) + 1;
      }

      // Day-of-week stats
      const dagTelling: Record<number, number> = {};
      for (const datum of habitLogs) {
        const dag = new Date(datum).getDay();
        dagTelling[dag] = (dagTelling[dag] || 0) + 1;
      }

      let besteDag = "-";
      let maxDagCount = 0;
      for (const [dag, count] of Object.entries(dagTelling)) {
        if (count > maxDagCount) {
          maxDagCount = count;
          besteDag = dagNamen[Number(dag)];
        }
      }

      let slechteDag = "-";
      let minDagCount = Infinity;
      for (let d = 0; d < 7; d++) {
        const count = dagTelling[d] || 0;
        if (count < minDagCount) {
          minDagCount = count;
          slechteDag = dagNamen[d];
        }
      }

      // Completion rate
      const aantalDagen = Math.max(
        1,
        Math.ceil(
          (nu.getTime() - new Date(gewoonte.aangemaaktOp || vanDatum).getTime()) / 86400000
        )
      );
      const completionRate = Math.round((sortedDates.length / aantalDagen) * 100);

      // Trend: last 7 days vs previous 7 days
      const last7 = new Date(nu);
      last7.setDate(last7.getDate() - 7);
      const prev7 = new Date(nu);
      prev7.setDate(prev7.getDate() - 14);
      const recentLogs = sortedDates.filter((d) => d >= last7.toISOString().slice(0, 10));
      const vorigeLogs = sortedDates.filter((d) => d >= prev7.toISOString().slice(0, 10) && d < last7.toISOString().slice(0, 10));
      const trend = recentLogs.length - vorigeLogs.length; // positive = improving

      // Detect patterns and add to global insights
      if (sortedDates.length > 3) {
        const patterns = detectPatterns(habitLogs, gewoonte.naam, huidigeStreak, completionRate, besteDag, slechteDag);
        alleInzichten.push(...patterns);
      }

      return {
        id: gewoonte.id,
        naam: gewoonte.naam,
        icoon: gewoonte.icoon,
        doel: gewoonte.doel,
        waarom: gewoonte.waarom,
        verwachteTijd: gewoonte.verwachteTijd,
        huidigeStreak,
        langsteStreak,
        weekVoltooid: weekLogs.length,
        maandVoltooid: maandLogs.length,
        totaalVoltooid: sortedDates.length,
        completionRate,
        besteDag,
        slechteDag,
        heatmap,
        trend,
        voltooidVandaag: vandaagSet.has(gewoonte.id),
        dagTelling,
      };
    });

    // Overall rates
    const dagenInWeek = Math.max(1, Math.min(7, Math.ceil((nu.getTime() - new Date(weekStart).getTime()) / 86400000) + 1));
    const dagenInMaand = Math.max(1, Math.min(31, Math.ceil((nu.getTime() - new Date(maandStart).getTime()) / 86400000) + 1));
    const weekTotaal = statistieken.reduce((s, h) => s + h.weekVoltooid, 0);
    const maandTotaal = statistieken.reduce((s, h) => s + h.maandVoltooid, 0);
    const weekCompletionRate = Math.round((weekTotaal / (actieveGewoontes.length * dagenInWeek)) * 100);
    const maandCompletionRate = Math.round((maandTotaal / (actieveGewoontes.length * dagenInMaand)) * 100);

    // ─── Today focus: prioritize habits not yet done, sorted by streak (protect streaks first) ───
    const nietGedaan = statistieken
      .filter((s) => !s.voltooidVandaag)
      .sort((a, b) => b.huidigeStreak - a.huidigeStreak); // highest streak first = most to lose
    const vandaagFocus = nietGedaan.map((s) => ({
      id: s.id,
      naam: s.naam,
      icoon: s.icoon,
      streak: s.huidigeStreak,
      verwachteTijd: s.verwachteTijd,
      besteDag: s.besteDag,
      reden: s.huidigeStreak > 0
        ? `Bescherm je ${s.huidigeStreak}-dagen streak`
        : s.totaalVoltooid === 0
          ? "Eerste keer — begin hier"
          : "Begin vandaag",
    }));

    // ─── Badge progress ───
    const maxStreak = Math.max(...statistieken.map((s) => s.huidigeStreak), 0);
    const maxLangsteStreak = Math.max(...statistieken.map((s) => s.langsteStreak), 0);
    const gemRate = statistieken.length > 0 ? statistieken.reduce((s, st) => s + st.completionRate, 0) / statistieken.length : 0;
    const maxWeekVoltooid = Math.max(...statistieken.map((s) => s.weekVoltooid), 0);
    const maxTotaalVoltooid = Math.max(...statistieken.map((s) => s.totaalVoltooid), 0);

    const badgeVoortgang = [
      { naam: "7 dagen streak", icoon: "Flame", kleur: "orange", behaald: maxStreak >= 7, huidig: Math.min(maxStreak, 7), doel: 7, tip: "Doe elke dag mee om je streak te beschermen" },
      { naam: "30 dagen streak", icoon: "Flame", kleur: "red", behaald: maxLangsteStreak >= 30, huidig: Math.min(maxLangsteStreak, 30), doel: 30, tip: "Consistentie is de sleutel — mis geen dag" },
      { naam: "Week perfect", icoon: "Star", kleur: "yellow", behaald: maxWeekVoltooid >= 7, huidig: Math.min(maxWeekVoltooid, 7), doel: 7, tip: "Alle gewoontes elke dag van de week" },
      { naam: "80% consistent", icoon: "TrendingUp", kleur: "emerald", behaald: gemRate >= 80, huidig: Math.min(Math.round(gemRate), 80), doel: 80, tip: "Verhoog je dagelijkse consistentie" },
      { naam: "5 gewoontes", icoon: "Crown", kleur: "purple", behaald: statistieken.length >= 5, huidig: Math.min(statistieken.length, 5), doel: 5, tip: "Voeg meer gewoontes toe aan je routine" },
      { naam: "100 keer voltooid", icoon: "Trophy", kleur: "teal", behaald: maxTotaalVoltooid >= 100, huidig: Math.min(maxTotaalVoltooid, 100), doel: 100, tip: "Blijf loggen — elke dag telt" },
    ];

    // ─── Week stats explanation ───
    const weekUitleg = `${weekTotaal} van ${actieveGewoontes.length * dagenInWeek} mogelijke check-ins deze week (${actieveGewoontes.length} gewoontes × ${dagenInWeek} dagen)`;
    const maandUitleg = `${maandTotaal} van ${actieveGewoontes.length * dagenInMaand} mogelijke check-ins deze maand`;

    return NextResponse.json({
      statistieken,
      weekCompletionRate,
      maandCompletionRate,
      weekUitleg,
      maandUitleg,
      inzichten: alleInzichten.slice(0, 8), // max 8 insights
      vandaagFocus,
      badgeVoortgang,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Onbekende fout";
    if (msg === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: msg }, { status: 401 });
    }
    return NextResponse.json({ fout: msg }, { status: 500 });
  }
}
