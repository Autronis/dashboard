import { NextRequest, NextResponse } from "next/server";
import { tursoClient } from "@/lib/db";

function isVercelCron(req: NextRequest): boolean {
  return req.headers.get("x-vercel-cron") === "1";
}

export async function POST(req: NextRequest) {
  if (!isVercelCron(req)) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
      return NextResponse.json({ fout: "unauthorized" }, { status: 401 });
    }
  }
  if (!tursoClient) return NextResponse.json({ fout: "Geen DB" }, { status: 500 });

  const res = await tursoClient.execute({
    sql: "UPDATE isk_items SET status = 'pending' WHERE status = 'processing' AND discovered_at < datetime('now','-1 hour')",
  });

  return NextResponse.json({ succes: true, reset: res.rowsAffected });
}

export async function GET(req: NextRequest) { return POST(req); }
