import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { db } from "@/lib/db";
import { projecten } from "@/lib/db/schema";
import { requireAuthOrApiKey } from "@/lib/auth";
import { eq } from "drizzle-orm";

// POST /api/projecten/[id]/genereer-scope
// Body: the scope JSON produced by the scope-generator skill (6-fase wizard
// output). Flow:
//   1. Write the JSON to a tempfile
//   2. Spawn `node ~/.claude/skills/scope/generate-pdf.js <tempfile> <projectId>`
//   3. The skill generates the PDF and uploads it to the dashboard upload
//      endpoint, which writes scope_pdf_url + scope_data to the project row
//   4. Return the uploaded URL
//
// This endpoint is a thin trigger — it only works on the machine where the
// skill is installed (Sem's or Syb's Mac running the dev server). Production
// dashboard deploys on Vercel cannot run it (no local skill/puppeteer), so
// the wizard UI on production will POST the PDF directly to /scope/upload
// instead of calling this endpoint.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuthOrApiKey(req);

    const { id } = await params;
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ fout: "Ongeldig project ID" }, { status: 400 });
    }

    // Verify project exists
    const [project] = await db.select().from(projecten).where(eq(projecten.id, projectId));
    if (!project) {
      return NextResponse.json({ fout: "Project niet gevonden" }, { status: 404 });
    }

    const scopeData = await req.json();
    if (!scopeData || typeof scopeData !== "object") {
      return NextResponse.json(
        { fout: "Verwacht een scope JSON object in de body" },
        { status: 400 }
      );
    }

    const skillPath = path.join(os.homedir(), ".claude", "skills", "scope", "generate-pdf.js");
    try {
      await fs.access(skillPath);
    } catch {
      return NextResponse.json(
        {
          fout: `Scope-generator skill niet gevonden op ${skillPath}. Clone https://github.com/Autronis/scope-generator.git naar ~/.claude/skills/scope.`,
        },
        { status: 500 }
      );
    }

    // Write scope JSON to tempfile
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "scope-"));
    const jsonPath = path.join(tmpDir, "scope.json");
    await fs.writeFile(jsonPath, JSON.stringify(scopeData, null, 2), "utf-8");

    // Spawn the skill — it will generate the PDF and upload to /scope/upload
    const output = await new Promise<{ stdout: string; stderr: string; code: number }>(
      (resolve, reject) => {
        const child = spawn("node", [skillPath, jsonPath, String(projectId)], {
          cwd: path.dirname(skillPath),
          env: process.env,
        });

        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
        child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
        child.on("error", reject);
        child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
      }
    );

    // Cleanup tempfile
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});

    if (output.code !== 0) {
      return NextResponse.json(
        {
          fout: `Scope generatie mislukt (exit ${output.code})`,
          stderr: output.stderr,
          stdout: output.stdout,
        },
        { status: 500 }
      );
    }

    // The skill prints a JSON line when upload succeeded
    let skillResult: { localPath?: string; url?: string; projectId?: number } = {};
    try {
      const trimmed = output.stdout.trim();
      const lastLine = trimmed.split("\n").filter(Boolean).pop() || "";
      skillResult = JSON.parse(lastLine);
    } catch {
      // Fallback: skill might have only printed a path (no upload triggered)
      return NextResponse.json(
        {
          fout: "Scope-generator heeft geen upload-response teruggegeven",
          stdout: output.stdout,
        },
        { status: 500 }
      );
    }

    // Refetch project to return the persisted scope_pdf_url
    const [updated] = await db.select().from(projecten).where(eq(projecten.id, projectId));

    return NextResponse.json({
      succes: true,
      url: skillResult.url,
      localPath: skillResult.localPath,
      scopePdfUrl: updated?.scopePdfUrl,
    });
  } catch (error) {
    console.error("[genereer-scope] fout:", error);
    return NextResponse.json(
      {
        fout:
          error instanceof Error ? error.message : "Onbekende fout bij genereren",
      },
      { status: 500 }
    );
  }
}
