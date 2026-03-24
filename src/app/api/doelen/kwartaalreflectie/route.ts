import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { okrObjectives, okrKeyResults, okrCheckIns } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { aiComplete } from "@/lib/ai/client";

// POST /api/doelen/kwartaalreflectie — Claude generates quarter retrospective
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json() as { kwartaal: number; jaar: number };

    if (!body.kwartaal || !body.jaar) {
      return NextResponse.json({ fout: "kwartaal en jaar zijn verplicht" }, { status: 400 });
    }

    // Fetch all objectives for the quarter
    const doelen = await db
      .select()
      .from(okrObjectives)
      .where(and(eq(okrObjectives.kwartaal, body.kwartaal), eq(okrObjectives.jaar, body.jaar)))
      .all();

    if (doelen.length === 0) {
      return NextResponse.json({ reflectie: null });
    }

    // Fetch KRs and check-ins for each objective
    const doelenMetKrs = await Promise.all(doelen.map(async (doel) => {
      const krs = await db.select().from(okrKeyResults).where(eq(okrKeyResults.objectiveId, doel.id)).all();
      const checkIns = await db.select().from(okrCheckIns).where(eq(okrCheckIns.objectiveId, doel.id)).orderBy(okrCheckIns.week).all();
      return { doel, krs, checkIns };
    }));

    const context = doelenMetKrs.map(({ doel, krs }) => {
      const krLines = krs.map((kr) => {
        const pct = kr.doelwaarde > 0 ? Math.round(((kr.huidigeWaarde ?? 0) / kr.doelwaarde) * 100) : 0;
        return `  - ${kr.titel}: ${pct}% (${kr.huidigeWaarde ?? 0}/${kr.doelwaarde} ${kr.eenheid ?? ""})`;
      }).join("\n");
      const gemVoortgang = krs.length > 0
        ? Math.round(krs.reduce((s, kr) => s + (kr.doelwaarde > 0 ? ((kr.huidigeWaarde ?? 0) / kr.doelwaarde) * 100 : 0), 0) / krs.length)
        : 0;
      return `Doel: "${doel.titel}" (status: ${doel.status ?? "actief"}, voortgang: ${gemVoortgang}%)\n${krLines}`;
    }).join("\n\n");

    const result = await aiComplete({
      provider: "anthropic",
      system: "Je bent een OKR-coach voor Autronis. Schrijf een beknopte kwartaalreflectie in het Nederlands. Wees eerlijk, motiverend en concreet. Gebruik bullet points. Max 250 woorden.",
      prompt: `Schrijf een kwartaalreflectie voor Q${body.kwartaal} ${body.jaar} van Autronis.\n\nResultaten:\n${context}\n\nStructuur:\n- Wat ging goed?\n- Wat kon beter?\n- Leerpunten voor volgend kwartaal`,
      maxTokens: 400,
    });

    return NextResponse.json({ reflectie: result.text.trim() });
  } catch {
    return NextResponse.json({ fout: "Reflectie genereren mislukt" }, { status: 500 });
  }
}
