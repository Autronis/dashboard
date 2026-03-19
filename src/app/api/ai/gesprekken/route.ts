import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { aiGesprekken } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

// GET /api/ai/gesprekken — list all conversations for user
export async function GET() {
  try {
    const gebruiker = await requireAuth();

    const gesprekken = await db
      .select({
        id: aiGesprekken.id,
        titel: aiGesprekken.titel,
        aangemaaktOp: aiGesprekken.aangemaaktOp,
        bijgewerktOp: aiGesprekken.bijgewerktOp,
      })
      .from(aiGesprekken)
      .where(eq(aiGesprekken.gebruikerId, gebruiker.id))
      .orderBy(desc(aiGesprekken.bijgewerktOp))
      .all();

    return Response.json({ gesprekken });
  } catch {
    return Response.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
  }
}

// DELETE /api/ai/gesprekken?id=X — delete specific conversation
export async function DELETE(request: NextRequest) {
  try {
    const gebruiker = await requireAuth();

    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get("id");

    if (!idParam) {
      return Response.json({ fout: "ID is verplicht" }, { status: 400 });
    }

    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      return Response.json({ fout: "Ongeldig ID" }, { status: 400 });
    }

    // Verify ownership
    const gesprek = await db
      .select({ id: aiGesprekken.id })
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

    await db.delete(aiGesprekken).where(eq(aiGesprekken.id, id)).run();

    return Response.json({ succes: true });
  } catch {
    return Response.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
  }
}
