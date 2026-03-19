import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { belastingDeadlines, btwAangiftes } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// POST /api/belasting/seed — Seeds deadlines + BTW aangiftes for 2026 and 2027
export async function POST() {
  try {
    await requireAuth();

    const jaren = [2026, 2027];
    const resultaat: { deadlines: number; aangiftes: number } = { deadlines: 0, aangiftes: 0 };

    for (const jaar of jaren) {
      // ---- DEADLINES ----
      const bestaandeDeadlines = await db
        .select()
        .from(belastingDeadlines)
        .where(eq(belastingDeadlines.jaar, jaar))
        .all();

      if (bestaandeDeadlines.length === 0) {
        const deadlinesToCreate: {
          type: "btw" | "inkomstenbelasting" | "icp" | "kvk_publicatie";
          omschrijving: string;
          datum: string;
          kwartaal: number | null;
          jaar: number;
        }[] = [
          {
            type: "btw",
            omschrijving: `BTW aangifte Q1 ${jaar}`,
            datum: `${jaar}-04-30`,
            kwartaal: 1,
            jaar,
          },
          {
            type: "btw",
            omschrijving: `BTW aangifte Q2 ${jaar}`,
            datum: `${jaar}-07-31`,
            kwartaal: 2,
            jaar,
          },
          {
            type: "btw",
            omschrijving: `BTW aangifte Q3 ${jaar}`,
            datum: `${jaar}-10-31`,
            kwartaal: 3,
            jaar,
          },
          {
            type: "btw",
            omschrijving: `BTW aangifte Q4 ${jaar}`,
            datum: `${jaar + 1}-01-31`,
            kwartaal: 4,
            jaar,
          },
          {
            type: "inkomstenbelasting",
            omschrijving: `Inkomstenbelasting ${jaar}`,
            datum: `${jaar + 1}-05-01`,
            kwartaal: null,
            jaar,
          },
          {
            type: "icp",
            omschrijving: `ICP opgave Q1 ${jaar}`,
            datum: `${jaar}-04-30`,
            kwartaal: 1,
            jaar,
          },
          {
            type: "icp",
            omschrijving: `ICP opgave Q2 ${jaar}`,
            datum: `${jaar}-07-31`,
            kwartaal: 2,
            jaar,
          },
          {
            type: "icp",
            omschrijving: `ICP opgave Q3 ${jaar}`,
            datum: `${jaar}-10-31`,
            kwartaal: 3,
            jaar,
          },
          {
            type: "icp",
            omschrijving: `ICP opgave Q4 ${jaar}`,
            datum: `${jaar + 1}-01-31`,
            kwartaal: 4,
            jaar,
          },
          {
            type: "kvk_publicatie",
            omschrijving: `KvK publicatieplicht ${jaar}`,
            datum: `${jaar}-01-01`,
            kwartaal: null,
            jaar,
          },
        ];

        for (const deadline of deadlinesToCreate) {
          await db.insert(belastingDeadlines).values(deadline).run();
          resultaat.deadlines++;
        }
      }

      // ---- BTW AANGIFTES ----
      const bestaandeAangiftes = await db
        .select()
        .from(btwAangiftes)
        .where(eq(btwAangiftes.jaar, jaar))
        .all();

      if (bestaandeAangiftes.length === 0) {
        for (let kwartaal = 1; kwartaal <= 4; kwartaal++) {
          await db.insert(btwAangiftes).values({
            kwartaal,
            jaar,
            btwOntvangen: 0,
            btwBetaald: 0,
            btwAfdragen: 0,
            status: "open",
          }).run();
          resultaat.aangiftes++;
        }
      }
    }

    return NextResponse.json({
      succes: true,
      bericht: `${resultaat.deadlines} deadlines en ${resultaat.aangiftes} BTW aangiftes aangemaakt.`,
      resultaat,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
