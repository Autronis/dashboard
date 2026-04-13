import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { remoteCommits, projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { desc, eq, gte, and, inArray } from "drizzle-orm";

/**
 * GET /api/remote-commits
 *
 * Returnt de laatste GitHub commits van de afgelopen 48u op projecten
 * waar de huidige gebruiker bij betrokken is (sem/syb/team/vrij filter).
 * De banner logic client-side dismisst ze via localStorage.
 */
export async function GET() {
  try {
    const gebruiker = await requireAuth();
    const visibleCodes: ("sem" | "syb" | "team" | "vrij")[] =
      gebruiker.id === 2 ? ["syb", "team", "vrij"] : ["sem", "team", "vrij"];

    // Projecten die deze gebruiker mag zien
    const mijnProjecten = await db
      .select({ id: projecten.id, naam: projecten.naam, eigenaar: projecten.eigenaar })
      .from(projecten)
      .where(inArray(projecten.eigenaar, visibleCodes));

    const projectIds = mijnProjecten.map((p) => p.id);
    if (projectIds.length === 0) {
      return NextResponse.json({ commits: [] });
    }

    const sinds = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const commits = await db
      .select({
        id: remoteCommits.id,
        projectId: remoteCommits.projectId,
        sha: remoteCommits.sha,
        auteurNaam: remoteCommits.auteurNaam,
        bericht: remoteCommits.bericht,
        branch: remoteCommits.branch,
        pushedOp: remoteCommits.pushedOp,
      })
      .from(remoteCommits)
      .where(
        and(
          inArray(remoteCommits.projectId, projectIds),
          gte(remoteCommits.aangemaaktOp, sinds)
        )
      )
      .orderBy(desc(remoteCommits.pushedOp))
      .limit(50);

    // Rijk ze met project naam
    const projectMap = new Map(mijnProjecten.map((p) => [p.id, p.naam]));
    const result = commits.map((c) => ({
      ...c,
      projectNaam: c.projectId !== null ? projectMap.get(c.projectId) ?? null : null,
    }));

    return NextResponse.json({ commits: result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: msg },
      { status: msg === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
