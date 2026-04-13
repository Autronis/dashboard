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

// GET /api/leads/settings
// Alle app_settings key-value paren.
export async function GET(req: NextRequest) {
  try {
    await authenticate(req);
    const supabase = getSupabaseLeads();
    const { data, error } = await supabase.from("app_settings").select("*");
    if (error) {
      return NextResponse.json(
        { fout: `Supabase error: ${error.message}` },
        { status: 500 }
      );
    }
    // Flatten naar { key: value }
    const settings: Record<string, string> = {};
    for (const row of data || []) {
      if (row.id && row.value) settings[row.id] = row.value;
    }
    return NextResponse.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: message },
      { status: message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// PATCH /api/leads/settings
// Body: { id: string, value: string } — upsert
export async function PATCH(req: NextRequest) {
  try {
    await authenticate(req);
    const body = (await req.json()) as { id?: string; value?: string };
    if (!body.id || body.value === undefined) {
      return NextResponse.json(
        { fout: "id en value zijn verplicht" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseLeads();
    const { error } = await supabase.from("app_settings").upsert({
      id: body.id,
      value: body.value,
      updated_at: new Date().toISOString(),
    });

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
