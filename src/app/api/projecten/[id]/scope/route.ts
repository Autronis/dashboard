import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { createRequire } from "module";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { projecten } from "@/lib/db/schema";
import { requireAuthOrApiKey } from "@/lib/auth";
import { eq } from "drizzle-orm";

// Node runtime — @sparticuz/chromium + puppeteer require native binaries.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // PDF generation can take ~30-60s cold start

// POST /api/projecten/[id]/scope
//
// Unified scope-plan endpoint. Accepts a full scope JSON (as produced by
// Syb's /scope skill in Claude Code, see vendor/scope-generator/SKILL.md)
// and generates a PDF using vendor/scope-generator/generate-pdf.js. The
// same generator runs locally (full puppeteer) and on Vercel (@sparticuz
// /chromium) — see getPuppeteer() in the submodule.
//
// Body:
//   {
//     scopeData: { ...full scope JSON matching SKILL.md structure... },
//     // Optional overrides — if set, these replace the meta values in scopeData:
//     showPrices?: boolean,
//     showArchitectureDiagram?: boolean
//   }
//
// Flow:
//   1. Validate scopeData + merge any override toggles into scopeData.meta
//   2. Render PDF buffer via generatePdfBuffer(scopeData)
//   3. Upload buffer to Vercel Blob (scopes/{projectId}-{slug}.pdf, random suffix)
//   4. Store full scopeData JSON on project.scope_data + blob URL on project.scope_pdf_url
//   5. Return { url, scopeData }
//
// Replaces the old /api/projecten/[id]/genereer-scope endpoint which used
// child_process.spawn — that only worked on Sem's/Syb's Mac because it needed
// the skill installed in ~/.claude/skills/scope/. The new endpoint bundles
// the skill as a git submodule so it works everywhere, including Vercel.
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

    const [project] = await db
      .select()
      .from(projecten)
      .where(eq(projecten.id, projectId));
    if (!project) {
      return NextResponse.json({ fout: "Project niet gevonden" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { fout: "Verwacht JSON body met scopeData" },
        { status: 400 }
      );
    }

    const scopeData = body.scopeData;
    if (!scopeData || typeof scopeData !== "object") {
      return NextResponse.json(
        {
          fout:
            "scopeData ontbreekt of is ongeldig. Zie vendor/scope-generator/SKILL.md voor de verwachte JSON structuur.",
        },
        { status: 400 }
      );
    }

    // Merge optional toggle overrides into meta so Syb's template engine
    // picks them up. Defaults (undefined) leave the existing meta values alone.
    const mergedScopeData = {
      ...scopeData,
      meta: {
        ...(scopeData.meta || {}),
        ...(typeof body.showPrices === "boolean" ? { show_prices: body.showPrices } : {}),
        ...(typeof body.showArchitectureDiagram === "boolean"
          ? { show_architecture_diagram: body.showArchitectureDiagram }
          : {}),
      },
    };

    // Use createRequire to bypass Next.js's bundler — it tries to statically
    // trace CommonJS requires and chokes on the scope-generator submodule's
    // dynamic puppeteer loader. createRequire gives us a plain Node require
    // at runtime, untouched by webpack/turbopack.
    const nodeRequire = createRequire(process.cwd() + "/package.json");
    const submodulePath = path.join(
      process.cwd(),
      "vendor",
      "scope-generator",
      "generate-pdf.js"
    );
    const { generatePdfBuffer } = nodeRequire(submodulePath) as {
      generatePdfBuffer: (data: unknown) => Promise<Buffer>;
    };

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await generatePdfBuffer(mergedScopeData);
    } catch (err) {
      console.error("[scope] PDF generation failed:", err);
      return NextResponse.json(
        {
          fout: "PDF generatie mislukt",
          details: err instanceof Error ? err.message : String(err),
        },
        { status: 500 }
      );
    }

    // Upload to Vercel Blob
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        {
          fout:
            "BLOB_READ_WRITE_TOKEN ontbreekt — kan PDF niet uploaden. Configureer Vercel Blob voor dit project.",
        },
        { status: 500 }
      );
    }

    const safeName = (project.naam || `project-${projectId}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    const blobPath = `scopes/${projectId}-${safeName}.pdf`;

    const blob = await put(blobPath, pdfBuffer, {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: true,
    });

    // Persist full scope JSON + blob URL on the project row.
    await db
      .update(projecten)
      .set({
        scopeData: JSON.stringify(mergedScopeData),
        scopePdfUrl: blob.url,
      })
      .where(eq(projecten.id, projectId));

    return NextResponse.json({
      succes: true,
      url: blob.url,
      pathname: blob.pathname,
      grootte: pdfBuffer.length,
      scopeData: mergedScopeData,
    });
  } catch (error) {
    console.error("[scope POST]", error);
    return NextResponse.json(
      {
        fout: error instanceof Error ? error.message : "Onbekende fout bij scope generatie",
      },
      { status: 500 }
    );
  }
}
