/* eslint-disable no-console */
import { config } from "dotenv";
import { writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.argv[2];
if (!url) {
  console.error("Usage: npm run upwork:dump -- <full-upwork-url> [sem|syb]");
  process.exit(1);
}
const account = (process.argv[3] === "syb" ? "syb" : "sem") as "sem" | "syb";

const { db } = await import("../src/lib/db");
const schema = await import("../src/lib/db/schema");
const { decryptCookies } = await import("../src/lib/upwork/cookie-crypto");

const rows = await db
  .select()
  .from(schema.upworkSessions)
  .where(eq(schema.upworkSessions.account, account))
  .limit(1);

if (rows.length === 0) {
  console.error(`Geen cookies voor ${account}`);
  process.exit(1);
}

const cookies = JSON.parse(decryptCookies(rows[0].cookiesEncrypted)) as Array<Record<string, unknown>>;
console.log(`${cookies.length} cookies geladen voor ${account}`);

function findSystemChrome(): string | null {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

let puppeteer: typeof import("puppeteer-core");
let chromePath: string | null = null;
try {
  // Prefer full puppeteer if installed
  puppeteer = (await import("puppeteer")) as unknown as typeof import("puppeteer-core");
} catch {
  puppeteer = await import("puppeteer-core");
  chromePath = findSystemChrome();
  if (!chromePath) {
    console.error("Geen Chrome gevonden");
    process.exit(1);
  }
}

const launchOpts: Record<string, unknown> = {
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
};
if (chromePath) launchOpts.executablePath = chromePath;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const browser = await (puppeteer as any).default.launch(launchOpts);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const page: any = await browser.newPage();

await page.setUserAgent(
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
);
await page.setCookie(...cookies);

console.log(`Navigeer naar ${url} ...`);
const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
console.log(`HTTP ${resp?.status()}  final URL: ${page.url()}`);

await page.waitForSelector("h1, body", { timeout: 10_000 }).catch(() => {});
// Extra wait for hydration
await new Promise((r) => setTimeout(r, 3000));

const html: string = await page.content();
writeFileSync("/tmp/upwork-dump.html", html);
console.log(`HTML dump: /tmp/upwork-dump.html  (${html.length} bytes)`);

await page.screenshot({ path: "/tmp/upwork-dump.png", fullPage: true }).catch(() => {});
console.log("Screenshot: /tmp/upwork-dump.png");

// Dump alle data-test + data-qa attributen + h1/h2 text
const attrs: {
  dataTest: string[];
  dataQa: string[];
  dataCy: string[];
  h1: string[];
  h2: string[];
  title: string;
  hasLoginWall: boolean;
} = await page.evaluate(() => {
  const extract = (attr: string): string[] => {
    const set = new Set<string>();
    document.querySelectorAll(`[${attr}]`).forEach((el) => {
      const v = el.getAttribute(attr);
      if (v) set.add(v);
    });
    return Array.from(set).sort();
  };
  return {
    dataTest: extract("data-test"),
    dataQa: extract("data-qa"),
    dataCy: extract("data-cy"),
    h1: Array.from(document.querySelectorAll("h1")).map((e) => (e.textContent ?? "").trim()).filter(Boolean),
    h2: Array.from(document.querySelectorAll("h2")).map((e) => (e.textContent ?? "").trim()).filter(Boolean),
    title: document.title,
    hasLoginWall: !!document.querySelector("form[action*='login']") ||
      !!document.querySelector("[data-test='login-form']") ||
      document.title.toLowerCase().includes("log in"),
  };
});

console.log("\n=== Title ===");
console.log(attrs.title);
console.log(`Login-wall detected: ${attrs.hasLoginWall}`);

console.log("\n=== H1 ===");
attrs.h1.forEach((h) => console.log(`  ${h}`));

console.log("\n=== H2 ===");
attrs.h2.slice(0, 20).forEach((h) => console.log(`  ${h}`));

console.log(`\n=== data-test (${attrs.dataTest.length}) ===`);
attrs.dataTest.forEach((v) => console.log(`  ${v}`));

console.log(`\n=== data-qa (${attrs.dataQa.length}) ===`);
attrs.dataQa.forEach((v) => console.log(`  ${v}`));

console.log(`\n=== data-cy (${attrs.dataCy.length}) ===`);
attrs.dataCy.forEach((v) => console.log(`  ${v}`));

await browser.close();
process.exit(0);
