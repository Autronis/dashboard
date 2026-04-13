import { NextRequest, NextResponse } from "next/server";
import { getSupabaseLeads } from "@/lib/supabase-leads";
import { requireAuth, requireApiKey } from "@/lib/auth";

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    await requireApiKey(req);
  } else {
    await requireAuth();
  }
}

// GET /api/leads
// Alle externe leads uit de lead-dashboard-v2 Supabase (hurzsuwaccglzoblqkxd).
// Internal/CRM leads leven nu onder /api/klant-leads (verplaatst om de
// namespace vrij te maken voor de leadgen integratie).
// Auth: session cookie OR Bearer API key (voor scripts en de desktop agent).
export async function GET(req: NextRequest) {
  try {
    await authenticate(req);

    const supabase = getSupabaseLeads();

    // Supabase heeft een default row limit van 1000. We hebben 1700+ leads,
    // dus we paginate handmatig in batches van 1000 totdat de batch leeg is.
    const PAGE_SIZE = 1000;
    const allRows: unknown[] = [];
    let page = 0;
    while (true) {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        return NextResponse.json(
          { fout: `Supabase error: ${error.message}` },
          { status: 500 }
        );
      }

      if (!data || data.length === 0) break;
      allRows.push(...data);
      if (data.length < PAGE_SIZE) break; // laatste pagina
      page++;
      if (page > 50) break; // safety: max 50k leads
    }

    return NextResponse.json({ leads: allRows, totaal: allRows.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: message },
      { status: message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/leads
// Body: { ids: string[] }
export async function DELETE(req: NextRequest) {
  try {
    await authenticate(req);

    const body = (await req.json()) as { ids?: string[] };
    const ids = body.ids ?? [];
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { fout: "ids array is verplicht" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseLeads();
    const { error } = await supabase.from("leads").delete().in("id", ids);

    if (error) {
      return NextResponse.json(
        { fout: `Supabase error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ verwijderd: ids.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: message },
      { status: message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
