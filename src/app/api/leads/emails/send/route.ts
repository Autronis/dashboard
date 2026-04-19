import { NextRequest, NextResponse } from "next/server";
import { getSupabaseLeads } from "@/lib/supabase-leads";
import { requireAuth, requireApiKey } from "@/lib/auth";

const SEND_WEBHOOK_URL = "https://n8n.srv1166699.hstgr.cloud/webhook/send-approved-emails";

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    await requireApiKey(req);
  } else {
    await requireAuth();
  }
}

// POST /api/leads/emails/send
// Body: { ids: string[] } — een lijst email IDs om te versturen
// Haalt de emails op, joint met leads voor company_email, en POSTet naar
// de n8n send-approved-emails webhook. Updates email_status naar 'sending'
// optimistisch zodat de UI kan tonen wat er bezig is.
export async function POST(req: NextRequest) {
  try {
    await authenticate(req);

    const body = (await req.json()) as { ids?: string[] };
    const ids = body.ids ?? [];
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ fout: "ids array is verplicht" }, { status: 400 });
    }

    const supabase = getSupabaseLeads();

    // Fetch de emails met joined lead emails
    const { data: emails, error: fetchErr } = await supabase
      .from("emails")
      .select(
        "id, lead_id, recipient_email, generated_subject, generated_email, leads:lead_id(emails), google_maps_leads:google_maps_lead_id(email)"
      )
      .in("id", ids);

    if (fetchErr) {
      return NextResponse.json(
        { fout: `Supabase fetch failed: ${fetchErr.message}` },
        { status: 500 }
      );
    }

    if (!emails || emails.length === 0) {
      return NextResponse.json({ fout: "Geen emails gevonden voor deze IDs" }, { status: 404 });
    }

    // Bouw payload voor n8n
    type EmailRow = {
      id: string;
      lead_id: string | null;
      recipient_email: string | null;
      generated_subject: string | null;
      generated_email: string | null;
      leads?: { emails: string | null } | null;
      google_maps_leads?: { email: string | null } | null;
    };

    const payload = (emails as EmailRow[]).map((e) => ({
      email_id: e.id,
      lead_id: e.lead_id,
      company_email:
        e.recipient_email || e.leads?.emails || e.google_maps_leads?.email || "",
      email_subject: e.generated_subject || "",
      email_body: e.generated_email || "",
    }));

    // Filter weg: emails zonder recipient
    const validPayload = payload.filter((p) => p.company_email.trim().length > 0);
    if (validPayload.length === 0) {
      return NextResponse.json(
        { fout: "Geen emails met geldig recipient adres" },
        { status: 400 }
      );
    }

    // Markeer optimistisch als 'sending'
    const validIds = validPayload.map((p) => p.email_id);
    await supabase
      .from("emails")
      .update({ email_status: "sending", updated_at: new Date().toISOString() })
      .in("id", validIds);

    // POST naar n8n webhook
    let webhookOk = false;
    let webhookError: string | null = null;
    try {
      const webhookRes = await fetch(SEND_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });
      webhookOk = webhookRes.ok;
      if (!webhookOk) {
        webhookError = `n8n responded ${webhookRes.status}`;
      }
    } catch (e) {
      webhookError = e instanceof Error ? e.message : "Unknown webhook error";
    }

    // Als webhook faalt: rollback status naar 'approved'
    if (!webhookOk) {
      await supabase
        .from("emails")
        .update({ email_status: "approved", updated_at: new Date().toISOString() })
        .in("id", validIds);
      return NextResponse.json(
        { fout: `Webhook failed: ${webhookError}`, ids: validIds },
        { status: 502 }
      );
    }

    // Webhook ok: zet leads.emailed_at = now zodat UI de verstuur-timestamp kan tonen.
    // n8n zou dit eigenlijk bij succesvolle delivery moeten terugsturen, maar in
    // de huidige flow komt er geen callback — dus we zetten 'm optimistisch bij
    // de dispatch naar n8n. Bij hard fail hierna blijft de timestamp staan maar
    // status gaat via stuck-recovery of handmatig terug naar approved.
    const now = new Date().toISOString();
    const leadIds = validPayload
      .map((p) => p.lead_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    if (leadIds.length > 0) {
      await supabase
        .from("leads")
        .update({ emailed_at: now, outreach_status: "emailed" })
        .in("id", leadIds);
    }

    return NextResponse.json({
      ok: true,
      verstuurd: validPayload.length,
      ids: validIds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: message },
      { status: message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
