import { describe, it, expect, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

// Local shadow of agendaItems sufficient for test cleanup.
const agendaItems = sqliteTable("agenda_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  titel: text("titel").notNull(),
});

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(async () => ({ id: 1, naam: "sem", email: "sem@autronis.com" })),
  requireAuthOrApiKey: vi.fn(async () => ({ id: 1, naam: "sem" })),
}));

vi.mock("@/lib/google-calendar", () => ({
  pushEventToGoogle: vi.fn(async () => null),
}));

// Mock @/lib/db — build a fresh in-memory sqlite with the agenda_items schema
// the POST/GET handlers expect. Mirror the fields used by the route.
vi.mock("@/lib/db", async () => {
  const BetterSqlite3 = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");

  const sqlite = new BetterSqlite3(":memory:");
  sqlite.exec(`
    CREATE TABLE gebruikers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      naam TEXT NOT NULL,
      email TEXT
    );
    INSERT INTO gebruikers (id, naam, email) VALUES (1, 'sem', 'sem@autronis.com');
    CREATE TABLE agenda_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gebruiker_id INTEGER,
      titel TEXT NOT NULL,
      omschrijving TEXT,
      type TEXT DEFAULT 'afspraak',
      start_datum TEXT NOT NULL,
      eind_datum TEXT,
      hele_dag INTEGER DEFAULT 0,
      herinnering_minuten INTEGER,
      herinnering_verstuurd_op TEXT,
      google_event_id TEXT,
      eigenaar TEXT NOT NULL DEFAULT 'vrij',
      gemaakt_door TEXT NOT NULL DEFAULT 'user',
      aangemaakt_op TEXT DEFAULT (datetime('now'))
    );
  `);

  const db = drizzle(sqlite);
  (globalThis as Record<string, unknown>).__testAgendaDb = db;
  return { db };
});

import { POST } from "../route";
import { agendaItems as schemaAgendaItems } from "@/lib/db/schema";

function getTestDb() {
  return (globalThis as Record<string, unknown>).__testAgendaDb as ReturnType<
    typeof import("drizzle-orm/better-sqlite3").drizzle
  >;
}

async function callPost(body: Record<string, unknown>) {
  const req = new Request("http://localhost/api/agenda", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  // Cast to NextRequest for the handler signature — runtime only uses json().
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return POST(req as any);
}

describe("POST /api/agenda", () => {
  afterEach(async () => {
    await getTestDb().delete(agendaItems).where(eq(agendaItems.titel, "TEST_POST_EIGENAAR"));
  });

  it("defaults eigenaar=vrij and gemaaktDoor=user when omitted", async () => {
    const res = await callPost({
      titel: "TEST_POST_EIGENAAR",
      startDatum: "2026-05-01T09:00:00",
    });
    expect(res.status).toBe(201);
    const json = (await res.json()) as { item: { eigenaar: string; gemaaktDoor: string } };
    expect(json.item.eigenaar).toBe("vrij");
    expect(json.item.gemaaktDoor).toBe("user");
  });

  it("accepts eigenaar=sem + gemaaktDoor=bridge", async () => {
    const res = await callPost({
      titel: "TEST_POST_EIGENAAR",
      startDatum: "2026-05-01T09:00:00",
      eigenaar: "sem",
      gemaaktDoor: "bridge",
    });
    expect(res.status).toBe(201);
    const json = (await res.json()) as { item: { eigenaar: string; gemaaktDoor: string } };
    expect(json.item.eigenaar).toBe("sem");
    expect(json.item.gemaaktDoor).toBe("bridge");
  });

  it("rejects invalid eigenaar with 400", async () => {
    const res = await callPost({
      titel: "TEST_POST_EIGENAAR",
      startDatum: "2026-05-01T09:00:00",
      eigenaar: "foo",
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { fout: string };
    expect(json.fout).toMatch(/eigenaar/i);
  });

  it("rejects invalid gemaaktDoor with 400", async () => {
    const res = await callPost({
      titel: "TEST_POST_EIGENAAR",
      startDatum: "2026-05-01T09:00:00",
      gemaaktDoor: "random",
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { fout: string };
    expect(json.fout).toMatch(/gemaaktDoor/i);
  });

  // Silence unused import warning — schemaAgendaItems is imported to ensure
  // the route's compile-time module resolution still works.
  void schemaAgendaItems;
});
