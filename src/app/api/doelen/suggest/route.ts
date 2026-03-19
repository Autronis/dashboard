import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

// Lightweight KR suggestion — no AI API call, rule-based
const SUGGESTION_MAP: Record<string, { krs: { titel: string; doelwaarde: number; eenheid: string; autoKoppeling: string }[] }> = {
  // Revenue / Growth
  omzet: {
    krs: [
      { titel: "Maandelijkse omzet verhogen", doelwaarde: 10000, eenheid: "euro", autoKoppeling: "omzet" },
      { titel: "Nieuwe proposals versturen", doelwaarde: 5, eenheid: "stuks", autoKoppeling: "geen" },
      { titel: "Nieuwe klanten binnenhalen", doelwaarde: 2, eenheid: "stuks", autoKoppeling: "klanten" },
      { titel: "Gemiddelde dealgrootte verhogen", doelwaarde: 5000, eenheid: "euro", autoKoppeling: "geen" },
    ],
  },
  groei: {
    krs: [
      { titel: "Omzet dit kwartaal", doelwaarde: 30000, eenheid: "euro", autoKoppeling: "omzet" },
      { titel: "Pipeline waarde opbouwen", doelwaarde: 50000, eenheid: "euro", autoKoppeling: "geen" },
      { titel: "Actieve klanten uitbreiden", doelwaarde: 5, eenheid: "stuks", autoKoppeling: "klanten" },
    ],
  },
  klanten: {
    krs: [
      { titel: "Nieuwe klanten werven", doelwaarde: 3, eenheid: "stuks", autoKoppeling: "klanten" },
      { titel: "Klant retentie boven 90%", doelwaarde: 90, eenheid: "%", autoKoppeling: "geen" },
      { titel: "NPS score verbeteren", doelwaarde: 8, eenheid: "score", autoKoppeling: "geen" },
      { titel: "Upsell bij bestaande klanten", doelwaarde: 2, eenheid: "stuks", autoKoppeling: "geen" },
    ],
  },
  // Product
  product: {
    krs: [
      { titel: "Product live zetten", doelwaarde: 100, eenheid: "%", autoKoppeling: "geen" },
      { titel: "Eerste gebruikers onboarden", doelwaarde: 5, eenheid: "stuks", autoKoppeling: "geen" },
      { titel: "Bugs oplossen na launch", doelwaarde: 0, eenheid: "stuks", autoKoppeling: "geen" },
    ],
  },
  lanceren: {
    krs: [
      { titel: "MVP afgerond", doelwaarde: 100, eenheid: "%", autoKoppeling: "geen" },
      { titel: "Beta testers werven", doelwaarde: 10, eenheid: "stuks", autoKoppeling: "geen" },
      { titel: "Feedback verzamelen", doelwaarde: 5, eenheid: "stuks", autoKoppeling: "geen" },
    ],
  },
  // Efficiency
  efficiency: {
    krs: [
      { titel: "Billable uren ratio", doelwaarde: 80, eenheid: "%", autoKoppeling: "geen" },
      { titel: "Admin tijd reduceren", doelwaarde: 2, eenheid: "uren/week", autoKoppeling: "geen" },
      { titel: "Processen automatiseren", doelwaarde: 3, eenheid: "stuks", autoKoppeling: "geen" },
    ],
  },
  uren: {
    krs: [
      { titel: "Urencriterium halen", doelwaarde: 1225, eenheid: "uren", autoKoppeling: "uren" },
      { titel: "Billable uren per week", doelwaarde: 32, eenheid: "uren", autoKoppeling: "geen" },
      { titel: "Non-billable onder 20%", doelwaarde: 20, eenheid: "%", autoKoppeling: "geen" },
    ],
  },
  // Visibility
  zichtbaarheid: {
    krs: [
      { titel: "LinkedIn posts publiceren", doelwaarde: 12, eenheid: "stuks", autoKoppeling: "geen" },
      { titel: "Case studies publiceren", doelwaarde: 3, eenheid: "stuks", autoKoppeling: "geen" },
      { titel: "Website bezoekers per week", doelwaarde: 100, eenheid: "stuks", autoKoppeling: "geen" },
    ],
  },
  content: {
    krs: [
      { titel: "Blog posts schrijven", doelwaarde: 4, eenheid: "stuks", autoKoppeling: "geen" },
      { titel: "Video content maken", doelwaarde: 4, eenheid: "stuks", autoKoppeling: "geen" },
      { titel: "Email lijst uitbreiden", doelwaarde: 50, eenheid: "subscribers", autoKoppeling: "geen" },
    ],
  },
};

// POST /api/doelen/suggest — suggest KRs based on goal title
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json() as { titel: string };

    if (!body.titel?.trim()) {
      return NextResponse.json({ suggesties: [] });
    }

    const titleLower = body.titel.toLowerCase();
    const words = titleLower.split(/\s+/);

    // Find best matching category
    let bestMatch: { krs: { titel: string; doelwaarde: number; eenheid: string; autoKoppeling: string }[] } | null = null;
    let bestScore = 0;

    for (const [keyword, data] of Object.entries(SUGGESTION_MAP)) {
      let score = 0;
      if (titleLower.includes(keyword)) score += 3;
      for (const word of words) {
        if (keyword.includes(word) || word.includes(keyword)) score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = data;
      }
    }

    // Fallback: generic KRs
    if (!bestMatch || bestScore === 0) {
      bestMatch = {
        krs: [
          { titel: "Eerste mijlpaal behalen", doelwaarde: 100, eenheid: "%", autoKoppeling: "geen" },
          { titel: "Taken afronden", doelwaarde: 10, eenheid: "stuks", autoKoppeling: "taken" },
          { titel: "Resultaat meten en evalueren", doelwaarde: 1, eenheid: "stuks", autoKoppeling: "geen" },
        ],
      };
    }

    return NextResponse.json({ suggesties: bestMatch.krs.slice(0, 5) });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
