import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/lib/db";
import { googleTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const GMAIL_REDIRECT_URI = `${process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000"}/api/auth/google/gmail/callback`;

// GET /api/auth/google/gmail/callback — Gmail OAuth callback
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(new URL("/administratie?gmail=error", req.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL("/administratie?gmail=error", req.url));
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      GMAIL_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(new URL("/administratie?gmail=error", req.url));
    }

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : new Date(Date.now() + 3600_000).toISOString();

    // Upsert: check if a Gmail token record already exists (calendarId = 'gmail')
    const existing = await db
      .select()
      .from(googleTokens)
      .where(eq(googleTokens.calendarId, "gmail"))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(googleTokens)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt,
          bijgewerktOp: new Date().toISOString(),
        })
        .where(eq(googleTokens.id, existing[0].id));
    } else {
      await db.insert(googleTokens).values({
        gebruikerId: 1, // Sem is the admin
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        calendarId: "gmail",
      });
    }

    return NextResponse.redirect(new URL("/administratie?gmail=connected", req.url));
  } catch {
    return NextResponse.redirect(new URL("/administratie?gmail=error", req.url));
  }
}
