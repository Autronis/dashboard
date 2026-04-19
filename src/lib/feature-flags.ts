import { db } from "./db";
import { featureFlags } from "./db/schema";
import { eq } from "drizzle-orm";

// Simple in-memory cache — flags rarely change, 60s TTL.
const cache = new Map<string, { at: number; value: boolean }>();
const TTL_MS = 60_000;

function key(naam: string, gebruikerId?: number) {
  return `${naam}:${gebruikerId ?? "all"}`;
}

export function clearFeatureFlagCache() {
  cache.clear();
}

export async function isFeatureEnabled(naam: string, gebruikerId?: number): Promise<boolean> {
  const k = key(naam, gebruikerId);
  const cached = cache.get(k);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const rows = await db.select().from(featureFlags).where(eq(featureFlags.naam, naam)).limit(1);
  const row = rows[0];
  let enabled = false;
  if (row && row.actief === 1) {
    if (row.alleenVoorGebruikerId == null) enabled = true;
    else enabled = row.alleenVoorGebruikerId === gebruikerId;
  }
  cache.set(k, { at: Date.now(), value: enabled });
  return enabled;
}
