import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// POST /api/projecten/[id]/scope/upload
// Accepts a PDF (multipart form-data with field "file") OR raw application/pdf body.
// Uploads to Vercel Blob and stores the public URL on projecten.scope_pdf_url.
// Optional form field "scopeData" — JSON string of the scope plan, stored in scope_data.
//
// Requires BLOB_READ_WRITE_TOKEN env var (Vercel Blob).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

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

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        {
          fout:
            "Vercel Blob niet geconfigureerd: BLOB_READ_WRITE_TOKEN ontbreekt. Voeg deze toe aan de Vercel project env vars en aan .env.local voor lokaal werk.",
        },
        { status: 500 }
      );
    }

    let pdfBuffer: Buffer;
    let scopeData: string | null = null;

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { fout: "Geen PDF geupload — voeg een 'file' veld toe in de form-data" },
          { status: 400 }
        );
      }
      if (file.type && !file.type.includes("pdf")) {
        return NextResponse.json(
          { fout: `Bestand moet een PDF zijn (kreeg ${file.type})` },
          { status: 400 }
        );
      }
      pdfBuffer = Buffer.from(await file.arrayBuffer());

      const sd = form.get("scopeData");
      if (typeof sd === "string" && sd.length > 0) {
        try {
          // Validate it's valid JSON
          JSON.parse(sd);
          scopeData = sd;
        } catch {
          return NextResponse.json(
            { fout: "scopeData moet geldige JSON zijn" },
            { status: 400 }
          );
        }
      }
    } else if (contentType.includes("application/pdf")) {
      const arrayBuf = await req.arrayBuffer();
      pdfBuffer = Buffer.from(arrayBuf);
    } else {
      return NextResponse.json(
        {
          fout:
            "Verwacht multipart/form-data met 'file' veld of application/pdf body",
        },
        { status: 400 }
      );
    }

    if (pdfBuffer.length === 0) {
      return NextResponse.json({ fout: "Lege PDF" }, { status: 400 });
    }

    // Upload to Vercel Blob — random suffix prevents URL collisions across re-uploads
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

    // Persist URL (and optional scope JSON) on the project
    const updateValues: { scopePdfUrl: string; scopeData?: string } = {
      scopePdfUrl: blob.url,
    };
    if (scopeData) updateValues.scopeData = scopeData;

    await db.update(projecten).set(updateValues).where(eq(projecten.id, projectId));

    return NextResponse.json({
      succes: true,
      url: blob.url,
      pathname: blob.pathname,
      grootte: pdfBuffer.length,
    });
  } catch (error) {
    console.error("[scope/upload] fout:", error);
    return NextResponse.json(
      {
        fout:
          error instanceof Error ? error.message : "Onbekende fout bij upload",
      },
      { status: 500 }
    );
  }
}
