import { NextRequest, NextResponse } from "next/server";

// GET /api/wiki/import/cron — auto-sync docs to wiki (called by Vercel cron)
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret or allow internal calls
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ fout: "Niet geautoriseerd" }, { status: 401 });
    }

    const host = req.headers.get("host") || "localhost:3000";
    const proto = host.includes("localhost") ? "http" : "https";
    const baseUrl = `${proto}://${host}`;

    // Call the import endpoint with overschrijven=true to keep docs up-to-date
    const apiKey = process.env.SESSION_SECRET;
    const res = await fetch(`${baseUrl}/api/wiki/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ overschrijven: true }),
    });

    const data = await res.json();
    return NextResponse.json({ succes: true, ...data });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 500 }
    );
  }
}
