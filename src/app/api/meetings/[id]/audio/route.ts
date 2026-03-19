import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { meetings } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { readFile, stat } from "fs/promises";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;

    const meeting = await db
      .select({ audioPad: meetings.audioPad })
      .from(meetings)
      .where(eq(meetings.id, Number(id)))
      .get();

    if (!meeting?.audioPad) {
      return NextResponse.json(
        { fout: "Geen audio beschikbaar" },
        { status: 404 }
      );
    }

    try {
      await stat(meeting.audioPad);
    } catch {
      return NextResponse.json(
        { fout: "Audiobestand niet gevonden" },
        { status: 404 }
      );
    }

    const buffer = await readFile(meeting.audioPad);
    const ext = meeting.audioPad.split(".").pop() || "webm";

    const mimeTypes: Record<string, string> = {
      webm: "audio/webm",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      ogg: "audio/ogg",
      m4a: "audio/mp4",
      mp4: "video/mp4",
    };

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeTypes[ext] || "audio/webm",
        "Content-Length": String(buffer.length),
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    if (message === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: message }, { status: 401 });
    }
    return NextResponse.json({ fout: message }, { status: 500 });
  }
}
