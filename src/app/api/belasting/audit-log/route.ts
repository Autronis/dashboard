import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { belastingAuditLog } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";

// GET /api/belasting/audit-log?entiteitType=investering&limiet=50
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const entiteitType = searchParams.get("entiteitType");
    const limiet = parseInt(searchParams.get("limiet") ?? "50", 10);

    const condition = entiteitType
      ? eq(belastingAuditLog.entiteitType, entiteitType)
      : undefined;

    const logs = await db
      .select()
      .from(belastingAuditLog)
      .where(condition)
      .orderBy(sql`${belastingAuditLog.aangemaaktOp} DESC`)
      .limit(limiet);

    return NextResponse.json({ logs });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/belasting/audit-log
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();

    const { actie, entiteitType, entiteitId, details } = body as {
      actie: string;
      entiteitType: string;
      entiteitId?: number;
      details?: string;
    };

    if (!actie || !entiteitType) {
      return NextResponse.json(
        { fout: "Actie en entiteitType zijn verplicht." },
        { status: 400 }
      );
    }

    const result = await db
      .insert(belastingAuditLog)
      .values({
        gebruikerId: gebruiker.id,
        actie,
        entiteitType,
        entiteitId,
        details: typeof details === "string" ? details : JSON.stringify(details),
      })
      .returning();

    return NextResponse.json({ log: result[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
