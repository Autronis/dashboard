import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, projecten, klanten, facturen, gebruikers, notificaties } from "@/lib/db/schema";
import { eq, ne, and, gte, lte, sql } from "drizzle-orm";
import { sendPushToUser } from "@/lib/push";

// GET /api/push/dagelijks — Vercel Cron: dagelijkse ochtend push notificatie
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ fout: "Niet geautoriseerd" }, { status: 401 });
    }

    const vandaag = new Date().toISOString().slice(0, 10);
    const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    // Get all active users
    const users = await db.select({ id: gebruikers.id, naam: gebruikers.naam }).from(gebruikers).all();

    let totalSent = 0;

    for (const user of users) {
      // 1. Open taken met hoge prioriteit
      const hoogPrioTaken = await db
        .select({ id: taken.id, titel: taken.titel, deadline: taken.deadline })
        .from(taken)
        .where(and(
          eq(taken.toegewezenAan, user.id),
          ne(taken.status, "afgerond"),
          eq(taken.prioriteit, "hoog")
        ))
        .limit(5)
        .all();

      // 2. Deadlines vandaag/morgen
      const deadlineTaken = await db
        .select({ titel: taken.titel, deadline: taken.deadline })
        .from(taken)
        .where(and(
          eq(taken.toegewezenAan, user.id),
          ne(taken.status, "afgerond"),
          gte(taken.deadline, vandaag),
          lte(taken.deadline, morgen)
        ))
        .all();

      // 3. Openstaande facturen
      const openFacturen = await db
        .select({
          totaal: sql<number>`sum(${facturen.totaalBedrag})`,
          aantal: sql<number>`count(*)`,
        })
        .from(facturen)
        .where(eq(facturen.status, "verzonden"))
        .get();

      // 4. Totaal open taken
      const openTakenResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(taken)
        .where(and(
          eq(taken.toegewezenAan, user.id),
          ne(taken.status, "afgerond")
        ))
        .get();

      // Build summary message
      const parts: string[] = [];
      const voornaam = user.naam.split(" ")[0];

      // Urgent tasks
      if (hoogPrioTaken.length > 0) {
        parts.push(`${hoogPrioTaken.length} urgente ${hoogPrioTaken.length === 1 ? "taak" : "taken"}`);
      }

      // Deadlines
      if (deadlineTaken.length > 0) {
        const vandaagCount = deadlineTaken.filter((t) => t.deadline === vandaag).length;
        const morgenCount = deadlineTaken.filter((t) => t.deadline === morgen).length;
        const dlParts: string[] = [];
        if (vandaagCount > 0) dlParts.push(`${vandaagCount} deadline${vandaagCount > 1 ? "s" : ""} vandaag`);
        if (morgenCount > 0) dlParts.push(`${morgenCount} morgen`);
        parts.push(dlParts.join(", "));
      }

      // Open invoices
      if (openFacturen && openFacturen.aantal > 0) {
        parts.push(`€${Math.round(openFacturen.totaal ?? 0)} openstaand`);
      }

      // Total open tasks
      const openCount = openTakenResult?.count ?? 0;
      if (openCount > 0 && hoogPrioTaken.length === 0) {
        parts.push(`${openCount} open taken`);
      }

      if (parts.length === 0) {
        parts.push("Alles op orde, geen urgente items");
      }

      const bericht = parts.join(" · ");

      // Top task name for detail
      const topTask = hoogPrioTaken[0] || deadlineTaken[0];
      const detail = topTask ? `Eerstvolgende: ${topTask.titel}` : "";
      const fullBericht = detail ? `${bericht}\n${detail}` : bericht;

      // Send push
      const sent = await sendPushToUser(user.id, {
        titel: `Goedemorgen ${voornaam}`,
        bericht: fullBericht,
        url: "/",
        tag: `dagelijks-${vandaag}`,
      });

      // Also save as in-app notification
      await db.insert(notificaties).values({
        gebruikerId: user.id,
        type: "deadline_nadert",
        titel: `Dagelijkse update`,
        omschrijving: fullBericht,
        link: "/",
      }).run();

      totalSent += sent;
    }

    return NextResponse.json({
      succes: true,
      gebruikers: users.length,
      pushVerstuurd: totalSent,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 500 }
    );
  }
}
