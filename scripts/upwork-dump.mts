/* eslint-disable no-console */
import { config } from "dotenv";
import { writeFileSync, existsSync } from "node:fs";
import { eq } from "drizzle-orm";
import { addExtra } from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const core = await import("puppeteer-core");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const puppeteer = addExtra(core.default as any);
puppeteer.use(StealthPlugin());

const chromePath = findSystemChrome();
if (!chromePath) {
  console.error("Geen Chrome gevonden. Installeer Google Chrome.");
  process.exit(1);
}

const cdpUrl = process.env.CDP_URL;
const headless = process.env.HEADFUL !== "1" && process.env.HEADFUL !== "true";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let browser: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let page: any;
let usedCdp = false;

if (cdpUrl) {
  console.log(`Mode: CDP-connect (${cdpUrl}) — hergebruikt jouw Chrome session`);
  browser = await puppeteer.connect({ browserURL: cdpUrl });
  page = await browser.newPage();
  usedCdp = true;
} else {
  console.log(`Mode: ${headless ? "headless" : "HEADFUL (zichtbare Chrome)"}`);
  browser = await puppeteer.launch({
    headless,
    executablePath: chromePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  });
  page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  );
  await page.setViewport({ width: 1440, height: 900 });
  await page.setCookie(...cookies);
}

console.log(`Navigeer naar ${url} ...`);
const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
console.log(`HTTP ${resp?.status()}  final URL: ${page.url()}`);

// Poll voor Cloudflare challenge — wacht max 25s tot title wijzigt van "Just a moment"
for (let i = 0; i < 25; i++) {
  const t: string = await page.title();
  if (!t.toLowerCase().includes("just a moment")) {
    if (i > 0) console.log(`CF challenge opgelost na ${i}s`);
    break;
  }
  if (i === 0) console.log("Cloudflare challenge actief, wachten...");
  await new Promise((r) => setTimeout(r, 1000));
}

await page.waitForSelector("h1, body", { timeout: 10_000 }).catch(() => {});
// Extra wait for hydration
await new Promise((r) => setTimeout(r, 3000));

const html: string = await page.content();
writeFileSync("/tmp/upwork-dump.html", html);
console.log(`HTML dump: /tmp/upwork-dump.html  (${html.length} bytes)`);

await page.screenshot({ path: "/tmp/upwork-dump.png", fullPage: true }).catch(() => {});
console.log("Screenshot: /tmp/upwork-dump.png");

// Use string-eval to bypass esbuild __name helper injection
const attrs = (await page.evaluate(`
  (function(){
    function extract(attr){
      var s = new Set();
      document.querySelectorAll('[' + attr + ']').forEach(function(el){
        var v = el.getAttribute(attr);
        if (v) s.add(v);
      });
      return Array.from(s).sort();
    }
    function getText(sel){
      var el = document.querySelector(sel);
      return el && el.textContent ? el.textContent.trim() : '';
    }
    return {
      dataTest: extract('data-test'),
      dataQa: extract('data-qa'),
      dataCy: extract('data-cy'),
      ariaLabel: extract('aria-label').slice(0, 30),
      h1: Array.from(document.querySelectorAll('h1')).map(function(e){return (e.textContent||'').trim()}).filter(Boolean),
      h2: Array.from(document.querySelectorAll('h2')).map(function(e){return (e.textContent||'').trim()}).filter(Boolean).slice(0, 20),
      title: document.title,
      url: location.href,
      hasLoginWall: !!document.querySelector("form[action*='login']") ||
        !!document.querySelector("[data-test='login-form']") ||
        document.title.toLowerCase().indexOf('log in') !== -1,
      isCloudflare: document.title.indexOf('Just a moment') !== -1 ||
        !!document.querySelector('[data-translate*="cf-"]') ||
        !!document.querySelector('#challenge-running')
    };
  })()
`)) as {
  dataTest: string[];
  dataQa: string[];
  dataCy: string[];
  ariaLabel: string[];
  h1: string[];
  h2: string[];
  title: string;
  url: string;
  hasLoginWall: boolean;
  isCloudflare: boolean;
};

console.log(`\n=== Title === ${attrs.title}`);
console.log(`=== Final URL === ${attrs.url}`);
console.log(`Login-wall: ${attrs.hasLoginWall} | Cloudflare: ${attrs.isCloudflare}`);

console.log("\n=== H1 ===");
attrs.h1.forEach((h) => console.log(`  ${h}`));

console.log("\n=== H2 ===");
attrs.h2.forEach((h) => console.log(`  ${h}`));

console.log(`\n=== data-test (${attrs.dataTest.length}) ===`);
attrs.dataTest.forEach((v) => console.log(`  ${v}`));

console.log(`\n=== data-qa (${attrs.dataQa.length}) ===`);
attrs.dataQa.forEach((v) => console.log(`  ${v}`));

console.log(`\n=== data-cy (${attrs.dataCy.length}) ===`);
attrs.dataCy.forEach((v) => console.log(`  ${v}`));

// Bij CDP-connect: page closen maar NIET de browser (dat is Sem's normale Chrome)
if (usedCdp) {
  await page.close().catch(() => {});
  browser.disconnect();
} else {
  await browser.close();
}
process.exit(0);
