import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

// GET /api/klant-gezondheid/export?format=csv
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const format = req.nextUrl.searchParams.get("format") ?? "csv";

    // Haal scores op via interne API call
    const baseUrl = req.nextUrl.origin;
    const res = await fetch(`${baseUrl}/api/klant-gezondheid`, {
      headers: { cookie: req.headers.get("cookie") ?? "" },
    });

    if (!res.ok) {
      return NextResponse.json({ fout: "Kon scores niet ophalen" }, { status: 500 });
    }

    const data = await res.json();
    const klanten = data.klanten as Array<{
      bedrijfsnaam: string;
      contactpersoon: string | null;
      email: string | null;
      branche: string | null;
      totaalScore: number;
      communicatieScore: number;
      betalingScore: number;
      projectScore: number;
      tevredenheidScore: number;
      activiteitScore: number;
      trend: number | null;
    }>;

    if (format === "csv") {
      return buildCsvResponse(klanten);
    }

    return NextResponse.json({ fout: "Ongeldig format. Gebruik ?format=csv" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 },
    );
  }
}

function buildCsvResponse(klanten: Array<Record<string, unknown>>): NextResponse {
  const bom = "\uFEFF";
  const header = "Bedrijf;Contactpersoon;E-mail;Branche;Totaalscore;Communicatie;Betaling;Project;Tevredenheid;Activiteit;Trend";

  const rows = klanten.map((k) => {
    return [
      k.bedrijfsnaam ?? "",
      k.contactpersoon ?? "",
      k.email ?? "",
      k.branche ?? "",
      k.totaalScore ?? 0,
      k.communicatieScore ?? 0,
      k.betalingScore ?? 0,
      k.projectScore ?? 0,
      k.tevredenheidScore ?? 0,
      k.activiteitScore ?? 0,
      k.trend !== null ? (k.trend as number > 0 ? `+${k.trend}` : String(k.trend)) : "-",
    ]
      .map((v) => `"${v}"`)
      .join(";");
  });

  const csv = bom + header + "\n" + rows.join("\n");
  const datum = new Date().toISOString().substring(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="klant-gezondheid-${datum}.csv"`,
    },
  });
}
