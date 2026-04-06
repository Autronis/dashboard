import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// POST /api/push/subscribe — Save push subscription
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ fout: "Ongeldige subscription data" }, { status: 400 });
    }

    // Upsert: delete old subscription with same endpoint, then insert
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).run();

    await db.insert(pushSubscriptions).values({
      gebruikerId: gebruiker.id,
      endpoint,
      keysP256dh: keys.p256dh,
      keysAuth: keys.auth,
    }).run();

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/push/subscribe — Remove push subscription
export async function DELETE(req: NextRequest) {
  try {
    await requireAuth();
    const { endpoint } = await req.json();

    if (endpoint) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).run();
    }

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
