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

// GET /api/leads/website-leads
// Alle bedrijven zonder website — gescraped via de Google Maps zoek pipeline.
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
        .from("website_leads")
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

// PATCH /api/leads/website-leads
// Body: { id: string, status?, call_notes?, call_date? }
export async function PATCH(req: NextRequest) {
  try {
    await authenticate(req);
    const body = (await req.json()) as {
      id?: string;
      status?: string;
      call_notes?: string;
      call_date?: string;
      email?: string;
      phone?: string;
    };
    if (!body.id) {
      return NextResponse.json({ fout: "id is verplicht" }, { status: 400 });
    }

    const updates: {
      updated_at: string;
      status?: string;
      call_notes?: string;
      call_date?: string;
      email?: string;
      phone?: string;
    } = {
      updated_at: new Date().toISOString(),
    };
    if (body.status !== undefined) updates.status = body.status;
    if (body.call_notes !== undefined) updates.call_notes = body.call_notes;
    if (body.call_date !== undefined) updates.call_date = body.call_date;
    if (body.email !== undefined) updates.email = body.email;
    if (body.phone !== undefined) updates.phone = body.phone;

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ fout: "geen velden om te updaten" }, { status: 400 });
    }

    const supabase = getSupabaseLeads();
    const { error } = await supabase
      .from("website_leads")
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
