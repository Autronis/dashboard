import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { persoonlijkeTodos } from "@/lib/db/schema";
import { requireAuthOrApiKey } from "@/lib/auth";

// POST /api/persoonlijk/todo
// Body: { titel: string }
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuthOrApiKey(req);
    if (gebruiker.id !== 1) {
      return NextResponse.json({ fout: "Geen toegang" }, { status: 403 });
    }

    const body = await req.json();
    const { titel } = body;

    if (!titel || typeof titel !== "string" || titel.trim().length === 0) {
      return NextResponse.json({ fout: "titel is verplicht" }, { status: 400 });
    }

    const [todo] = await db
      .insert(persoonlijkeTodos)
      .values({ titel: titel.trim(), gedaan: 0 })
      .returning();

    return NextResponse.json({ todo }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
