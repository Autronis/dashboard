import { NextRequest, NextResponse } from "next/server";
import { getSupabaseLeads, SYB_USER_ID } from "@/lib/supabase-leads";
import { requireAuth } from "@/lib/auth";

const SEND_WEBHOOK_URL = "https://n8n.srv1166699.hstgr.cloud/webhook/send-approved-emails";

interface Body {
  leadId?: string;
  recipientEmail?: string;
  subject?: string;
  body?: string;
}

// POST /api/leads/website-leads/pitch-mail/send
// Insert de pitch-mail in Syb's emails tabel met source='website_builder', dan
// direct POSTen naar de n8n send webhook — die plakt de signature eraan.
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const payload = (await req.json()) as Body;
    if (!payload.leadId || !payload.subject?.trim() || !payload.body?.trim()) {
      return NextResponse.json(
        { fout: "leadId, subject en body zijn verplicht" },
        { status: 400 },
      );
    }
    if (!payload.recipientEmail?.trim()) {
      return NextResponse.json(
        { fout: "Deze lead heeft geen email-adres — kan niet versturen" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseLeads();

    // Insert email row. source='website_builder' zodat het te onderscheiden is
    // van de reguliere cold-outreach mails uit Syb's flow.
    const { data: inserted, error: insertErr } = await supabase
      .from("emails")
      .insert({
        user_id: SYB_USER_ID,
        source: "website_builder",
        google_maps_lead_id: payload.leadId,
        recipient_email: payload.recipientEmail.trim(),
        generated_subject: payload.subject.trim(),
        generated_email: payload.body.trim(),
        email_status: "approved",
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      return NextResponse.json(
        { fout: `Insert mislukt: ${insertErr?.message ?? "geen data"}` },
        { status: 500 },
      );
    }

    const emailId = inserted.id as string;

    // Optimistisch als 'sending' markeren
    await supabase
      .from("emails")
      .update({ email_status: "sending", updated_at: new Date().toISOString() })
      .eq("id", emailId);

    // Direct POSTen naar n8n send webhook (zelfde payload vorm als reguliere flow)
    let webhookOk = false;
    let webhookError: string | null = null;
    try {
      const res = await fetch(SEND_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          {
            email_id: emailId,
            lead_id: payload.leadId,
            company_email: payload.recipientEmail.trim(),
            email_subject: payload.subject.trim(),
            email_body: payload.body.trim(),
          },
        ]),
      });
      webhookOk = res.ok;
      if (!res.ok) webhookError = `n8n responded ${res.status}`;
    } catch (e) {
      webhookError = e instanceof Error ? e.message : "Onbekende webhook fout";
    }

    if (!webhookOk) {
      await supabase
        .from("emails")
        .update({ email_status: "approved", updated_at: new Date().toISOString() })
        .eq("id", emailId);
      return NextResponse.json(
        { fout: `Webhook faalde: ${webhookError}`, emailId },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, emailId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: message },
      { status: message === "Niet geauthenticeerd" ? 401 : 500 },
    );
  }
}
