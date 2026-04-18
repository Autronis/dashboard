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

// GET /api/leads/emails/replies
// Alle emails waar een reply op binnen is gekomen, met lead info en website
// voor directe integratie met Sales Engine (scan + reply-plan).
export async function GET(req: NextRequest) {
  try {
    await authenticate(req);
    const supabase = getSupabaseLeads();

    type Row = {
      id: string;
      lead_id: string | null;
      google_maps_lead_id: string | null;
      recipient_email: string | null;
      generated_subject: string | null;
      generated_email: string | null;
      reply_subject: string | null;
      reply_body: string | null;
      reply_received_at: string | null;
      thread_id: string | null;
      source: string;
      email_status: string | null;
      created_at: string;
      leads?: { name: string | null; website: string | null; emails: string | null } | null;
      google_maps_leads?: { name: string | null; website: string | null; email: string | null } | null;
    };

    const { data, error } = await supabase
      .from("emails")
      .select(
        "id,lead_id,google_maps_lead_id,recipient_email,generated_subject,generated_email,reply_subject,reply_body,reply_received_at,thread_id,source,email_status,created_at,leads:lead_id(name,website,emails),google_maps_leads:google_maps_lead_id(name,website,email)",
      )
      .not("reply_body", "is", null)
      .order("reply_received_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ fout: `Supabase: ${error.message}` }, { status: 500 });
    }

    const rows = (data ?? []) as unknown as Row[];
    const replies = rows.map((e) => {
      const leadName = e.leads?.name || e.google_maps_leads?.name || "Onbekend";
      const website = e.leads?.website || e.google_maps_leads?.website || null;
      const leadEmail =
        e.recipient_email || e.leads?.emails || e.google_maps_leads?.email || null;
      const supabaseLeadId = e.lead_id || e.google_maps_lead_id || null;
      return {
        emailId: e.id,
        leadName,
        website,
        leadEmail,
        supabaseLeadId,
        threadId: e.thread_id,
        source: e.source,
        originalSubject: e.generated_subject,
        originalBody: e.generated_email,
        replySubject: e.reply_subject,
        replyBody: e.reply_body,
        replyReceivedAt: e.reply_received_at,
        emailStatus: e.email_status,
        createdAt: e.created_at,
      };
    });

    return NextResponse.json({ replies, totaal: replies.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: message },
      { status: message === "Niet geauthenticeerd" ? 401 : 500 },
    );
  }
}
