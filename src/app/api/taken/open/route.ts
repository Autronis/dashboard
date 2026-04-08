import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, projecten } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-api-key") || req.headers.get("authorization")?.replace("Bearer ", "");
  if (key !== process.env.SESSION_SECRET) {
    return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
  }

  const projectId = req.nextUrl.searchParams.get("projectId");
  const conditions = [sql`${taken.status} != 'afgerond'`];
  if (projectId) conditions.push(eq(taken.projectId, Number(projectId)));

  const rows = await db
    .select({
      id: taken.id,
      titel: taken.titel,
      status: taken.status,
      fase: taken.fase,
      projectId: taken.projectId,
      projectNaam: projecten.naam,
    })
    .from(taken)
    .leftJoin(projecten, eq(taken.projectId, projecten.id))
    .where(and(...conditions))
    .all();

  return NextResponse.json({ taken: rows }, {
    headers: { "Cache-Control": "no-store" },
  });
}
