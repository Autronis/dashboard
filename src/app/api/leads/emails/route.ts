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

// GET /api/leads/emails
// Alle gegenereerde cold emails uit de lead-dashboard-v2 Supabase, met
// joined lead names uit zowel de `leads` als `google_maps_leads` tabellen.
// Auth: session OF Bearer API key.
export async function GET(req: NextRequest) {
  try {
    await authenticate(req);

    const supabase = getSupabaseLeads();

    // Pagineren in batches van 1000 (Supabase default cap)
    const PAGE_SIZE = 1000;
    type Row = Record<string, unknown> & {
      id: string;
      lead_id: string | null;
      google_maps_lead_id: string | null;
      recipient_email: string | null;
      leads?: { name: string | null; emails: string | null; emailed_at: string | null } | null;
      google_maps_leads?: { name: string | null; email: string | null } | null;
    };

    const allRows: Row[] = [];
    let page = 0;
    while (true) {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("emails")
        .select(
          "*, leads:lead_id(name, emails, emailed_at), google_maps_leads:google_maps_lead_id(name, email)"
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        return NextResponse.json(
          { fout: `Supabase error: ${error.message}` },
          { status: 500 }
        );
      }
      if (!data || data.length === 0) break;
      allRows.push(...(data as Row[]));
      if (data.length < PAGE_SIZE) break;
      page++;
      if (page > 50) break; // safety
    }

    // Flatten joined fields → lead_name + recipient_email + emailed_at (van lead)
    const mapped = allRows.map((e) => {
      const recipientEmail =
        e.recipient_email || e.leads?.emails || e.google_maps_leads?.email || null;
      const leadName = e.leads?.name || e.google_maps_leads?.name || null;
      const emailedAt = e.leads?.emailed_at ?? null;
      // Strip joined sub-objects om payload klein te houden
      const { leads: _l, google_maps_leads: _g, ...rest } = e;
      return {
        ...rest,
        recipient_email: recipientEmail,
        lead_name: leadName,
        emailed_at: emailedAt,
      };
    });

    return NextResponse.json({ emails: mapped, totaal: mapped.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: message },
      { status: message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// PATCH /api/leads/emails
// Body: { id: string, status?: string, generated_email?: string, generated_subject?: string }
// Voor inline edit + status changes (approve, reject)
export async function PATCH(req: NextRequest) {
  try {
    await authenticate(req);

    const body = (await req.json()) as {
      id?: string;
      ids?: string[];
      email_status?: string;
      generated_email?: string;
      generated_subject?: string;
      recipient_email?: string;
    };
    // Bulk update via { ids: [...], email_status: '...' } — voor "alles goedkeuren/afwijzen"
    if (body.ids && Array.isArray(body.ids) && body.ids.length > 0 && body.email_status) {
      const supabase = getSupabaseLeads();
      const { error } = await supabase
        .from("emails")
        .update({
          email_status: body.email_status,
          updated_at: new Date().toISOString(),
        })
        .in("id", body.ids);
      if (error) {
        return NextResponse.json(
          { fout: `Supabase error: ${error.message}` },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true, bulkUpdated: body.ids.length });
    }

    if (!body.id) {
      return NextResponse.json({ fout: "id is verplicht" }, { status: 400 });
    }

    const updates: {
      updated_at: string;
      email_status?: string;
      generated_email?: string;
      generated_subject?: string;
      recipient_email?: string;
    } = {
      updated_at: new Date().toISOString(),
    };
    if (body.email_status !== undefined) updates.email_status = body.email_status;
    if (body.generated_email !== undefined) updates.generated_email = body.generated_email;
    if (body.generated_subject !== undefined) updates.generated_subject = body.generated_subject;
    if (body.recipient_email !== undefined) updates.recipient_email = body.recipient_email;

    if (Object.keys(updates).length === 1) {
      return NextResponse.json(
        { fout: "geen velden om te updaten" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseLeads();
    const { error } = await supabase
      .from("emails")
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

// DELETE /api/leads/emails
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
    const { error } = await supabase.from("emails").delete().in("id", ids);

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
