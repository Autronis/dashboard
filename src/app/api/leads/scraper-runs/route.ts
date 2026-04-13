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

// GET /api/leads/scraper-runs?limit=20
export async function GET(req: NextRequest) {
  try {
    await authenticate(req);
    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || "20")));

    const supabase = getSupabaseLeads();
    const { data, error } = await supabase
      .from("scraper_runs")
      .select("*")
      .eq("user_id", SYB_USER_ID)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json(
        { fout: `Supabase error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ runs: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: message },
      { status: message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/leads/scraper-runs
// Body: { id: string }
export async function DELETE(req: NextRequest) {
  try {
    await authenticate(req);
    const body = (await req.json()) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ fout: "id is verplicht" }, { status: 400 });
    }

    const supabase = getSupabaseLeads();
    const { error } = await supabase
      .from("scraper_runs")
      .delete()
      .eq("id", body.id);

    if (error) {
      return NextResponse.json(
        { fout: `Supabase error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: message },
      { status: message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
