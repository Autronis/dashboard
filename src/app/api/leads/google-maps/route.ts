import { NextRequest, NextResponse } from "next/server";
import { getSupabaseLeads, SYB_USER_ID } from "@/lib/supabase-leads";
import { requireAuth, requireApiKey } from "@/lib/auth";

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    await requireApiKey(req);
  } else {
    await requireAuth();
  }
}

// GET /api/leads/google-maps
// Alle Google Maps leads uit de aparte google_maps_leads tabel.
export async function GET(req: NextRequest) {
  try {
    await authenticate(req);
    const supabase = getSupabaseLeads();

    const PAGE_SIZE = 1000;
    const all: unknown[] = [];
    let page = 0;
    while (true) {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("google_maps_leads")
        .select("*")
        .eq("user_id", SYB_USER_ID)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) {
        return NextResponse.json(
          { fout: `Supabase error: ${error.message}` },
          { status: 500 }
        );
      }
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE_SIZE) break;
      page++;
      if (page > 50) break;
    }

    return NextResponse.json({ leads: all, totaal: all.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: message },
      { status: message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/leads/google-maps
// Body: { ids: string[] }
export async function DELETE(req: NextRequest) {
  try {
    await authenticate(req);
    const body = (await req.json()) as { ids?: string[] };
    const ids = body.ids ?? [];
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ fout: "ids array is verplicht" }, { status: 400 });
    }

    const supabase = getSupabaseLeads();
    const { error } = await supabase.from("google_maps_leads").delete().in("id", ids);
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
