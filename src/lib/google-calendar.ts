import { google } from "googleapis";
import { db } from "@/lib/db";
import { googleTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000"}/api/auth/google/callback`;

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
}

export function getAuthUrl(state: string) {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    state,
  });
}

export async function getTokensForUser(gebruikerId: number) {
  const [row] = await db
    .select()
    .from(googleTokens)
    .where(eq(googleTokens.gebruikerId, gebruikerId))
    .limit(1);
  return row ?? null;
}

export async function getAuthenticatedClient(gebruikerId: number) {
  const tokens = await getTokensForUser(gebruikerId);
  if (!tokens) return null;

  const client = getOAuth2Client();
  client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: new Date(tokens.expiresAt).getTime(),
  });

  // Auto-refresh if expired
  const now = Date.now();
  const expiry = new Date(tokens.expiresAt).getTime();
  if (now >= expiry - 60_000) {
    const { credentials } = await client.refreshAccessToken();
    await db
      .update(googleTokens)
      .set({
        accessToken: credentials.access_token ?? tokens.accessToken,
        expiresAt: credentials.expiry_date
          ? new Date(credentials.expiry_date).toISOString()
          : tokens.expiresAt,
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(googleTokens.gebruikerId, gebruikerId));
    client.setCredentials(credentials);
  }

  return client;
}

export async function pushEventToGoogle(
  gebruikerId: number,
  event: {
    summary: string;
    description?: string;
    start: string; // ISO date or datetime
    end?: string;
    allDay?: boolean;
  }
) {
  const client = await getAuthenticatedClient(gebruikerId);
  if (!client) return null;

  const calendar = google.calendar({ version: "v3", auth: client });
  const tokens = await getTokensForUser(gebruikerId);
  const calendarId = tokens?.calendarId ?? "primary";

  const eventBody: {
    summary: string;
    description?: string;
    start: { date?: string; dateTime?: string; timeZone?: string };
    end: { date?: string; dateTime?: string; timeZone?: string };
  } = {
    summary: event.summary,
    description: event.description,
    start: {},
    end: {},
  };

  if (event.allDay) {
    eventBody.start = { date: event.start.slice(0, 10) };
    const endDate = event.end ?? event.start;
    // Google Calendar all-day events need end = day after
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);
    eventBody.end = { date: end.toISOString().slice(0, 10) };
  } else {
    eventBody.start = { dateTime: event.start, timeZone: "Europe/Amsterdam" };
    eventBody.end = {
      dateTime: event.end ?? new Date(new Date(event.start).getTime() + 3600_000).toISOString(),
      timeZone: "Europe/Amsterdam",
    };
  }

  // Check of er al een event bestaat met dezelfde titel en starttijd
  const timeMin = event.allDay
    ? new Date(event.start.slice(0, 10)).toISOString()
    : new Date(event.start).toISOString();
  const timeMax = event.allDay
    ? new Date(new Date(event.start.slice(0, 10)).getTime() + 86400_000).toISOString()
    : new Date(new Date(event.start).getTime() + 60_000).toISOString();

  const existing = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    q: event.summary,
    singleEvents: true,
    maxResults: 5,
  });

  const duplicate = existing.data.items?.find(
    (e) => e.summary === event.summary
  );
  if (duplicate) {
    return duplicate;
  }

  const response = await calendar.events.insert({
    calendarId,
    requestBody: eventBody,
  });

  return response.data;
}

export async function updateGoogleEvent(
  gebruikerId: number,
  googleEventId: string,
  event: {
    summary: string;
    description?: string;
    start: string;
    end?: string;
    allDay?: boolean;
  }
) {
  const client = await getAuthenticatedClient(gebruikerId);
  if (!client) return null;

  const calendar = google.calendar({ version: "v3", auth: client });
  const tokens = await getTokensForUser(gebruikerId);
  const calendarId = tokens?.calendarId ?? "primary";

  const eventBody: {
    summary: string;
    description?: string;
    start: { date?: string; dateTime?: string; timeZone?: string };
    end: { date?: string; dateTime?: string; timeZone?: string };
  } = {
    summary: event.summary,
    description: event.description,
    start: {},
    end: {},
  };

  if (event.allDay) {
    eventBody.start = { date: event.start.slice(0, 10) };
    const endDate = event.end ?? event.start;
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);
    eventBody.end = { date: end.toISOString().slice(0, 10) };
  } else {
    eventBody.start = { dateTime: event.start, timeZone: "Europe/Amsterdam" };
    eventBody.end = {
      dateTime: event.end ?? new Date(new Date(event.start).getTime() + 3600_000).toISOString(),
      timeZone: "Europe/Amsterdam",
    };
  }

  const response = await calendar.events.patch({
    calendarId,
    eventId: googleEventId,
    requestBody: eventBody,
  });

  return response.data;
}

export async function deleteGoogleEvent(gebruikerId: number, googleEventId: string) {
  const client = await getAuthenticatedClient(gebruikerId);
  if (!client) return;

  const calendar = google.calendar({ version: "v3", auth: client });
  const tokens = await getTokensForUser(gebruikerId);
  const calendarId = tokens?.calendarId ?? "primary";

  await calendar.events.delete({ calendarId, eventId: googleEventId }).catch(() => {
    // Event might already be deleted
  });
}
