import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { gewoontes, gewoonteLogboek, screenTimeEntries, tijdregistraties, projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";

const STANDAARD_GEWOONTES = [
  { naam: "Sporten", icoon: "Dumbbell", streefwaarde: null, frequentie: "dagelijks", doel: "Fit en energiek blijven", waarom: "Meer energie voor werk en focus" },
  { naam: "Lezen", icoon: "BookOpen", streefwaarde: "30 min", frequentie: "dagelijks", doel: "1 boek per maand", waarom: "Kennis opbouwen en scherp blijven" },
  { naam: "Content posten", icoon: "Megaphone", streefwaarde: "LinkedIn", frequentie: "dagelijks", doel: "Thought leadership opbouwen", waarom: "Zichtbaarheid en leads genereren" },
  { naam: "Netwerken", icoon: "Users", streefwaarde: "2x per week", frequentie: "weekelijks", doel: "Sterker netwerk", waarom: "Nieuwe kansen en samenwerkingen" },
  { naam: "Sales outreach", icoon: "Target", streefwaarde: "1 lead opvolgen", frequentie: "dagelijks", doel: "Pipeline vullen", waarom: "Consistente omzetgroei" },
  { naam: "Leren / cursus", icoon: "GraduationCap", streefwaarde: "30 min", frequentie: "dagelijks", doel: "Nieuwe skills leren", waarom: "Voorsprong houden in AI/automation" },
  { naam: "Water drinken", icoon: "Sparkles", streefwaarde: "2 liter", frequentie: "dagelijks", doel: "Gehydrateerd blijven", waarom: "Betere focus en concentratie" },
  { naam: "Voor 23:00 slapen", icoon: "Calendar", streefwaarde: null, frequentie: "dagelijks", doel: "Consistent slaapritme", waarom: "Meer energie de volgende dag" },
];

const ICON_MAP: Record<string, string> = {
  focus: "Target",
  pauze: "Calendar",
  admin: "Lightbulb",
  leren: "GraduationCap",
  gezondheid: "Dumbbell",
  content: "Megaphone",
  sales: "Target",
  communicatie: "Users",
  planning: "Calendar",
  reflectie: "Sparkles",
  default: "Star",
};

// ─── AI-powered suggestions based on user data ───
async function generateAiSuggesties(
  bestaandeNamen: Set<string>,
  gebruikerId: number
): Promise<Array<{ naam: string; icoon: string; streefwaarde: string | null; frequentie: string; doel: string; waarom: string; bron: string }>> {
  const suggesties: Array<{ naam: string; icoon: string; streefwaarde: string | null; frequentie: string; doel: string; waarom: string; bron: string }> = [];

  try {
    // 1. Analyze screen time patterns (last 14 days)
    const veertienDagenGeleden = new Date();
    veertienDagenGeleden.setDate(veertienDagenGeleden.getDate() - 14);
    const vanDatum = veertienDagenGeleden.toISOString();

    const screenTimeStats = db
      .select({
        categorie: screenTimeEntries.categorie,
        totaalSec: sql<number>`SUM(${screenTimeEntries.duurSeconden})`,
      })
      .from(screenTimeEntries)
      .where(
        and(
          eq(screenTimeEntries.gebruikerId, gebruikerId),
          gte(screenTimeEntries.startTijd, vanDatum)
        )
      )
      .groupBy(screenTimeEntries.categorie)
      .all();

    const catTotals: Record<string, number> = {};
    for (const s of screenTimeStats) {
      if (s.categorie) catTotals[s.categorie] = s.totaalSec;
    }
    const totaalScreenTime = Object.values(catTotals).reduce((s, v) => s + v, 0);

    // 2. Check afleiding percentage
    const afleidingSec = catTotals["afleiding"] || 0;
    const afleidingPct = totaalScreenTime > 0 ? (afleidingSec / totaalScreenTime) * 100 : 0;

    if (afleidingPct > 10 && !bestaandeNamen.has("digital detox")) {
      suggesties.push({
        naam: "Digital detox moment",
        icoon: "Shield",
        streefwaarde: "30 min zonder scherm",
        frequentie: "dagelijks",
        doel: "Minder schermtijd afleiding",
        waarom: `Je besteedt ${Math.round(afleidingPct)}% aan afleiding — een bewust moment offline helpt`,
        bron: "screen-time",
      });
    }

    // 3. Check if development is dominant → suggest deep work blocks
    const devSec = catTotals["development"] || 0;
    const devPct = totaalScreenTime > 0 ? (devSec / totaalScreenTime) * 100 : 0;

    if (devPct > 50 && !bestaandeNamen.has("deep work blok")) {
      suggesties.push({
        naam: "Deep work blok",
        icoon: "Target",
        streefwaarde: "2 uur ononderbroken",
        frequentie: "dagelijks",
        doel: "Minimaal 4 uur deep work per dag",
        waarom: "Je werkt veel aan development — gestructureerde deep work verhoogt je output",
        bron: "screen-time",
      });
    }

    // 4. Check if no pauzes are taken (long continuous sessions)
    if (devSec > 4 * 3600 && !bestaandeNamen.has("actieve pauze")) {
      suggesties.push({
        naam: "Actieve pauze",
        icoon: "Dumbbell",
        streefwaarde: "5 min bewegen per 2 uur",
        frequentie: "dagelijks",
        doel: "Voorkom RSI en vermoeidheid",
        waarom: "Lange dev-sessies zonder pauze verlagen je focus na 2 uur",
        bron: "screen-time",
      });
    }

    // 5. Check communicatie time → suggest networking if low
    const commSec = catTotals["communicatie"] || 0;
    const commPct = totaalScreenTime > 0 ? (commSec / totaalScreenTime) * 100 : 0;

    if (commPct < 5 && !bestaandeNamen.has("netwerken") && !bestaandeNamen.has("check in met team")) {
      suggesties.push({
        naam: "Check in met team",
        icoon: "Users",
        streefwaarde: "15 min",
        frequentie: "dagelijks",
        doel: "Betere communicatie",
        waarom: "Je besteedt weinig tijd aan communicatie — korte check-ins voorkomen miscommunicatie",
        bron: "screen-time",
      });
    }

    // 6. Check active projects → suggest project-specific habits
    const actieveProjecten = db
      .select({ naam: projecten.naam })
      .from(projecten)
      .where(and(eq(projecten.isActief, 1), eq(projecten.status, "actief")))
      .all();

    if (actieveProjecten.length > 3 && !bestaandeNamen.has("dagelijkse planning")) {
      suggesties.push({
        naam: "Dagelijkse planning",
        icoon: "Calendar",
        streefwaarde: "10 min ochtendplanning",
        frequentie: "dagelijks",
        doel: "Focus op de juiste taken",
        waarom: `Je hebt ${actieveProjecten.length} actieve projecten — een dagplan voorkomt context-switching`,
        bron: "projecten",
      });
    }

    // 7. Evening reflection/review
    if (!bestaandeNamen.has("dag review") && !bestaandeNamen.has("reflectie")) {
      suggesties.push({
        naam: "Dag review",
        icoon: "Sparkles",
        streefwaarde: "5 min",
        frequentie: "dagelijks",
        doel: "Bewust afsluiten",
        waarom: "Kort reflecteren op wat je hebt bereikt helpt met motivatie en focus voor morgen",
        bron: "standaard",
      });
    }

    // 8. Admin/finance time check
    const adminSec = catTotals["administratie"] || 0;
    const financeSec = catTotals["finance"] || 0;
    const adminFinancePct = totaalScreenTime > 0 ? ((adminSec + financeSec) / totaalScreenTime) * 100 : 0;

    if (adminFinancePct > 15 && !bestaandeNamen.has("admin blok")) {
      suggesties.push({
        naam: "Admin blok",
        icoon: "Lightbulb",
        streefwaarde: "1 vaste tijd per dag",
        frequentie: "dagelijks",
        doel: "Admin niet laten uitlekken in productieve tijd",
        waarom: `${Math.round(adminFinancePct)}% van je tijd gaat naar admin/finance — bundel dit in één blok`,
        bron: "screen-time",
      });
    }

    // 9. Suggest learning based on what they work on
    if (devPct > 40 && !bestaandeNamen.has("leren / cursus") && !bestaandeNamen.has("tech leren")) {
      suggesties.push({
        naam: "Tech leren",
        icoon: "GraduationCap",
        streefwaarde: "20 min per dag",
        frequentie: "dagelijks",
        doel: "Nieuwe tools en frameworks leren",
        waarom: "Je werkt dagelijks met code — gerichte leertijd houdt je skills scherp",
        bron: "screen-time",
      });
    }

  } catch {
    // Silent fail — fallback to standard suggestions
  }

  return suggesties;
}

export async function GET() {
  try {
    const gebruiker = await requireAuth();

    const items = db
      .select()
      .from(gewoontes)
      .where(
        and(
          eq(gewoontes.gebruikerId, gebruiker.id),
          eq(gewoontes.isActief, 1)
        )
      )
      .orderBy(gewoontes.volgorde)
      .all();

    // Get today's logs
    const vandaag = new Date().toISOString().slice(0, 10);
    const logs = db
      .select()
      .from(gewoonteLogboek)
      .where(
        and(
          eq(gewoonteLogboek.gebruikerId, gebruiker.id),
          eq(gewoonteLogboek.datum, vandaag)
        )
      )
      .all();

    const logMap = new Map(logs.map((l) => [l.gewoonteId, l]));

    const result = items.map((g) => ({
      ...g,
      voltooidVandaag: logMap.has(g.id) && logMap.get(g.id)!.voltooid === 1,
    }));

    // Build suggestions: standard + AI-powered
    const bestaandeNamen = new Set(items.map((g) => g.naam.toLowerCase()));

    const standaardSuggesties = STANDAARD_GEWOONTES
      .filter((s) => !bestaandeNamen.has(s.naam.toLowerCase()))
      .map((s) => ({ ...s, bron: "standaard" }));

    const aiSuggesties = await generateAiSuggesties(bestaandeNamen, gebruiker.id);

    // Merge: AI suggestions first (more relevant), then standard
    const alleSuggesties = [
      ...aiSuggesties.filter((s) => !bestaandeNamen.has(s.naam.toLowerCase())),
      ...standaardSuggesties.filter((s) => !aiSuggesties.some((ai) => ai.naam.toLowerCase() === s.naam.toLowerCase())),
    ];

    return NextResponse.json({
      gewoontes: result,
      suggesties: alleSuggesties,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Onbekende fout";
    if (msg === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: msg }, { status: 401 });
    }
    return NextResponse.json({ fout: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();

    const { naam, icoon, frequentie, streefwaarde, doel, waarom, verwachteTijd } = body;
    if (!naam) {
      return NextResponse.json({ fout: "Naam is verplicht" }, { status: 400 });
    }

    // Get max volgorde
    const maxVolgorde = db
      .select({ volgorde: gewoontes.volgorde })
      .from(gewoontes)
      .where(eq(gewoontes.gebruikerId, gebruiker.id))
      .orderBy(gewoontes.volgorde)
      .all();
    const nextVolgorde = maxVolgorde.length > 0
      ? Math.max(...maxVolgorde.map((v) => v.volgorde ?? 0)) + 1
      : 0;

    const result = db
      .insert(gewoontes)
      .values({
        gebruikerId: gebruiker.id,
        naam,
        icoon: icoon || "Target",
        frequentie: frequentie || "dagelijks",
        streefwaarde: streefwaarde || null,
        doel: doel || null,
        waarom: waarom || null,
        verwachteTijd: verwachteTijd || null,
        volgorde: nextVolgorde,
      })
      .returning()
      .get();

    return NextResponse.json({ gewoonte: result }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Onbekende fout";
    if (msg === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: msg }, { status: 401 });
    }
    return NextResponse.json({ fout: msg }, { status: 500 });
  }
}
