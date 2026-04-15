import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { focusLogs } from "@/lib/db/schema";
import { requireAuthOrApiKey } from "@/lib/auth";

// POST /api/focus/log
// Body: { tekst: string, bron?: string }
// Schrijft een korte 1-zin samenvatting van wat de user op dat moment
// doet. Wordt door /api/screen-time/sessies opgehaald als extra context
// voor rijkere timeline beschrijvingen. Accepteert zowel cookie session
// (browser) als Bearer API key (Claude Code hook).
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuthOrApiKey(req);
    const body = (await req.json()) as { tekst?: string; bron?: string };

    const tekst = body.tekst?.trim();
    if (!tekst) {
      return NextResponse.json({ fout: "tekst is verplicht" }, { status: 400 });
    }
    if (tekst.length > 200) {
      return NextResponse.json(
        { fout: "tekst te lang (max 200 chars)" },
        { status: 400 }
      );
    }

    const bron = (body.bron || "claude-code").slice(0, 30);

    await db.insert(focusLogs).values({
      gebruikerId: gebruiker.id,
      tekst,
      bron,
    });

    return NextResponse.json({ ok: true });
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
