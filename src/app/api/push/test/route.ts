import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrApiKey } from "@/lib/auth";
import { sendPushToUser } from "@/lib/push";

// POST /api/push/test
// Body: { titel?: string, bericht?: string }
// Stuurt een test push notificatie naar de ingelogde gebruiker.
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuthOrApiKey(req);

    const body = await req.json().catch(() => ({}));
    const titel = typeof body.titel === "string" && body.titel.length > 0
      ? body.titel
      : "Autronis Test";
    const bericht = typeof body.bericht === "string" && body.bericht.length > 0
      ? body.bericht
      : "Als je dit ziet werken push notificaties.";

    const sent = await sendPushToUser(gebruiker.id, {
      titel,
      bericht,
      url: "/",
      tag: "test",
    });

    return NextResponse.json({
      succes: true,
      verzonden: sent,
      gebruiker: gebruiker.naam,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
