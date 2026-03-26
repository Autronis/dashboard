import { NextRequest, NextResponse } from "next/server";
import { exchangeAuthCode, getAccounts } from "@/lib/revolut";
import { db } from "@/lib/db";
import { revolutVerbinding } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET /api/revolut/callback — OAuth callback from Revolut
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.redirect(new URL("/instellingen?revolut=error&reason=no_code", req.url));
    }

    // Exchange code for tokens
    const verbinding = await exchangeAuthCode(code);

    // Fetch accounts and store the main EUR account
    try {
      const accounts = await getAccounts();
      const eurAccount = accounts.find((a) => a.currency === "EUR" && a.state === "active");

      if (eurAccount) {
        await db
          .update(revolutVerbinding)
          .set({ accountId: eurAccount.id })
          .where(eq(revolutVerbinding.id, verbinding.id));
      }
    } catch {
      // Account fetch can fail, connection still valid
    }

    return NextResponse.redirect(new URL("/instellingen?revolut=success", req.url));
  } catch (error) {
    const reason = encodeURIComponent(error instanceof Error ? error.message : "unknown");
    return NextResponse.redirect(new URL(`/instellingen?revolut=error&reason=${reason}`, req.url));
  }
}
