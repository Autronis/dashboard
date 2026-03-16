// @ts-nocheck
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ideeen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { createEnrichedNotionPlan } from "@/lib/notion-plan-generator";
import { readFile } from "fs/promises";
import path from "path";

const PROJECTS_DIR = "c:/Users/semmi/OneDrive/Claude AI/Projects";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const idee = db.select().from(ideeen).where(eq(ideeen.id, Number(id))).get();
    if (!idee) {
      return NextResponse.json({ fout: "Idee niet gevonden" }, { status: 404 });
    }

    const slug = idee.naam.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const projectDir = path.join(PROJECTS_DIR, slug);

    const briefContent = await readFile(path.join(projectDir, "PROJECT_BRIEF.md"), "utf-8").catch(() => null);
    const todoContent = await readFile(path.join(projectDir, "TODO.md"), "utf-8").catch(() => null);

    const result = await createEnrichedNotionPlan({
      projectNaam: idee.naam,
      briefContent: briefContent,
      todoContent: todoContent,
      status: idee.status === "actief" ? "In Development" : "In Planning",
      klantNaam: "Autronis (intern)",
    });

    db.update(ideeen)
      .set({ notionPageId: result.notionId, bijgewerktOp: new Date().toISOString() })
      .where(eq(ideeen.id, Number(id)))
      .run();

    return NextResponse.json({ succes: true, notionUrl: result.notionUrl });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
