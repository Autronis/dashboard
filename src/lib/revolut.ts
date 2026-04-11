import { db } from "@/lib/db";
import { revolutVerbinding } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import * as crypto from "crypto";

const REVOLUT_BASE_URL = process.env.REVOLUT_SANDBOX === "true"
  ? "https://sandbox-b2b.revolut.com/api/1.0"
  : "https://b2b.revolut.com/api/1.0";

const REVOLUT_BASE_URL_V2 = process.env.REVOLUT_SANDBOX === "true"
  ? "https://sandbox-b2b.revolut.com/api/2.0"
  : "https://b2b.revolut.com/api/2.0";

function getClientId(): string {
  const id = process.env.REVOLUT_CLIENT_ID;
  if (!id) throw new Error("REVOLUT_CLIENT_ID niet geconfigureerd");
  return id;
}

function getPrivateKey(): string {
  const key = process.env.REVOLUT_PRIVATE_KEY;
  if (!key) throw new Error("REVOLUT_PRIVATE_KEY niet geconfigureerd");
  // Support both inline (with \n) and file-based keys
  return key.replace(/\\n/g, "\n");
}

function createClientAssertion(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: process.env.REVOLUT_ISSUER_DOMAIN || "autronis.nl",
    sub: getClientId(),
    aud: "https://revolut.com",
    iat: now,
    exp: now + 120,
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signingInput = `${headerB64}.${payloadB64}`;

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signingInput);
  const signature = sign.sign(getPrivateKey(), "base64url");

  return `${signingInput}.${signature}`;
}

// Get active connection from DB
async function getVerbinding() {
  const [verbinding] = await db
    .select()
    .from(revolutVerbinding)
    .where(eq(revolutVerbinding.isActief, 1))
    .orderBy(desc(revolutVerbinding.aangemaaktOp))
    .limit(1);
  return verbinding ?? null;
}

// Get a valid access token, refreshing if needed
export async function getAccessToken(): Promise<string> {
  const verbinding = await getVerbinding();
  if (!verbinding?.refreshToken) {
    throw new Error("Revolut niet gekoppeld. Ga naar Instellingen > Bank koppeling.");
  }

  // Check if access token is still valid (with 5 min buffer)
  if (verbinding.accessToken && verbinding.tokenVerlooptOp) {
    const verloopt = new Date(verbinding.tokenVerlooptOp);
    if (verloopt.getTime() > Date.now() + 5 * 60 * 1000) {
      return verbinding.accessToken;
    }
  }

  // Refresh the token
  const res = await fetch(`${REVOLUT_BASE_URL}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: verbinding.refreshToken,
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: createClientAssertion(),
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Revolut token refresh mislukt: ${error}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  const verlooptOp = new Date(Date.now() + data.expires_in * 1000).toISOString();

  await db
    .update(revolutVerbinding)
    .set({
      accessToken: data.access_token,
      tokenVerlooptOp: verlooptOp,
      bijgewerktOp: new Date().toISOString(),
    })
    .where(eq(revolutVerbinding.id, verbinding.id));

  return data.access_token;
}

// Exchange authorization code for tokens (initial setup)
export async function exchangeAuthCode(code: string) {
  const res = await fetch(`${REVOLUT_BASE_URL}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: createClientAssertion(),
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Revolut auth mislukt: ${error}`);
  }

  const data = await res.json() as {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
  };

  // Deactivate any existing connections
  await db.update(revolutVerbinding).set({ isActief: 0 });

  const verlooptOp = new Date(Date.now() + data.expires_in * 1000).toISOString();

  // Store new connection
  const [verbinding] = await db
    .insert(revolutVerbinding)
    .values({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenVerlooptOp: verlooptOp,
      isActief: 1,
    })
    .returning();

  return verbinding;
}

// API helper
async function revolutFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const url = path.startsWith("/api/2.0")
    ? `${REVOLUT_BASE_URL_V2}${path.replace("/api/2.0", "")}`
    : `${REVOLUT_BASE_URL}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Revolut API error ${res.status}: ${error}`);
  }

  return res.json() as Promise<T>;
}

// === API Methods ===

export interface RevolutAccount {
  id: string;
  name: string;
  balance: number;
  currency: string;
  state: string;
  public: boolean;
  created_at: string;
  updated_at: string;
}

export interface RevolutTransactionLeg {
  leg_id: string;
  account_id: string;
  counterparty?: {
    id?: string;
    account_type?: string;
    account_id?: string;
  };
  amount: number;
  fee?: number;
  currency: string;
  description: string;
  balance?: number;
}

export interface RevolutTransaction {
  id: string;
  type: string;
  state: string;
  request_id?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  reference?: string;
  legs: RevolutTransactionLeg[];
  merchant?: {
    name: string;
    city?: string;
    category_code?: string;
    country?: string;
  };
}

export async function getAccounts(): Promise<RevolutAccount[]> {
  return revolutFetch<RevolutAccount[]>("/accounts");
}

export async function getTransactions(options?: {
  from?: string;
  to?: string;
  count?: number;
  type?: string;
}): Promise<RevolutTransaction[]> {
  const params = new URLSearchParams();
  if (options?.from) params.set("from", options.from);
  if (options?.to) params.set("to", options.to);
  if (options?.count) params.set("count", String(options.count));
  if (options?.type) params.set("type", options.type);

  const query = params.toString();
  return revolutFetch<RevolutTransaction[]>(`/transactions${query ? `?${query}` : ""}`);
}

export async function getTransaction(id: string): Promise<RevolutTransaction> {
  return revolutFetch<RevolutTransaction>(`/transaction/${id}`);
}

// Webhook verification
export function verifyWebhookSignature(
  payload: string,
  timestamp: string,
  signature: string,
  signingSecret: string
): boolean {
  const signedPayload = `v1.${timestamp}.${payload}`;
  const expected = crypto
    .createHmac("sha256", signingSecret)
    .update(signedPayload)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(`v1=${expected}`));
}

// Get connection status
export async function getVerbindingStatus() {
  const verbinding = await getVerbinding();
  if (!verbinding) {
    return { gekoppeld: false as const };
  }

  return {
    gekoppeld: true as const,
    laatsteSyncOp: verbinding.laatsteSyncOp,
    accountId: verbinding.accountId,
    aangemaaktOp: verbinding.aangemaaktOp,
  };
}

// Build authorization URL
export function getAuthUrl(): string {
  const clientId = getClientId();
  const redirectUri = process.env.REVOLUT_REDIRECT_URI || `${process.env.NEXT_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL}/api/revolut/callback`;
  const baseAuth = process.env.REVOLUT_SANDBOX === "true"
    ? "https://sandbox-business.revolut.com/app-confirm"
    : "https://business.revolut.com/app-confirm";

  return `${baseAuth}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=READ`;
}
