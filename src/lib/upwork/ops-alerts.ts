import { and, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

const WEBHOOK_URL = process.env.UPWORK_ALERTS_WEBHOOK_URL;

export async function sendAlert(text: string): Promise<void> {
  if (!WEBHOOK_URL) {
    console.error(`[upwork/ops] alert (geen webhook): ${text}`);
    return;
  }
  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text, channel: "alerts", text }),
    });
  } catch (err) {
    console.error("[upwork/ops] alert POST mislukt:", err);
  }
}

export async function alertSessionExpired(account: "sem" | "syb"): Promise<void> {
  await sendAlert(
    `Upwork sessie voor ${account} verlopen. Run: npm run upwork:login -- ${account}`,
  );
}

export async function checkParseErrorBurst(): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.upworkEmailRaw)
    .where(
      and(
        isNotNull(schema.upworkEmailRaw.parseError),
        gte(schema.upworkEmailRaw.receivedAt, oneHourAgo),
      ),
    );
  const count = rows[0]?.n ?? 0;
  if (count > 5) {
    await sendAlert(
      `Upwork email parser: ${count} parse errors in laatste uur. Check upwork_email_raw.parse_error kolom.`,
    );
  }
}
