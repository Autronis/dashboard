import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { aiGesprekken } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// GET /api/ai/gesprekken/[id] — get single conversation with messages
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);

    if (isNaN(id)) {
      return Response.json({ fout: "Ongeldig ID" }, { status: 400 });
    }

    const gesprek = await db
      .select()
      .from(aiGesprekken)
      .where(
        and(
          eq(aiGesprekken.id, id),
          eq(aiGesprekken.gebruikerId, gebruiker.id),
        )
      )
      .get();

    if (!gesprek) {
      return Response.json({ fout: "Gesprek niet gevonden" }, { status: 404 });
    }

    return Response.json({
      gesprek: {
        ...gesprek,
        berichten: JSON.parse(gesprek.berichten ?? "[]"),
      },
    });
  } catch {
    return Response.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
  }
}
