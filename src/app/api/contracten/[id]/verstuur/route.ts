import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contracten, klanten, bedrijfsinstellingen } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import crypto from "crypto";

// POST /api/contracten/[id]/verstuur — stuur ondertekening e-mail
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ fout: "RESEND_API_KEY niet geconfigureerd." }, { status: 500 });
    }

    const [contract] = await db
      .select({
        id: contracten.id,
        titel: contracten.titel,
        type: contracten.type,
        status: contracten.status,
        klantNaam: klanten.bedrijfsnaam,
        klantContactpersoon: klanten.contactpersoon,
        klantEmail: klanten.email,
      })
      .from(contracten)
      .leftJoin(klanten, eq(contracten.klantId, klanten.id))
      .where(eq(contracten.id, Number(id)))
      .all();

    if (!contract) {
      return NextResponse.json({ fout: "Contract niet gevonden." }, { status: 404 });
    }

    if (!contract.klantEmail) {
      return NextResponse.json({ fout: "Klant heeft geen e-mailadres." }, { status: 400 });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const baseUrl = process.env.NEXT_PUBLIC_URL || "https://dashboard.autronis.nl";
    const signingUrl = `${baseUrl}/contract/${token}`;

    // Sla token op
    await db.update(contracten)
      .set({
        ondertekeningToken: token,
        status: "verzonden",
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(contracten.id, Number(id)))
      .run();

    const [bedrijf] = await db.select().from(bedrijfsinstellingen).limit(1).all();
    const bedrijfsnaam = bedrijf?.bedrijfsnaam || "Autronis";
    const fromEmail = bedrijf?.email ? `${bedrijfsnaam} <${bedrijf.email}>` : `${bedrijfsnaam} <noreply@autronis.nl>`;

    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: fromEmail,
      to: contract.klantEmail,
      subject: `Contract ter ondertekening: ${contract.titel}`,
      html: `
<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
  <h2 style="font-size: 22px; margin-bottom: 8px;">Contract ter ondertekening</h2>
  <p style="color: #666; margin-bottom: 24px;">Beste ${contract.klantContactpersoon || contract.klantNaam},</p>
  <p>${bedrijfsnaam} heeft een contract klaar voor uw ondertekening:</p>
  <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 24px 0;">
    <strong>${contract.titel}</strong>
  </div>
  <p>Klik op de knop hieronder om het contract te bekijken en te ondertekenen:</p>
  <a href="${signingUrl}" style="display: inline-block; background: #17B8A5; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
    Contract bekijken & ondertekenen →
  </a>
  <p style="color: #999; font-size: 13px; margin-top: 32px;">Of kopieer deze link: ${signingUrl}</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
  <p style="color: #999; font-size: 12px;">${bedrijfsnaam} · Verstuurd via dashboard.autronis.nl</p>
</div>`,
    });

    return NextResponse.json({ succes: true, signingUrl });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Versturen mislukt" },
      { status: 500 }
    );
  }
}
