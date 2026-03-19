import { NextRequest, NextResponse } from "next/server";
import { getOAuth2Client } from "@/lib/google-calendar";
import { db } from "@/lib/db";
import { googleTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET /api/auth/google/callback — OAuth callback
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(new URL("/agenda?google=error", req.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL("/agenda?google=error", req.url));
    }

    const gebruikerId = parseInt(state, 10);
    if (isNaN(gebruikerId)) {
      return NextResponse.redirect(new URL("/agenda?google=error", req.url));
    }

    const client = getOAuth2Client();
    const { tokens } = await client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(new URL("/agenda?google=error", req.url));
    }

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : new Date(Date.now() + 3600_000).toISOString();

    // Upsert tokens
    const existing = await db
      .select()
      .from(googleTokens)
      .where(eq(googleTokens.gebruikerId, gebruikerId))
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
        .where(eq(googleTokens.gebruikerId, gebruikerId));
    } else {
      await db.insert(googleTokens).values({
        gebruikerId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
      });
    }

    return NextResponse.redirect(new URL("/agenda?google=connected", req.url));
  } catch {
    return NextResponse.redirect(new URL("/agenda?google=error", req.url));
  }
}
