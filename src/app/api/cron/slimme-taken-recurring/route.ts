import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, slimmeTakenTemplates } from "@/lib/db/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import { fillPromptTemplate, fillNaamTemplate } from "@/lib/slimme-taken";

// GET /api/cron/slimme-taken-recurring
// Wordt dagelijks door een Vercel cron getriggerd. Loopt alle actieve
// templates met recurring_day_of_week = vandaag's weekdag, en maakt voor
// elk een nieuwe losse taak aan (tenzij deze week al gerund).
//
// Auth: Bearer CRON_SECRET of sessie (voor lokaal testen).
export async function GET(req: NextRequest) {
  try {
    // Simple auth: check CRON_SECRET header
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ fout: "Unauthorized" }, { status: 401 });
    }

    const vandaag = new Date();
    const weekdag = vandaag.getDay(); // 0=zo, 1=ma, ... 6=za
    const vandaagDatum = vandaag.toISOString().slice(0, 10);

    // Alle actieve templates die vandaag moeten runnen
    const kandidaten = await db
      .select()
      .from(slimmeTakenTemplates)
      .where(
        and(
          eq(slimmeTakenTemplates.isActief, 1),
          eq(slimmeTakenTemplates.recurringDayOfWeek, weekdag),
          isNotNull(slimmeTakenTemplates.recurringDayOfWeek)
        )
      );

    const aangemaakt: Array<{ templateSlug: string; taakId: number; titel: string }> = [];
    const overgeslagen: string[] = [];

    for (const template of kandidaten) {
      // Skip als deze week al gerund — check of laatste run in de laatste 6 dagen zit
      if (template.recurringLaatsteRun) {
        const laatste = new Date(template.recurringLaatsteRun);
        const dagenGeleden = (vandaag.getTime() - laatste.getTime()) / (24 * 60 * 60 * 1000);
        if (dagenGeleden < 6) {
          overgeslagen.push(`${template.slug} (laatst ${Math.round(dagenGeleden)}d geleden)`);
          continue;
        }
      }

      // Skip als de template velden vereist — die kunnen we niet auto invullen
      if (template.velden) {
        try {
          const velden = JSON.parse(template.velden) as Array<{ key: string; label: string }>;
          if (velden.length > 0) {
            overgeslagen.push(`${template.slug} (velden vereist, niet auto runnable)`);
            continue;
          }
        } catch {
          // JSON parse fail — ignore en ga door
        }
      }

      // Maak de taak aan
      const titel = fillNaamTemplate(template.naam, {});
      const prompt = fillPromptTemplate(template.prompt, {});

      const [nieuw] = await db
        .insert(taken)
        .values({
          projectId: null,
          aangemaaktDoor: null, // systeem
          toegewezenAan: null,
          eigenaar: "vrij",
          titel,
          omschrijving: template.beschrijving,
          cluster: template.cluster,
          fase: "Slimme taken (recurring)",
          status: "open",
          prioriteit: "normaal",
          uitvoerder: "claude",
          prompt,
          geschatteDuur: template.geschatteDuur,
          deadline: vandaagDatum,
        })
        .returning();

      // Update recurring_laatste_run
      await db
        .update(slimmeTakenTemplates)
        .set({ recurringLaatsteRun: vandaag.toISOString(), bijgewerktOp: new Date().toISOString() })
        .where(eq(slimmeTakenTemplates.id, template.id));

      aangemaakt.push({ templateSlug: template.slug, taakId: nieuw.id, titel: nieuw.titel });
    }

    return NextResponse.json({
      ok: true,
      weekdag,
      datum: vandaagDatum,
      aangemaakt,
      overgeslagen,
      kandidaten: kandidaten.length,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 500 }
    );
  }
}
