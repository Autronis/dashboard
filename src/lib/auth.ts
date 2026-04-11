import { createHash } from "crypto";
import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";

// ============ SESSION CONFIG ============

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET environment variable is required (min 32 chars)");
}

export const sessionOptions: SessionOptions = {
  cookieName: "autronis-session",
  password: SESSION_SECRET,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
  },
};

// ============ SESSION INTERFACES ============

export interface SessionGebruiker {
  id: number;
  naam: string;
  email: string;
  rol: "admin" | "gebruiker";
  themaVoorkeur: "donker" | "licht" | null;
}

export interface SessionData {
  gebruiker?: SessionGebruiker;
}

// ============ SESSION HELPERS ============

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function requireAuth(): Promise<SessionGebruiker> {
  const session = await getSession();
  if (!session.gebruiker) {
    throw new Error("Niet geauthenticeerd");
  }
  return session.gebruiker;
}

// ============ API KEY AUTH ============

export async function requireApiKey(req: NextRequest): Promise<number> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("API key vereist");
  }

  const token = authHeader.slice(7);

  // Accept dedicated internal API key or SESSION_SECRET (for desktop agent / Claude sync)
  const internalKey = process.env.INTERNAL_API_KEY;
  if (internalKey && token === internalKey) {
    return 1; // Sem's user ID
  }
  if (token === SESSION_SECRET) {
    return 1; // Sem's user ID — fallback for desktop agent
  }

  const hash = createHash("sha256").update(token).digest("hex");

  const key = await db
    .select({ aangemaaktDoor: apiKeys.aangemaaktDoor })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hash), eq(apiKeys.isActief, 1)))
    .get();

  if (!key || !key.aangemaaktDoor) {
    throw new Error("Ongeldige API key");
  }

  await db.update(apiKeys)
    .set({ laatstGebruiktOp: new Date().toISOString() })
    .where(eq(apiKeys.keyHash, hash))
    .run();

  return key.aangemaaktDoor;
}

// ============ HYBRID AUTH (session OR api key) ============

export async function requireAuthOrApiKey(req: NextRequest): Promise<SessionGebruiker> {
  // Try session auth first
  try {
    return await requireAuth();
  } catch {
    // Fall back to API key auth
    const gebruikerId = await requireApiKey(req);
    return { id: gebruikerId, naam: gebruikerId === 1 ? "Sem Gijsberts" : "Syb", email: "", rol: "admin", themaVoorkeur: null };
  }
}

// ============ RATE LIMITER ============

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}
