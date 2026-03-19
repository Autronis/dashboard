import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { outreachDomeinen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    await requireAuth();

    const domeinen = await db
      .select()
      .from(outreachDomeinen)
      .orderBy(desc(outreachDomeinen.aangemaaktOp))
      .all();

    return NextResponse.json({ domeinen });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();

    if (!body.domein?.trim() || !body.emailAdres?.trim() || !body.displayNaam?.trim()) {
      return NextResponse.json({ fout: "domein, emailAdres en displayNaam zijn verplicht" }, { status: 400 });
    }

    const [domein] = await db
      .insert(outreachDomeinen)
      .values({
        domein: body.domein.trim(),
        emailAdres: body.emailAdres.trim(),
        displayNaam: body.displayNaam.trim(),
        sesConfigured: body.sesConfigured ? 1 : 0,
        dagLimiet: body.dagLimiet || 50,
      })
      .returning()
      .all();

    return NextResponse.json({ domein }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
