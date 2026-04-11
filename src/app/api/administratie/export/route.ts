import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inkomendeFacturen, facturen, bankTransacties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { and, gte, lte, isNotNull, like } from "drizzle-orm";
import { downloadFromStorage } from "@/lib/supabase";
import archiver from "archiver";

interface StorageFile {
  path: string;
  folder: string;
  name: string;
}

function getDateRange(jaar: number, kwartaal?: number): { start: string; end: string } {
  if (kwartaal) {
    const startMonth = (kwartaal - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const start = `${jaar}-${String(startMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(jaar, endMonth, 0).getDate();
    const end = `${jaar}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { start, end };
  }
  return { start: `${jaar}-01-01`, end: `${jaar}-12-31` };
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "_");
}

function getExtension(path: string): string {
  const parts = path.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "pdf";
}

// GET /api/administratie/export?jaar=2025&kwartaal=1
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const jaar = parseInt(searchParams.get("jaar") ?? String(new Date().getFullYear()), 10);
    const kwartaalParam = searchParams.get("kwartaal");
    const kwartaal = kwartaalParam ? parseInt(kwartaalParam, 10) : undefined;

    const { start, end } = getDateRange(jaar, kwartaal);
    const label = kwartaal ? `${jaar}-Q${kwartaal}` : String(jaar);

    const files: StorageFile[] = [];

    // Inkomende facturen
    const inkomend = await db
      .select({
        datum: inkomendeFacturen.datum,
        leverancier: inkomendeFacturen.leverancier,
        storageUrl: inkomendeFacturen.storageUrl,
      })
      .from(inkomendeFacturen)
      .where(and(gte(inkomendeFacturen.datum, start), lte(inkomendeFacturen.datum, end)));

    for (const f of inkomend) {
      if (f.storageUrl) {
        const datum = sanitize(f.datum);
        const leverancier = sanitize(f.leverancier);
        files.push({
          path: f.storageUrl,
          folder: "facturen-inkomend",
          name: `${datum}_${leverancier}.pdf`,
        });
      }
    }

    // Uitgaande facturen
    const uitgaand = await db
      .select({
        factuurdatum: facturen.factuurdatum,
        factuurnummer: facturen.factuurnummer,
        pdfStorageUrl: facturen.pdfStorageUrl,
      })
      .from(facturen)
      .where(
        and(
          isNotNull(facturen.pdfStorageUrl),
          gte(facturen.factuurdatum, start),
          lte(facturen.factuurdatum, end)
        )
      );

    for (const f of uitgaand) {
      if (f.pdfStorageUrl) {
        const datum = sanitize(f.factuurdatum ?? "");
        const nummer = sanitize(f.factuurnummer);
        files.push({
          path: f.pdfStorageUrl,
          folder: "facturen-uitgaand",
          name: `${datum}_${nummer}.pdf`,
        });
      }
    }

    // Bonnetjes
    const bonnetjes = await db
      .select({
        datum: bankTransacties.datum,
        merchantNaam: bankTransacties.merchantNaam,
        omschrijving: bankTransacties.omschrijving,
        storageUrl: bankTransacties.storageUrl,
      })
      .from(bankTransacties)
      .where(
        and(
          isNotNull(bankTransacties.storageUrl),
          like(bankTransacties.storageUrl, "%/bonnetjes/%"),
          gte(bankTransacties.datum, start),
          lte(bankTransacties.datum, end)
        )
      );

    for (const b of bonnetjes) {
      if (b.storageUrl) {
        const datum = sanitize(b.datum);
        const naam = sanitize(b.merchantNaam ?? b.omschrijving);
        const ext = getExtension(b.storageUrl);
        files.push({
          path: b.storageUrl,
          folder: "bonnetjes",
          name: `${datum}_${naam}.${ext}`,
        });
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { fout: "Geen documenten gevonden voor deze periode" },
        { status: 404 }
      );
    }

    const chunks: Buffer[] = [];
    const archive = archiver("zip", { zlib: { level: 5 } });

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));

    const archiveFinished = new Promise<void>((resolve, reject) => {
      archive.on("end", resolve);
      archive.on("error", reject);
    });

    for (const file of files) {
      try {
        const buffer = await downloadFromStorage(file.path);
        archive.append(buffer, { name: `${file.folder}/${file.name}` });
      } catch {
        // Skip files that fail to download
      }
    }

    archive.finalize();
    await archiveFinished;

    const zipBuffer = Buffer.concat(chunks);

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="administratie-${label}.zip"`,
        "Content-Length": String(zipBuffer.length),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
