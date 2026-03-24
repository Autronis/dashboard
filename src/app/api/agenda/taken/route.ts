import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

// GET /api/agenda/taken - Haal open/bezig taken op voor kalender
export async function GET() {
  try {
    await requireAuth();

    const rows = sqlite.prepare(`
      SELECT
        t.id,
        t.titel,
        t.status,
        t.prioriteit,
        t.deadline,
        t.geschatte_duur as geschatteDuur,
        t.ingepland_start as ingeplandStart,
        t.ingepland_eind as ingeplandEind,
        t.toegewezen_aan as toegewezenAanId,
        p.naam as projectNaam
      FROM taken t
      LEFT JOIN projecten p ON t.project_id = p.id
      WHERE t.status IN ('open', 'bezig')
      ORDER BY
        CASE t.prioriteit WHEN 'hoog' THEN 0 WHEN 'normaal' THEN 1 ELSE 2 END,
        t.deadline ASC
    `).all();

    return NextResponse.json({ taken: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    const isAuth = message === "Niet geauthenticeerd";
    return NextResponse.json({ fout: message }, { status: isAuth ? 401 : 500 });
  }
}
