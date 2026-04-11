import { NextResponse } from "next/server";
import { google } from "googleapis";
import { requireAuth } from "@/lib/auth";

const GMAIL_REDIRECT_URI = `${process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000"}/api/auth/google/gmail/callback`;
const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

// GET /api/auth/google/gmail — start Gmail OAuth flow
export async function GET() {
  try {
    await requireAuth();

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      GMAIL_REDIRECT_URI
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: GMAIL_SCOPES,
      prompt: "consent",
    });

    return NextResponse.redirect(authUrl);
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 401 }
    );
  }
}
