import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { screenTimeEntries, screenTimeRegels } from "@/lib/db/schema";
import { requireApiKey } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  let gebruikerId: number;
  try {
    gebruikerId = await requireApiKey(req);
  } catch {
    return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { entries } = body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ fout: "Geen entries meegegeven" }, { status: 400 });
    }

    const regels = db
      .select()
      .from(screenTimeRegels)
      .where(eq(screenTimeRegels.isActief, 1))
      .orderBy(screenTimeRegels.prioriteit)
      .all();

    let verwerkt = 0;
    let overgeslagen = 0;
    const categorieen: Array<{ clientId: string; categorie: string; projectId: number | null }> = [];

    for (const entry of entries) {
      if (!entry.clientId || !entry.app || !entry.startTijd || !entry.eindTijd || !entry.duurSeconden) {
        overgeslagen++;
        continue;
      }

      const bestaand = db
        .select({ id: screenTimeEntries.id })
        .from(screenTimeEntries)
        .where(eq(screenTimeEntries.clientId, entry.clientId))
        .get();

      if (bestaand) {
        overgeslagen++;
        continue;
      }

      let categorie: "development" | "communicatie" | "design" | "administratie" | "afleiding" | "overig" | "inactief" = "overig";
      let projectId: number | null = null;
      let klantId: number | null = null;

      for (const regel of regels) {
        const matchTarget =
          regel.type === "app" ? entry.app :
          regel.type === "url" ? (entry.url || "") :
          (entry.venstertitel || "");

        try {
          if (new RegExp(regel.patroon, "i").test(matchTarget)) {
            categorie = regel.categorie;
            projectId = regel.projectId;
            klantId = regel.klantId;
            break;
          }
        } catch {
          // Invalid regex, skip rule
        }
      }

      db.insert(screenTimeEntries).values({
        clientId: entry.clientId,
        gebruikerId,
        app: entry.app,
        vensterTitel: entry.venstertitel || null,
        url: entry.url || null,
        categorie,
        projectId,
        klantId,
        startTijd: entry.startTijd,
        eindTijd: entry.eindTijd,
        duurSeconden: entry.duurSeconden,
        bron: "agent",
      }).run();

      categorieen.push({ clientId: entry.clientId, categorie, projectId });
      verwerkt++;
    }

    return NextResponse.json({ verwerkt, overgeslagen, categorieen });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 500 }
    );
  }
}
