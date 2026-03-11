import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

// ============ SESSION CONFIG ============

const SESSION_SECRET =
  process.env.SESSION_SECRET ?? "autronis-dashboard-2026-geheim-minimaal-32-tekens!!";

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
