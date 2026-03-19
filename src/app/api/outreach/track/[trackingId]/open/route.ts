import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { outreachEmails } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// 1x1 transparent GIF
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  const { trackingId } = await params;

  // Update email als nog niet geopend
  const email = db
    .select({ id: outreachEmails.id, geopendOp: outreachEmails.geopendOp })
    .from(outreachEmails)
    .where(eq(outreachEmails.trackingId, trackingId))
    .get();

  if (email && !email.geopendOp) {
    db.update(outreachEmails)
      .set({
        geopendOp: new Date().toISOString(),
        status: "geopend",
      })
      .where(eq(outreachEmails.id, email.id))
      .run();
  }

  return new NextResponse(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
