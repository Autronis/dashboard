/* eslint-disable no-console */
import "dotenv/config";
import puppeteer from "puppeteer-core";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { encryptCookies } from "../src/lib/upwork/cookie-crypto";

async function findChrome(): Promise<string> {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];
  const { existsSync } = await import("node:fs");
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error("Geen Chrome gevonden. Installeer Chrome of pas scripts/upwork-login.ts aan.");
}

async function run() {
  const account = process.argv[2] as "sem" | "syb" | undefined;
  if (account !== "sem" && account !== "syb") {
    console.error("Usage: npm run upwork:login -- sem | syb");
    process.exit(1);
  }

  const { db } = await import("../src/lib/db");

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: await findChrome(),
    defaultViewport: null,
    args: ["--start-maximized"],
  });

  const page = await browser.newPage();
  await page.goto("https://www.upwork.com/ab/account-security/login");

  console.log(`\n=== Log in als ${account} in het geopende Chrome-venster ===`);
  console.log("Wacht tot je de Upwork dashboard ziet, dan ga je terug naar deze terminal en druk ENTER.\n");

  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
  });

  const cookies = await page.cookies("https://www.upwork.com");
  if (cookies.length === 0) {
    console.error("Geen cookies gevonden — niet ingelogd?");
    await browser.close();
    process.exit(1);
  }

  const encrypted = encryptCookies(JSON.stringify(cookies));
  const now = new Date().toISOString();

  const existing = await db
    .select()
    .from(schema.upworkSessions)
    .where(eq(schema.upworkSessions.account, account));

  if (existing.length > 0) {
    await db
      .update(schema.upworkSessions)
      .set({ cookiesEncrypted: encrypted, lastVerifiedAt: now, expired: 0, bijgewerktOp: now })
      .where(eq(schema.upworkSessions.account, account));
  } else {
    await db.insert(schema.upworkSessions).values({
      account,
      cookiesEncrypted: encrypted,
      lastVerifiedAt: now,
      expired: 0,
    });
  }

  console.log(`Cookies opgeslagen voor ${account}. (${cookies.length} cookies)`);
  await browser.close();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
