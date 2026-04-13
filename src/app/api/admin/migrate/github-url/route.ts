import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { requireAuth, requireApiKey } from "@/lib/auth";

// POST /api/admin/migrate/github-url
// One-shot: voegt github_url kolom toe aan projecten tabel als die nog
// niet bestaat. Idempotent — veilig om meerdere keren aan te roepen.
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      await requireApiKey(req);
    } else {
      await requireAuth();
    }

    // Check of kolom bestaat
    const cols = await db
      .all(sql`PRAGMA table_info(projecten)`);
    const hasCol = (cols as Array<{ name: string }>).some((c) => c.name === "github_url");

    if (hasCol) {
      return NextResponse.json({ ok: true, alreadyExists: true });
    }

    await db.run(sql`ALTER TABLE projecten ADD COLUMN github_url TEXT`);

    return NextResponse.json({ ok: true, added: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 500 }
    );
  }
}
