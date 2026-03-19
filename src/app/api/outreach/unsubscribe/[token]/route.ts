import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { outreachOptOuts, outreachSequenties, outreachEmails, leads } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { createHash } from "crypto";

function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = createHash("sha256")
    .update(`unsub-${email}-${process.env.SESSION_SECRET || "salt"}`)
    .digest("hex")
    .substring(0, 32);
  return expected === token;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Zoek een email met dit token (via lead email)
  // We moeten de email zoeken via de sequenties → leads keten
  const alleSequenties = await db.select().from(outreachSequenties).all();
  let gevondenEmail: string | null = null;

  for (const seq of alleSequenties) {
    if (!seq.leadId) continue;
    const lead = await db.select().from(leads).where(eq(leads.id, seq.leadId)).get();
    if (lead?.email && verifyUnsubscribeToken(lead.email, token)) {
      gevondenEmail = lead.email;
      break;
    }
  }

  if (!gevondenEmail) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:60px;">
        <h2>Link ongeldig</h2>
        <p>Deze uitschrijflink is niet geldig of al gebruikt.</p>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // Voeg toe aan opt-out lijst
  const bestaand = await db.select().from(outreachOptOuts).where(eq(outreachOptOuts.email, gevondenEmail)).get();
  if (!bestaand) {
    await db.insert(outreachOptOuts).values({ email: gevondenEmail }).run();
  }

  // Stop alle actieve sequenties voor dit email
  const leadRecords = await db.select().from(leads).where(eq(leads.email, gevondenEmail)).all();
  for (const lead of leadRecords) {
    const actieveSeqs = await db
      .select()
      .from(outreachSequenties)
      .where(
        and(
          eq(outreachSequenties.leadId, lead.id),
          sql`${outreachSequenties.status} IN ('draft', 'actief', 'gepauzeerd')`
        )
      )
      .all();

    for (const seq of actieveSeqs) {
      await db.update(outreachSequenties)
        .set({ status: "gestopt", bijgewerktOp: new Date().toISOString() })
        .where(eq(outreachSequenties.id, seq.id))
        .run();

      // Annuleer geplande emails
      await db.update(outreachEmails)
        .set({ status: "geannuleerd" })
        .where(
          and(
            eq(outreachEmails.sequentieId, seq.id),
            eq(outreachEmails.status, "gepland")
          )
        )
        .run();
    }
  }

  return new NextResponse(
    `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:60px;">
      <h2>Uitgeschreven</h2>
      <p>Je bent succesvol uitgeschreven. Je ontvangt geen emails meer van ons.</p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
