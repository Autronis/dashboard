import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { facturen, tijdregistraties, klanten } from "@/lib/db/schema";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { aiCompleteJson } from "@/lib/ai/client";

function getQuarterDateRange(kwartaal: number, jaar: number) {
  const startMonth = (kwartaal - 1) * 3;
  const start = `${jaar}-${String(startMonth + 1).padStart(2, "0")}-01`;
  const endMonth = startMonth + 3;
  const end = endMonth > 12 ? `${jaar + 1}-01-01` : `${jaar}-${String(endMonth + 1).padStart(2, "0")}-01`;
  return { start, end };
}

// POST /api/doelen/suggest — Claude-powered KR suggestions
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json() as { titel: string; kwartaal?: number; jaar?: number };

    if (!body.titel?.trim()) {
      return NextResponse.json({ suggesties: [] });
    }

    const kwartaal = body.kwartaal || Math.ceil((new Date().getMonth() + 1) / 3);
    const jaar = body.jaar || new Date().getFullYear();
    const { start, end } = getQuarterDateRange(kwartaal, jaar);

    // Haal huidige kwartaaldata op als context
    const [omzetResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${facturen.bedragExclBtw}), 0)` })
      .from(facturen)
      .where(and(eq(facturen.status, "betaald"), gte(facturen.betaaldOp, start), lt(facturen.betaaldOp, end)));

    const [urenResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${tijdregistraties.duurMinuten}), 0)` })
      .from(tijdregistraties)
      .where(and(gte(tijdregistraties.startTijd, start), lt(tijdregistraties.startTijd, end)));

    const [klantenResult] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(klanten)
      .where(and(gte(klanten.aangemaaktOp, start), lt(klanten.aangemaaktOp, end)));

    const omzetHuidig = omzetResult?.total ?? 0;
    const urenHuidig = Math.round(((urenResult?.total ?? 0) / 60) * 10) / 10;
    const klantenHuidig = klantenResult?.total ?? 0;

    interface KrSuggestie {
      titel: string;
      doelwaarde: number;
      eenheid: string;
      autoKoppeling: string;
    }

    const suggesties = await aiCompleteJson<KrSuggestie[]>({
      provider: "anthropic",
      system: "Je bent een OKR-coach voor Autronis, een AI- en automatiseringsbureau. Genereer concrete, meetbare Key Results. Antwoord altijd met een JSON array.",
      prompt: `Genereer 3-4 Key Results voor dit doel van Autronis: "${body.titel.trim()}"

Kwartaalcontext (Q${kwartaal} ${jaar}):
- Omzet tot nu toe: €${Math.round(omzetHuidig)}
- Uren gewerkt: ${urenHuidig}u
- Nieuwe klanten: ${klantenHuidig}

Regels:
- KR's zijn specifiek en meetbaar
- Gebruik realistische waarden voor een 2-mans AI-bureau
- autoKoppeling: "omzet" als het over factuuromzet gaat, "uren" voor uren, "klanten" voor nieuwe klanten, anders "geen"
- eenheid: "euro", "uren", "%", "stuks", of specifiek (bijv. "video's")

Antwoord ALLEEN met JSON array:
[{"titel": "...", "doelwaarde": number, "eenheid": "...", "autoKoppeling": "..."}]`,
      maxTokens: 500,
    });

    return NextResponse.json({ suggesties: suggesties.slice(0, 5) });
  } catch {
    // Fallback bij AI fout — return lege lijst
    return NextResponse.json({ suggesties: [] });
  }
}
