import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { renderToBuffer } from "@react-pdf/renderer";
import { MaandrapportPDF } from "@/lib/maandrapport-pdf";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const maand = searchParams.get("maand");

    if (!maand || !/^\d{4}-\d{2}$/.test(maand)) {
      return NextResponse.json({ fout: "Maand parameter vereist in YYYY-MM formaat" }, { status: 400 });
    }

    // Fetch maandrapport data from own API
    const baseUrl = process.env.NEXT_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
    const dataRes = await fetch(`${baseUrl}/api/belasting/maandrapport?maand=${maand}`, {
      headers: { cookie: req.headers.get("cookie") ?? "" },
    });

    if (!dataRes.ok) {
      const err = await dataRes.json();
      return NextResponse.json({ fout: err.fout ?? "Kon data niet ophalen" }, { status: 500 });
    }

    const { maandrapport } = await dataRes.json();
    const pdfBuffer = await renderToBuffer(
      <MaandrapportPDF data={maandrapport} />
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="belastingoverzicht-${maand}.pdf"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
