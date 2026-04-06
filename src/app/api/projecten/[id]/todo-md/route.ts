import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projecten, taken } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET /api/projecten/[id]/todo-md — Export taken als TODO.md markdown
// Geen auth nodig: wordt aangeroepen door n8n met project ID
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = parseInt(id, 10);

    if (isNaN(projectId)) {
      return new NextResponse("Ongeldig project ID", { status: 400 });
    }

    const project = await db
      .select({ id: projecten.id, naam: projecten.naam })
      .from(projecten)
      .where(eq(projecten.id, projectId))
      .get();

    if (!project) {
      return new NextResponse("Project niet gevonden", { status: 404 });
    }

    const alleTaken = await db
      .select({
        titel: taken.titel,
        fase: taken.fase,
        status: taken.status,
        volgorde: taken.volgorde,
      })
      .from(taken)
      .where(eq(taken.projectId, projectId))
      .orderBy(taken.volgorde)
      .all();

    // Group by fase
    const faseMap = new Map<string, typeof alleTaken>();
    for (const taak of alleTaken) {
      const fase = taak.fase || "Overig";
      if (!faseMap.has(fase)) faseMap.set(fase, []);
      faseMap.get(fase)!.push(taak);
    }

    // Build markdown
    const lines: string[] = ["# Project Tasks", ""];

    for (const [fase, faseTaken] of faseMap) {
      lines.push(`## ${fase}`);
      for (const taak of faseTaken) {
        const checkbox = taak.status === "afgerond" ? "[x]" : "[ ]";
        lines.push(`${checkbox} ${taak.titel}`);
      }
      lines.push("");
    }

    const markdown = lines.join("\n");

    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    return new NextResponse(
      error instanceof Error ? error.message : "Onbekende fout",
      { status: 500 }
    );
  }
}
