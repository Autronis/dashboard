import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { routines } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";

type Frequentie = "wekelijks" | "maandelijks" | "per_kwartaal";
type Categorie = "security" | "financieel" | "infra" | "kwaliteit" | "admin";

const SEED_ROUTINES: Array<{
  naam: string;
  beschrijving: string;
  categorie: Categorie;
  frequentie: Frequentie;
}> = [
  {
    naam: "Security check",
    beschrijving: "Volledige security audit: RLS policies, API keys, exposed endpoints, dependency vulnerabilities",
    categorie: "security",
    frequentie: "maandelijks",
  },
  {
    naam: "API keys rotatie",
    beschrijving: "Check of alle API keys (Anthropic, Resend, Mollie, Google, Supabase) nog geldig zijn en roteer waar nodig",
    categorie: "security",
    frequentie: "per_kwartaal",
  },
  {
    naam: "Factuur documentatie check",
    beschrijving: "Controleer of alle facturen correct bewaard zijn, PDF's aanwezig, bonnen gekoppeld aan transacties",
    categorie: "financieel",
    frequentie: "maandelijks",
  },
  {
    naam: "BTW aangifte voorbereiding",
    beschrijving: "Kwartaal BTW data controleren: inkomsten/uitgaven kloppen, ontbrekende bonnen, BTW nummers klanten",
    categorie: "financieel",
    frequentie: "per_kwartaal",
  },
  {
    naam: "Backup & data integriteit",
    beschrijving: "Check Turso backups, Vercel deployment logs, data consistentie tussen systemen",
    categorie: "infra",
    frequentie: "maandelijks",
  },
  {
    naam: "Performance & kosten review",
    beschrijving: "Vercel usage, API kosten (Anthropic/OpenAI), Turso storage, ongebruikte services opruimen",
    categorie: "infra",
    frequentie: "maandelijks",
  },
  {
    naam: "Klant contracten review",
    beschrijving: "Loop alle actieve contracten na: verloopdata, scope changes, uurtarief updates nodig?",
    categorie: "admin",
    frequentie: "per_kwartaal",
  },
  {
    naam: "Dashboard feature evaluatie",
    beschrijving: "Welke features worden gebruikt? Wat is >2 weken niet aangeraakt? Opruimen of verbeteren",
    categorie: "kwaliteit",
    frequentie: "maandelijks",
  },
  {
    naam: "n8n workflows health check",
    beschrijving: "Check alle actieve n8n workflows: errors, stale executions, credentials geldig, optimalisatie kansen",
    categorie: "infra",
    frequentie: "maandelijks",
  },
  {
    naam: "Concurrentie & markt scan",
    beschrijving: "Wat doen concurrenten? Nieuwe AI-automation tools op de markt? Pricing benchmark",
    categorie: "kwaliteit",
    frequentie: "per_kwartaal",
  },
];

const FREQ_DAGEN: Record<Frequentie, number> = {
  wekelijks: 7,
  maandelijks: 30,
  per_kwartaal: 90,
};

async function ensureSeedRoutines() {
  const existing = await db.select({ naam: routines.naam }).from(routines);
  const existingNames = new Set(existing.map((r) => r.naam));
  for (const seed of SEED_ROUTINES) {
    if (!existingNames.has(seed.naam)) {
      await db.insert(routines).values(seed);
    }
  }
}

function getStatus(laatstVoltooid: string | null, frequentie: Frequentie): "ok" | "binnenkort" | "overdue" {
  if (!laatstVoltooid) return "overdue";
  const dagen = (Date.now() - new Date(laatstVoltooid).getTime()) / (1000 * 60 * 60 * 24);
  const limiet = FREQ_DAGEN[frequentie];
  if (dagen > limiet) return "overdue";
  if (dagen > limiet * 0.8) return "binnenkort";
  return "ok";
}

// GET /api/routines — lijst van alle routines met status
export async function GET() {
  try {
    await requireAuth();
    await ensureSeedRoutines();

    const rows = await db
      .select()
      .from(routines)
      .where(eq(routines.isActief, 1))
      .orderBy(routines.categorie, routines.naam);

    const result = rows.map((r) => ({
      id: r.id,
      naam: r.naam,
      beschrijving: r.beschrijving,
      categorie: r.categorie,
      frequentie: r.frequentie,
      laatstVoltooid: r.laatstVoltooid,
      status: getStatus(r.laatstVoltooid, r.frequentie as Frequentie),
      dagenGeleden: r.laatstVoltooid
        ? Math.floor((Date.now() - new Date(r.laatstVoltooid).getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }));

    return NextResponse.json({ routines: result });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/routines — markeer routine als voltooid
// Body: { id: number }
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const { id } = (await req.json()) as { id: number };

    await db
      .update(routines)
      .set({ laatstVoltooid: new Date().toISOString() })
      .where(eq(routines.id, id));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
