import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { screenTimeSamenvattingen, screenTimeEntries, projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const datum = new URL(req.url).searchParams.get("datum");
    if (!datum) {
      return NextResponse.json({ fout: "Datum is verplicht" }, { status: 400 });
    }

    const samenvatting = db
      .select()
      .from(screenTimeSamenvattingen)
      .where(
        and(
          eq(screenTimeSamenvattingen.gebruikerId, gebruiker.id),
          eq(screenTimeSamenvattingen.datum, datum)
        )
      )
      .get();

    return NextResponse.json({ samenvatting: samenvatting || null });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();
    const { datum } = body;
    if (!datum) {
      return NextResponse.json({ fout: "Datum is verplicht" }, { status: 400 });
    }

    // Gather day's data grouped by app+project
    const entries = db
      .select({
        app: screenTimeEntries.app,
        categorie: screenTimeEntries.categorie,
        vensterTitel: screenTimeEntries.vensterTitel,
        projectNaam: projecten.naam,
        duurSeconden: screenTimeEntries.duurSeconden,
      })
      .from(screenTimeEntries)
      .leftJoin(projecten, eq(screenTimeEntries.projectId, projecten.id))
      .where(
        and(
          eq(screenTimeEntries.gebruikerId, gebruiker.id),
          gte(screenTimeEntries.startTijd, `${datum}T00:00:00`),
          lte(screenTimeEntries.startTijd, `${datum}T23:59:59`)
        )
      )
      .all();

    if (entries.length === 0) {
      return NextResponse.json({ fout: "Geen data voor deze datum" }, { status: 404 });
    }

    // Aggregate per app+project
    const perApp: Record<string, { seconden: number; categorie: string; project: string | null; titels: Set<string> }> = {};
    let totaalSeconden = 0;
    let productiefSeconden = 0;

    for (const e of entries) {
      if (e.categorie === "inactief") continue;
      const key = `${e.app}|${e.projectNaam || ""}`;
      if (!perApp[key]) {
        perApp[key] = { seconden: 0, categorie: e.categorie ?? "overig", project: e.projectNaam, titels: new Set() };
      }
      perApp[key].seconden += e.duurSeconden;
      if (e.vensterTitel) perApp[key].titels.add(e.vensterTitel);
      totaalSeconden += e.duurSeconden;
      if (e.categorie && ["development", "design", "administratie"].includes(e.categorie)) {
        productiefSeconden += e.duurSeconden;
      }
    }

    const productiefPercentage = totaalSeconden > 0 ? Math.round((productiefSeconden / totaalSeconden) * 100) : 0;
    const topProject = Object.values(perApp).sort((a, b) => b.seconden - a.seconden)[0]?.project || null;

    // Build context for Claude
    const activiteitenLijst = Object.entries(perApp)
      .sort(([, a], [, b]) => b.seconden - a.seconden)
      .map(([, v]) => {
        const uren = Math.floor(v.seconden / 3600);
        const minuten = Math.round((v.seconden % 3600) / 60);
        const duur = uren > 0 ? `${uren}u ${minuten}m` : `${minuten}m`;
        const titels = Array.from(v.titels).slice(0, 5).join(", ");
        return `- ${v.categorie}: ${duur} — App: ${v.project ? `${v.project} (via ` : ""}${titels}${v.project ? ")" : ""}`;
      })
      .join("\n");

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ fout: "ANTHROPIC_API_KEY niet geconfigureerd" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Je bent een productiviteitsassistent. Genereer een dagsamenvatting voor schermtijd data.

Datum: ${datum}
Totale actieve tijd: ${Math.floor(totaalSeconden / 3600)}u ${Math.round((totaalSeconden % 3600) / 60)}m
Productief: ${productiefPercentage}%

Activiteiten:
${activiteitenLijst}

Genereer JSON met exact deze structuur:
{
  "kort": "1-2 zinnen samenvatting in het Nederlands",
  "detail": "Markdown met per project/categorie een bullet met specifieke activiteiten. Gebruik **bold** voor projectnamen. Schrijf in het Nederlands."
}

Alleen JSON, geen uitleg.`,
      }],
    });

    const tekst = response.content[0].type === "text" ? response.content[0].text : "";
    let parsed: { kort: string; detail: string };
    try {
      const jsonMatch = tekst.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { kort: "Samenvatting niet beschikbaar", detail: "" };
    } catch {
      parsed = { kort: "Samenvatting niet beschikbaar", detail: "" };
    }

    // Upsert
    const bestaand = db
      .select({ id: screenTimeSamenvattingen.id })
      .from(screenTimeSamenvattingen)
      .where(and(
        eq(screenTimeSamenvattingen.gebruikerId, gebruiker.id),
        eq(screenTimeSamenvattingen.datum, datum)
      ))
      .get();

    if (bestaand) {
      db.update(screenTimeSamenvattingen)
        .set({
          samenvattingKort: parsed.kort,
          samenvattingDetail: parsed.detail,
          totaalSeconden,
          productiefPercentage,
          topProject,
        })
        .where(eq(screenTimeSamenvattingen.id, bestaand.id))
        .run();
    } else {
      db.insert(screenTimeSamenvattingen).values({
        gebruikerId: gebruiker.id,
        datum,
        samenvattingKort: parsed.kort,
        samenvattingDetail: parsed.detail,
        totaalSeconden,
        productiefPercentage,
        topProject,
      }).run();
    }

    const samenvatting = db
      .select()
      .from(screenTimeSamenvattingen)
      .where(and(
        eq(screenTimeSamenvattingen.gebruikerId, gebruiker.id),
        eq(screenTimeSamenvattingen.datum, datum)
      ))
      .get();

    return NextResponse.json({ samenvatting });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
