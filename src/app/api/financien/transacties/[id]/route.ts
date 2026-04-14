import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bankTransacties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

const FISCAAL_TYPES = ["investering", "kosten", "prive"] as const;
type FiscaalType = (typeof FISCAAL_TYPES)[number];

// PATCH /api/financien/transacties/[id] — update metadata on a bank transactie
// Currently supports: fiscaalType, categorie
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id: idStr } = await params;
    const id = Number(idStr);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ fout: "Ongeldig id" }, { status: 400 });
    }

    const body = (await req.json()) as {
      fiscaalType?: FiscaalType | null;
      categorie?: string | null;
    };

    if (
      body.fiscaalType !== undefined &&
      body.fiscaalType !== null &&
      !FISCAAL_TYPES.includes(body.fiscaalType)
    ) {
      return NextResponse.json({ fout: "Ongeldig fiscaalType" }, { status: 400 });
    }

    const drizzleUpdates: Partial<typeof bankTransacties.$inferInsert> = {};
    if (body.fiscaalType !== undefined) drizzleUpdates.fiscaalType = body.fiscaalType;
    if (body.categorie !== undefined) drizzleUpdates.categorie = body.categorie;

    if (Object.keys(drizzleUpdates).length === 0) {
      return NextResponse.json({ fout: "Geen velden om bij te werken" }, { status: 400 });
    }

    const [updated] = await db
      .update(bankTransacties)
      .set(drizzleUpdates)
      .where(eq(bankTransacties.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ fout: "Transactie niet gevonden" }, { status: 404 });
    }

    return NextResponse.json({ transactie: updated });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      {
        status:
          error instanceof Error && error.message === "Niet geauthenticeerd"
            ? 401
            : 500,
      }
    );
  }
}
