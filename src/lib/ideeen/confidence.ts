import { db } from "@/lib/db";
import { ideeen, meetings, leadActiviteiten, radarItems, concurrenten, projecten } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { aiCompleteJson } from "@/lib/ai/client";

// ============ TYPES ============

export interface KlantbehoefteSource {
  type: "meeting" | "lead_activiteit";
  id: number;
  titel: string;
}

export interface ConfidenceBreakdown {
  totaal: number;
  klantbehoefte: {
    score: number; // 0-100
    gewogen: number; // * 0.4
    bronnen: KlantbehoefteSource[];
    aantalBronnen: number;
  };
  marktvalidatie: {
    score: number; // 0-100
    gewogen: number; // * 0.25
    radarMatch: boolean;
    concurrentMatch: boolean;
  };
  autronIsFit: {
    score: number; // 0-100
    gewogen: number; // * 0.2
    uitleg: string;
  };
  effortRoi: {
    score: number; // 0-100
    gewogen: number; // * 0.15
    uren: number;
    omzet: number;
    ratio: number;
  };
}

// ============ HELPERS ============

function extractKeywords(tekst: string): string[] {
  return tekst
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .filter((w) => !["voor", "deze", "door", "over", "waar", "geen", "zijn", "heeft", "maar", "meer", "ook", "wordt", "zoals", "kunnen", "wordt", "worden", "hebben", "naar", "werd", "werd", "that", "with", "from", "this", "will", "have", "been", "they", "them", "their"].includes(w));
}

function matchesKeywords(tekst: string, keywords: string[]): boolean {
  if (!tekst) return false;
  const normalized = tekst.toLowerCase();
  const matches = keywords.filter((kw) => normalized.includes(kw));
  return matches.length >= 2;
}

// ============ SUB-CALCULATIONS ============

async function berekenKlantbehoefte(
  ideeNaam: string,
  ideeOmschrijving: string | null
): Promise<ConfidenceBreakdown["klantbehoefte"]> {
  const tekst = `${ideeNaam} ${ideeOmschrijving ?? ""}`;
  const keywords = extractKeywords(tekst);

  const bronnen: KlantbehoefteSource[] = [];

  // Scan meetings with status "klaar"
  try {
    const klareMeetings = await db
      .select({ id: meetings.id, titel: meetings.titel, transcript: meetings.transcript })
      .from(meetings)
      .where(eq(meetings.status, "klaar"))
      .all();

    for (const meeting of klareMeetings) {
      const zoekTekst = `${meeting.transcript ?? ""} ${meeting.titel}`;
      if (matchesKeywords(zoekTekst, keywords)) {
        bronnen.push({ type: "meeting", id: meeting.id, titel: meeting.titel });
      }
    }
  } catch {
    // Continue with partial data
  }

  // Scan lead activiteiten with type "notitie_toegevoegd"
  try {
    const notities = await db
      .select({ id: leadActiviteiten.id, titel: leadActiviteiten.titel, omschrijving: leadActiviteiten.omschrijving })
      .from(leadActiviteiten)
      .where(eq(leadActiviteiten.type, "notitie_toegevoegd"))
      .all();

    for (const notitie of notities) {
      const zoekTekst = `${notitie.omschrijving ?? ""} ${notitie.titel}`;
      if (matchesKeywords(zoekTekst, keywords)) {
        bronnen.push({ type: "lead_activiteit", id: notitie.id, titel: notitie.titel });
      }
    }
  } catch {
    // Continue with partial data
  }

  const aantalBronnen = bronnen.length;
  let score = 0;
  if (aantalBronnen === 1) score = 25;
  else if (aantalBronnen === 2) score = 50;
  else if (aantalBronnen >= 3) score = 100;

  return {
    score,
    gewogen: Math.round(score * 0.4),
    bronnen,
    aantalBronnen,
  };
}

async function berekenMarktvalidatie(
  ideeNaam: string,
  ideeOmschrijving: string | null
): Promise<ConfidenceBreakdown["marktvalidatie"]> {
  const tekst = `${ideeNaam} ${ideeOmschrijving ?? ""}`;
  const keywords = extractKeywords(tekst);

  let radarMatch = false;
  let concurrentMatch = false;

  // Scan radar items with score >= 7
  try {
    const topRadar = await db
      .select({ id: radarItems.id, titel: radarItems.titel, aiSamenvatting: radarItems.aiSamenvatting })
      .from(radarItems)
      .where(sql`${radarItems.score} >= 7`)
      .all();

    for (const item of topRadar) {
      const zoekTekst = `${item.titel} ${item.aiSamenvatting ?? ""}`;
      if (matchesKeywords(zoekTekst, keywords)) {
        radarMatch = true;
        break;
      }
    }
  } catch {
    // Continue with partial data
  }

  // Scan concurrenten for matches
  try {
    const alleConcurrenten = await db
      .select({ id: concurrenten.id, naam: concurrenten.naam, beschrijving: concurrenten.beschrijving, diensten: concurrenten.diensten })
      .from(concurrenten)
      .where(eq(concurrenten.isActief, 1))
      .all();

    for (const concurrent of alleConcurrenten) {
      const zoekTekst = `${concurrent.naam} ${concurrent.beschrijving ?? ""} ${concurrent.diensten ?? ""}`;
      if (matchesKeywords(zoekTekst, keywords)) {
        concurrentMatch = true;
        break;
      }
    }
  } catch {
    // Continue with partial data
  }

  let score = 0;
  if (radarMatch && concurrentMatch) score = 100;
  else if (concurrentMatch) score = 100;
  else if (radarMatch) score = 50;

  return {
    score,
    gewogen: Math.round(score * 0.25),
    radarMatch,
    concurrentMatch,
  };
}

async function berekenAutronisFit(
  ideeNaam: string,
  ideeOmschrijving: string | null
): Promise<ConfidenceBreakdown["autronIsFit"]> {
  const defaultResult = { score: 50, gewogen: Math.round(50 * 0.2), uitleg: "Standaard score" };

  try {
    // Get active project names for context
    const actieveProjecten = await db
      .select({ naam: projecten.naam })
      .from(projecten)
      .where(and(eq(projecten.status, "actief"), eq(projecten.isActief, 1)))
      .all();

    const projectNamen = actieveProjecten.map((p) => p.naam).join(", ");

    const result = await aiCompleteJson<{ score: number; uitleg: string }>({
      prompt: `Beoordeel of dit idee past bij Autronis, een 2-persoens tech bureau (Sem en Syb) gespecialiseerd in AI-integraties, workflow automatisering en dashboards voor het MKB.

Idee: "${ideeNaam}"
Omschrijving: "${ideeOmschrijving ?? "Geen omschrijving"}"

Huidige actieve projecten: ${projectNamen || "Geen actieve projecten"}

Geef een score van 0-100 (100 = perfect fit) en een korte uitleg.
Antwoord als JSON: { "score": 75, "uitleg": "korte zin" }
Alleen JSON, geen uitleg erbuiten.`,
      maxTokens: 200,
    });

    const score = Math.max(0, Math.min(100, Math.round(result.score)));
    return {
      score,
      gewogen: Math.round(score * 0.2),
      uitleg: result.uitleg || "Geen uitleg beschikbaar",
    };
  } catch {
    return defaultResult;
  }
}

async function berekenEffortRoi(
  ideeNaam: string,
  ideeOmschrijving: string | null
): Promise<ConfidenceBreakdown["effortRoi"]> {
  const defaultResult = { score: 50, gewogen: Math.round(50 * 0.15), uren: 0, omzet: 0, ratio: 0 };

  try {
    const result = await aiCompleteJson<{ uren: number; omzet: number }>({
      prompt: `Schat de effort en ROI voor dit idee van Autronis, een 2-persoons tech bureau.

Idee: "${ideeNaam}"
Omschrijving: "${ideeOmschrijving ?? "Geen omschrijving"}"

Schat:
- uren: totale bouwtijd in uren (realistisch voor 2-mans bureau)
- omzet: verwachte omzet in euro's op jaarbasis (of eenmalig als SaaS niet van toepassing)

Antwoord als JSON: { "uren": 40, "omzet": 5000 }
Alleen JSON, geen uitleg.`,
      maxTokens: 150,
    });

    const uren = Math.max(1, result.uren || 1);
    const omzet = Math.max(0, result.omzet || 0);
    const ratio = omzet / uren;

    let score = 25;
    if (ratio > 150) score = 100;
    else if (ratio > 100) score = 75;
    else if (ratio > 50) score = 50;

    return {
      score,
      gewogen: Math.round(score * 0.15),
      uren,
      omzet,
      ratio: Math.round(ratio),
    };
  } catch {
    return defaultResult;
  }
}

// ============ EXPORTS ============

export async function berekenConfidence(ideeId: number): Promise<ConfidenceBreakdown> {
  const idee = await db
    .select({ id: ideeen.id, naam: ideeen.naam, omschrijving: ideeen.omschrijving })
    .from(ideeen)
    .where(eq(ideeen.id, ideeId))
    .get();

  if (!idee) throw new Error(`Idee ${ideeId} niet gevonden`);

  const [klantbehoefte, marktvalidatie, autronIsFit, effortRoi] = await Promise.all([
    berekenKlantbehoefte(idee.naam, idee.omschrijving),
    berekenMarktvalidatie(idee.naam, idee.omschrijving),
    berekenAutronisFit(idee.naam, idee.omschrijving),
    berekenEffortRoi(idee.naam, idee.omschrijving),
  ]);

  const totaal = klantbehoefte.gewogen + marktvalidatie.gewogen + autronIsFit.gewogen + effortRoi.gewogen;

  return {
    totaal: Math.min(100, totaal),
    klantbehoefte,
    marktvalidatie,
    autronIsFit,
    effortRoi,
  };
}

export async function updateConfidence(ideeId: number): Promise<void> {
  const breakdown = await berekenConfidence(ideeId);

  await db
    .update(ideeen)
    .set({
      aiScore: breakdown.totaal,
      confidenceBreakdown: JSON.stringify(breakdown),
      confidenceBijgewerktOp: new Date().toISOString(),
    })
    .where(eq(ideeen.id, ideeId));
}

export async function updateAllConfidence(): Promise<number> {
  const rijen = await db
    .select({ id: ideeen.id })
    .from(ideeen)
    .where(sql`${ideeen.status} IN ('idee', 'uitgewerkt')`)
    .all();

  let bijgewerkt = 0;

  for (const rij of rijen) {
    try {
      await updateConfidence(rij.id);
      bijgewerkt++;
    } catch {
      // Skip failed items, continue with rest
    }
  }

  return bijgewerkt;
}
