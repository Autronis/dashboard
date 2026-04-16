import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { gebruikers } from "@/lib/db/schema";
import { checkRateLimit, sessionOptions, type SessionData } from "@/lib/auth";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Rate limiting
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { fout: "Te veel inlogpogingen. Probeer het over een minuut opnieuw." },
      { status: 429 }
    );
  }

  // Parse body
  let body: { email?: string; wachtwoord?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ fout: "Ongeldig verzoek." }, { status: 400 });
  }

  const { email, wachtwoord } = body;

  if (!email || !wachtwoord) {
    return NextResponse.json(
      { fout: "E-mailadres en wachtwoord zijn verplicht." },
      { status: 400 }
    );
  }

  // Look up user
  const [gebruiker] = await db
    .select()
    .from(gebruikers)
    .where(eq(gebruikers.email, email.toLowerCase().trim()))
    .limit(1);

  if (!gebruiker) {
    return NextResponse.json(
      { fout: "Ongeldig e-mailadres of wachtwoord." },
      { status: 401 }
    );
  }

  // Verify password
  const wachtwoordKlopt = await bcrypt.compare(wachtwoord, gebruiker.wachtwoordHash);
  if (!wachtwoordKlopt) {
    return NextResponse.json(
      { fout: "Ongeldig e-mailadres of wachtwoord." },
      { status: 401 }
    );
  }

  // Create response and set session
  const response = NextResponse.json({
    succes: true,
    gebruiker: {
      id: gebruiker.id,
      naam: gebruiker.naam,
      email: gebruiker.email,
      rol: gebruiker.rol,
    },
  });

  const session = await getIronSession<SessionData>(req, response, sessionOptions);
  session.gebruiker = {
    id: gebruiker.id,
    naam: gebruiker.naam,
    email: gebruiker.email,
    rol: gebruiker.rol as "admin" | "gebruiker",
    themaVoorkeur: gebruiker.themaVoorkeur as "donker" | "licht" | null,
    avatarUrl: gebruiker.avatarUrl ?? null,
  };
  await session.save();

  return response;
}
