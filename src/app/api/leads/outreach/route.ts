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

// GET /api/leads/outreach
// Returnt outreach_settings + lead counts per status. Voor de dashboard
// pagina + instellingen sectie waar dag-limiet en domein rotatie wordt
// beheerd.
export async function GET(req: NextRequest) {
  try {
    await authenticate(req);
    const supabase = getSupabaseLeads();

    const { data: settings, error: settingsErr } = await supabase
      .from("outreach_settings")
      .select("*")
      .single();

    // Lead counts per outreach status
    const { data: leads, error: leadsErr } = await supabase
      .from("leads")
      .select("outreach_status")
      .not("outreach_status", "is", null);

    if (leadsErr) {
      return NextResponse.json(
        { fout: `Supabase error: ${leadsErr.message}` },
        { status: 500 }
      );
    }

    const counts: Record<string, number> = {};
    for (const l of leads || []) {
      const s = l.outreach_status || "unknown";
      counts[s] = (counts[s] || 0) + 1;
    }

    return NextResponse.json({
      settings: settingsErr ? null : settings,
      counts,
      settingsError: settingsErr?.message ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: message },
      { status: message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// PATCH /api/leads/outreach
// Body: { id: string, dag_limiet?: number }
export async function PATCH(req: NextRequest) {
  try {
    await authenticate(req);

    const body = (await req.json()) as {
      id?: string;
      dag_limiet?: number;
    };

    if (!body.id) {
      return NextResponse.json({ fout: "id is verplicht" }, { status: 400 });
    }

    const updates: { dag_limiet?: number } = {};
    if (body.dag_limiet !== undefined) updates.dag_limiet = body.dag_limiet;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ fout: "geen velden om te updaten" }, { status: 400 });
    }

    const supabase = getSupabaseLeads();
    const { error } = await supabase
      .from("outreach_settings")
      .update(updates)
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
