import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bedrijfsinstellingen } from "@/lib/db/schema";
import { fetchNotionPageContent } from "@/lib/notion";
import { Resend } from "resend";

// POST /api/documenten/[id]/verstuur
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const body = (await req.json()) as {
      aan: string;
      onderwerp: string;
      bericht: string;
      documentTitel: string;
      includeContent?: boolean;
    };

    if (!body.aan?.trim() || !body.onderwerp?.trim() || !body.bericht?.trim()) {
      return NextResponse.json(
        { fout: "Ontvanger, onderwerp en bericht zijn verplicht." },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { fout: "E-mail is niet geconfigureerd. Stel RESEND_API_KEY in." },
        { status: 500 }
      );
    }

    const [bedrijf] = await db.select().from(bedrijfsinstellingen).limit(1);
    const bedrijfNaam = bedrijf?.bedrijfsnaam || "Autronis";
    const fromEmail = bedrijf?.email || "zakelijk@autronis.com";

    // Fetch document content from Notion if requested
    let documentHtml: string | null = null;
    if (body.includeContent !== false) {
      try {
        documentHtml = await fetchNotionPageContent(id);
      } catch {
        // Document content not available — send without
      }
    }

    const signature = `
<table cellpadding="0" cellspacing="0" border="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#1F2937;line-height:1.5;margin-top:24px;">
  <tr><td style="padding-bottom:16px;border-bottom:2px solid #17B8A5;">
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="padding-right:20px;vertical-align:middle;"><img src="https://dashboard.autronis.nl/logo.png" alt="Autronis" width="80" height="40" style="display:block;" /></td>
      <td style="border-left:2px solid #17B8A5;padding-left:20px;vertical-align:middle;">
        <span style="font-size:17px;font-weight:700;color:#0E1719;letter-spacing:0.5px;">${bedrijfNaam}</span><br>
        <span style="font-size:11px;color:#17B8A5;font-weight:600;">AI & Automatisering</span>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding-top:14px;">
    <table cellpadding="0" cellspacing="0" border="0" style="font-size:12px;color:#6B7280;line-height:1.8;">
      ${bedrijf?.adres ? `<tr><td style="padding-right:8px;color:#9CA3AF;">Adres:</td><td style="color:#1F2937;">${bedrijf.adres}</td></tr>` : ""}
      ${bedrijf?.telefoon ? `<tr><td style="padding-right:8px;color:#9CA3AF;">Tel:</td><td><a href="tel:${bedrijf.telefoon.replace(/\s/g, "")}" style="color:#1F2937;text-decoration:none;">${bedrijf.telefoon}</a></td></tr>` : ""}
      <tr><td style="padding-right:8px;color:#9CA3AF;">E-mail:</td><td><a href="mailto:${fromEmail}" style="color:#17B8A5;text-decoration:none;">${fromEmail}</a></td></tr>
      <tr><td style="padding-right:8px;color:#9CA3AF;">Web:</td><td><a href="https://autronis.nl" style="color:#17B8A5;text-decoration:none;font-weight:600;">autronis.nl</a></td></tr>
    </table>
  </td></tr>
  ${bedrijf?.kvkNummer ? `<tr><td style="padding-top:12px;font-size:10px;color:#9CA3AF;">KvK: ${bedrijf.kvkNummer}</td></tr>` : ""}
</table>`;

    // Build email HTML
    const berichtHtml = body.bericht.replace(/\n/g, "<br>");
    let htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#1F2937;line-height:1.6;">`;
    htmlBody += berichtHtml;

    if (documentHtml) {
      htmlBody += `<div style="margin-top:32px;padding:24px;border:1px solid #E5E7EB;border-radius:12px;background:#F9FAFB;">`;
      htmlBody += `<div style="font-size:12px;color:#6B7280;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px;">Document: ${body.documentTitel}</div>`;
      htmlBody += `<div style="font-size:14px;color:#1F2937;line-height:1.6;">${documentHtml}</div>`;
      htmlBody += `</div>`;
    }

    htmlBody += signature;
    htmlBody += `</body></html>`;

    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: `${bedrijfNaam} <${fromEmail}>`,
      to: body.aan.trim(),
      subject: body.onderwerp.trim(),
      html: htmlBody,
      text: body.bericht.trim(),
    });

    return NextResponse.json({ succes: true });
  } catch (error) {
    console.error("Document email send error:", error);
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Kon e-mail niet versturen" },
      { status: 500 }
    );
  }
}
