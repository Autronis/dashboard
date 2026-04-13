import { NextRequest, NextResponse } from "next/server";
import { getSupabaseLeads } from "@/lib/supabase-leads";
import { requireAuth } from "@/lib/auth";

// GET /api/leads
// Alle externe leads uit de lead-dashboard-v2 Supabase (hurzsuwaccglzoblqkxd).
// Internal/CRM leads leven nu onder /api/klant-leads (verplaatst om de
// namespace vrij te maken voor de leadgen integratie).
export async function GET() {
  try {
    await requireAuth();

    const supabase = getSupabaseLeads();
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { fout: `Supabase error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ leads: data ?? [] });
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
    await requireAuth();

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
