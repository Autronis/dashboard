import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { meetings, taken, klanten, projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, desc } from "drizzle-orm";
import { aiComplete } from "@/lib/ai/client";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const klantId = searchParams.get("klantId");
    const projectId = searchParams.get("projectId");
    const titel = searchParams.get("titel");

    if (!klantId && !projectId) {
      return NextResponse.json(
        { fout: "klantId of projectId is verplicht" },
        { status: 400 }
      );
    }

    // Vorige meetings met deze klant/project
    const conditions = [];
    if (klantId) conditions.push(eq(meetings.klantId, Number(klantId)));
    if (projectId) conditions.push(eq(meetings.projectId, Number(projectId)));
    conditions.push(eq(meetings.status, "klaar"));

    const vorigeMeetings = db
      .select({
        titel: meetings.titel,
        datum: meetings.datum,
        samenvatting: meetings.samenvatting,
        actiepunten: meetings.actiepunten,
        openVragen: meetings.openVragen,
        sentiment: meetings.sentiment,
      })
      .from(meetings)
      .where(and(...conditions))
      .orderBy(desc(meetings.datum))
      .limit(5)
      .all();

    if (vorigeMeetings.length === 0) {
      return NextResponse.json({
        voorbereiding: {
          context: "Geen eerdere meetings gevonden met deze klant/project.",
          suggesties: [],
          openActiepunten: [],
        },
      });
    }

    // Openstaande taken voor dit project/klant
    const takenConditions = [];
    if (projectId) takenConditions.push(eq(taken.projectId, Number(projectId)));
    takenConditions.push(eq(taken.status, "open"));

    const openTaken = db
      .select({ titel: taken.titel, prioriteit: taken.prioriteit, deadline: taken.deadline })
      .from(taken)
      .where(and(...takenConditions))
      .limit(10)
      .all();

    // Klant info
    let klantNaam = "";
    if (klantId) {
      const klant = db
        .select({ bedrijfsnaam: klanten.bedrijfsnaam })
        .from(klanten)
        .where(eq(klanten.id, Number(klantId)))
        .get();
      klantNaam = klant?.bedrijfsnaam || "";
    }

    let projectNaam = "";
    if (projectId) {
      const project = db
        .select({ naam: projecten.naam })
        .from(projecten)
        .where(eq(projecten.id, Number(projectId)))
        .get();
      projectNaam = project?.naam || "";
    }

    // AI briefing
    const meetingContext = vorigeMeetings
      .map(
        (m) =>
          `Meeting "${m.titel}" (${m.datum}):\n- Samenvatting: ${m.samenvatting}\n- Open vragen: ${m.openVragen}\n- Sentiment: ${m.sentiment || "onbekend"}`
      )
      .join("\n\n");

    const takenContext = openTaken.length > 0
      ? `\nOpenstaande taken:\n${openTaken.map((t) => `- ${t.titel} (${t.prioriteit}${t.deadline ? `, deadline: ${t.deadline}` : ""})`).join("\n")}`
      : "";

    const { text: aiText } = await aiComplete({
      prompt: `Je bent een meeting-voorbereidingsassistent voor Autronis.
${klantNaam ? `Klant: ${klantNaam}` : ""}${projectNaam ? ` | Project: ${projectNaam}` : ""}
${titel ? `Aankomende meeting: "${titel}"` : ""}

Eerdere meetings:
${meetingContext}
${takenContext}

Genereer een meeting-voorbereiding als JSON:
{
  "context": "Korte samenvatting van de relatie/status (2-3 zinnen)",
  "suggesties": ["Gespreksonderwerp 1", "Gespreksonderwerp 2", ...],
  "waarschuwingen": ["Eventuele aandachtspunten of risico's"]
}
Alleen JSON, geen uitleg.`,
      maxTokens: 1024,
    });

    const cleaned = aiText.replace(/```json\n?|\n?```/g, "").trim();
    const briefing = JSON.parse(cleaned) as {
      context: string;
      suggesties: string[];
      waarschuwingen: string[];
    };

    // Open actiepunten uit vorige meetings
    const openActiepunten = vorigeMeetings.flatMap((m) => {
      try {
        return JSON.parse(m.actiepunten || "[]") as Array<{ tekst: string; verantwoordelijke: string }>;
      } catch {
        return [];
      }
    });

    return NextResponse.json({
      voorbereiding: {
        ...briefing,
        openActiepunten,
        openTaken,
        vorigeMeetings: vorigeMeetings.map((m) => ({
          titel: m.titel,
          datum: m.datum,
          samenvatting: m.samenvatting,
        })),
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    if (message === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: message }, { status: 401 });
    }
    return NextResponse.json({ fout: message }, { status: 500 });
  }
}
