import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { belastingDeadlines } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

// GET /api/belasting/deadlines?jaar=2026
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const jaarParam = searchParams.get("jaar");
    const jaar = jaarParam ? parseInt(jaarParam, 10) : new Date().getFullYear();

    const deadlines = await db
      .select()
      .from(belastingDeadlines)
      .where(eq(belastingDeadlines.jaar, jaar))
      .orderBy(belastingDeadlines.datum)
      .all();

    return NextResponse.json({ deadlines });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/belasting/deadlines — seed deadlines for a given year
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();
    const jaar = body.jaar ?? new Date().getFullYear();

    // Check if deadlines already exist for this year
    const bestaande = await db
      .select()
      .from(belastingDeadlines)
      .where(eq(belastingDeadlines.jaar, jaar))
      .all();

    if (bestaande.length > 0) {
      return NextResponse.json(
        { fout: `Deadlines voor ${jaar} bestaan al.` },
        { status: 409 }
      );
    }

    const deadlinesToCreate: {
      type: "btw" | "inkomstenbelasting" | "icp" | "kvk_publicatie";
      omschrijving: string;
      datum: string;
      kwartaal: number | null;
      jaar: number;
    }[] = [
      // BTW kwartaalaangiftes
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
      // Inkomstenbelasting
      {
        type: "inkomstenbelasting",
        omschrijving: `Inkomstenbelasting ${jaar}`,
        datum: `${jaar + 1}-05-01`,
        kwartaal: null,
        jaar,
      },
      // ICP kwartaalaangiftes
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
      // KvK publicatieplicht
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
    }

    const deadlines = await db
      .select()
      .from(belastingDeadlines)
      .where(eq(belastingDeadlines.jaar, jaar))
      .orderBy(belastingDeadlines.datum)
      .all();

    return NextResponse.json({ deadlines }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
