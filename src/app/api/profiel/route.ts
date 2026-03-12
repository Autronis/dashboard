import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gebruikers } from "@/lib/db/schema";
import { requireAuth, getSession } from "@/lib/auth";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

// GET /api/profiel — haal eigen profiel op
export async function GET() {
  try {
    const sessie = await requireAuth();
    const [gebruiker] = await db
      .select({
        id: gebruikers.id,
        naam: gebruikers.naam,
        email: gebruikers.email,
        rol: gebruikers.rol,
        uurtariefStandaard: gebruikers.uurtariefStandaard,
        themaVoorkeur: gebruikers.themaVoorkeur,
      })
      .from(gebruikers)
      .where(eq(gebruikers.id, sessie.id));

    if (!gebruiker) {
      return NextResponse.json({ fout: "Gebruiker niet gevonden" }, { status: 404 });
    }

    return NextResponse.json({ gebruiker });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// PUT /api/profiel — profiel bijwerken
export async function PUT(req: NextRequest) {
  try {
    const sessie = await requireAuth();
    const body = await req.json();

    const updateData: Record<string, unknown> = {
      bijgewerktOp: new Date().toISOString(),
    };

    if (body.naam) updateData.naam = body.naam.trim();
    if (body.email) updateData.email = body.email.trim().toLowerCase();
    if (body.uurtariefStandaard !== undefined) updateData.uurtariefStandaard = body.uurtariefStandaard;

    // Wachtwoord wijzigen
    if (body.huidigWachtwoord && body.nieuwWachtwoord) {
      const [gebruiker] = await db
        .select({ wachtwoordHash: gebruikers.wachtwoordHash })
        .from(gebruikers)
        .where(eq(gebruikers.id, sessie.id));

      if (!gebruiker) {
        return NextResponse.json({ fout: "Gebruiker niet gevonden" }, { status: 404 });
      }

      const geldig = await bcrypt.compare(body.huidigWachtwoord, gebruiker.wachtwoordHash);
      if (!geldig) {
        return NextResponse.json({ fout: "Huidig wachtwoord is onjuist" }, { status: 400 });
      }

      if (body.nieuwWachtwoord.length < 6) {
        return NextResponse.json({ fout: "Nieuw wachtwoord moet minimaal 6 tekens zijn" }, { status: 400 });
      }

      updateData.wachtwoordHash = await bcrypt.hash(body.nieuwWachtwoord, 10);
    }

    await db
      .update(gebruikers)
      .set(updateData)
      .where(eq(gebruikers.id, sessie.id));

    // Update session
    const session = await getSession();
    if (session.gebruiker) {
      if (updateData.naam) session.gebruiker.naam = updateData.naam as string;
      if (updateData.email) session.gebruiker.email = updateData.email as string;
      await session.save();
    }

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
