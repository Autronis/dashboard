import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { outreachEmails } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  const { trackingId } = await params;
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get("url");

  // Update email als nog niet geklikt
  const email = await db
    .select({ id: outreachEmails.id, gekliktOp: outreachEmails.gekliktOp, geopendOp: outreachEmails.geopendOp })
    .from(outreachEmails)
    .where(eq(outreachEmails.trackingId, trackingId))
    .get();

  if (email) {
    const updates: Record<string, string> = {};
    if (!email.geopendOp) {
      updates.geopendOp = new Date().toISOString();
    }
    if (!email.gekliktOp) {
      updates.gekliktOp = new Date().toISOString();
      updates.status = "geklikt";
    }
    if (Object.keys(updates).length > 0) {
      await db.update(outreachEmails)
        .set(updates)
        .where(eq(outreachEmails.id, email.id))
        .run();
    }
  }

  // Redirect naar de originele URL
  if (targetUrl) {
    try {
      const decodedUrl = decodeURIComponent(targetUrl);
      // Voorkom open redirect naar onveilige URLs
      if (decodedUrl.startsWith("http://") || decodedUrl.startsWith("https://")) {
        return NextResponse.redirect(decodedUrl);
      }
    } catch {
      // Invalid URL, redirect naar homepage
    }
  }

  return NextResponse.redirect(new URL("/", req.url));
}
