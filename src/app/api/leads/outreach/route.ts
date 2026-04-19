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

    // Single source of truth: counts komen uit de emails tabel (email_status).
    // De OutreachSection KPI's tonen state van de email-pipeline, niet van leads.
    // Historisch mismatch: leads.outreach_status blijft achter wanneer we status
    // op email-niveau updaten (approved/sent in emails tabel). Nu fixed.
    const { data: emailRows, error: emailsErr } = await supabase
      .from("emails")
      .select("email_status");

    if (emailsErr) {
      return NextResponse.json(
        { fout: `Supabase error (emails): ${emailsErr.message}` },
        { status: 500 }
      );
    }

    // ready_for_generation komt uit leads omdat er nog geen email record bestaat.
    const { data: leadsWaitingGen, error: leadsErr } = await supabase
      .from("leads")
      .select("outreach_status")
      .in("outreach_status", [
        "ready_for_generation",
        "generating",
        "generation_failed",
      ]);

    if (leadsErr) {
      return NextResponse.json(
        { fout: `Supabase error (leads): ${leadsErr.message}` },
        { status: 500 }
      );
    }

    const counts: Record<string, number> = {
      ready_for_generation: 0,
      generating: 0,
      generation_failed: 0,
      ready_for_review: 0,
      approved: 0,
      emailed: 0,
      replied: 0,
    };

    // Email-status → OutreachSection KPI-key mapping
    for (const e of emailRows ?? []) {
      const s = e.email_status;
      if (s === "generated") counts.ready_for_review += 1;
      else if (s === "approved") counts.approved += 1;
      else if (s === "sent" || s === "sending") counts.emailed += 1;
      else if (s === "replied") counts.replied += 1;
      else if (s === "generating") counts.generating += 1;
      else if (s === "generation_failed" || s === "failed" || s === "error") {
        counts.generation_failed += 1;
      }
    }

    // Lead-level ready_for_generation (leads zonder email record nog)
    for (const l of leadsWaitingGen ?? []) {
      const s = l.outreach_status;
      if (s === "ready_for_generation") counts.ready_for_generation += 1;
      // generating/generation_failed tellen we alleen als er geen email record is —
      // anders dubbel. Voor nu laten we lead-level alleen ready_for_generation
      // aanvullen; de andere twee komen uit emails tabel.
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
// Body: { id: string, dag_limiet?, aantal_inboxes?, auto_verdelen?, per_inbox_limiet? }
export async function PATCH(req: NextRequest) {
  try {
    await authenticate(req);

    const body = (await req.json()) as {
      id?: string;
      dag_limiet?: number;
      aantal_inboxes?: number;
      auto_verdelen?: boolean;
      per_inbox_limiet?: number;
    };

    if (!body.id) {
      return NextResponse.json({ fout: "id is verplicht" }, { status: 400 });
    }

    const updates: {
      dag_limiet?: number;
      aantal_inboxes?: number;
      auto_verdelen?: boolean;
      per_inbox_limiet?: number;
    } = {};
    if (body.dag_limiet !== undefined) updates.dag_limiet = body.dag_limiet;
    if (body.aantal_inboxes !== undefined) updates.aantal_inboxes = body.aantal_inboxes;
    if (body.auto_verdelen !== undefined) updates.auto_verdelen = body.auto_verdelen;
    if (body.per_inbox_limiet !== undefined) updates.per_inbox_limiet = body.per_inbox_limiet;

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
