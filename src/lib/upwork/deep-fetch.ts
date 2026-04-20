import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "../db/schema";
import { decryptCookies } from "./cookie-crypto";
import type {
  UpworkAccount,
  DeepFetchResult,
  DeepFetchData,
  BudgetType,
  ExperienceLevel,
} from "./types";

type DB = BetterSQLite3Database<typeof schema> | LibSQLDatabase<typeof schema>;

type StoredCookie = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
  url?: string;
};

type PuppeteerLauncher = {
  launch: (opts?: Record<string, unknown>) => Promise<{
    newPage: () => Promise<unknown>;
    close: () => Promise<void>;
  }>;
};

async function findSystemChrome(): Promise<string | null> {
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
  return null;
}

// Lazy, environment-aware puppeteer loader — mirrors vendor/scope-generator/generate-pdf.js.
async function getPuppeteer(): Promise<PuppeteerLauncher> {
  const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION);

  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const core = await import("puppeteer-core");
    const executablePath = await chromium.executablePath();
    return {
      launch: (opts = {}) =>
        core.default.launch({
          args: chromium.args,
          executablePath,
          headless: true,
          ...opts,
        }) as unknown as ReturnType<PuppeteerLauncher["launch"]>,
    };
  }

  // Local: prefer optional full `puppeteer` (bundled Chromium), else fall back
  // to system Chrome via puppeteer-core.
  try {
    const full = await import("puppeteer");
    return {
      launch: (opts = {}) =>
        full.default.launch({ headless: true, ...opts }) as unknown as ReturnType<
          PuppeteerLauncher["launch"]
        >,
    };
  } catch {
    const systemChrome = await findSystemChrome();
    if (!systemChrome) {
      throw new Error(
        "No Chrome/Chromium available. Install Chrome, or `npm i puppeteer` for a bundled binary.",
      );
    }
    const core = await import("puppeteer-core");
    return {
      launch: (opts = {}) =>
        core.default.launch({
          headless: true,
          executablePath: systemChrome,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
          ...opts,
        }) as unknown as ReturnType<PuppeteerLauncher["launch"]>,
    };
  }
}

async function markSessionExpired(db: DB, account: UpworkAccount): Promise<void> {
  const now = new Date().toISOString();
  await db
    .update(schema.upworkSessions)
    .set({ expired: 1, bijgewerktOp: now })
    .where(eq(schema.upworkSessions.account, account));
}

async function loadCookies(
  db: DB,
  account: UpworkAccount,
): Promise<{ ok: true; cookies: StoredCookie[] } | { ok: false; message: string }> {
  const rows = await db
    .select()
    .from(schema.upworkSessions)
    .where(eq(schema.upworkSessions.account, account))
    .limit(1);

  if (rows.length === 0) {
    return {
      ok: false,
      message: `No stored session for ${account}. Run \`npm run upwork:login -- ${account}\`.`,
    };
  }
  if (rows[0].expired === 1) {
    return {
      ok: false,
      message: `${account} session marked expired. Run \`npm run upwork:login -- ${account}\`.`,
    };
  }

  try {
    const plain = decryptCookies(rows[0].cookiesEncrypted);
    const parsed: unknown = JSON.parse(plain);
    if (!Array.isArray(parsed)) {
      return { ok: false, message: "Stored cookies are not an array" };
    }
    return { ok: true, cookies: parsed as StoredCookie[] };
  } catch (err) {
    return {
      ok: false,
      message: `Cookie decrypt failed for ${account}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// Normalize puppeteer cookies so setCookie doesn't choke on edge fields.
function sanitizeCookies(cookies: StoredCookie[]): StoredCookie[] {
  return cookies.map((c) => {
    const out: StoredCookie = { name: c.name, value: c.value };
    if (c.domain) out.domain = c.domain;
    if (c.path) out.path = c.path;
    if (typeof c.expires === "number" && c.expires > 0) out.expires = c.expires;
    if (typeof c.httpOnly === "boolean") out.httpOnly = c.httpOnly;
    if (typeof c.secure === "boolean") out.secure = c.secure;
    if (c.sameSite === "Strict" || c.sameSite === "Lax" || c.sameSite === "None") {
      out.sameSite = c.sameSite;
    }
    return out;
  });
}

export async function deepFetchJob(
  db: DB,
  account: UpworkAccount,
  jobUrl: string,
): Promise<DeepFetchResult> {
  const cookiesResult = await loadCookies(db, account);
  if (!cookiesResult.ok) {
    return { ok: false, reason: "session_expired", message: cookiesResult.message };
  }

  let puppeteer: PuppeteerLauncher;
  try {
    puppeteer = await getPuppeteer();
  } catch (err) {
    return {
      ok: false,
      reason: "session_expired",
      message: `Browser unavailable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  type PageLike = {
    setUserAgent: (ua: string) => Promise<void>;
    setCookie: (...cookies: StoredCookie[]) => Promise<void>;
    goto: (url: string, opts?: Record<string, unknown>) => Promise<{ status(): number } | null>;
    url: () => string;
    waitForSelector: (sel: string, opts?: Record<string, unknown>) => Promise<unknown>;
    evaluate: <T>(fn: () => T) => Promise<T>;
    content: () => Promise<string>;
    close: () => Promise<void>;
  };

  const browser = await puppeteer.launch();
  try {
    const page = (await browser.newPage()) as PageLike;
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    );
    await page.setCookie(...sanitizeCookies(cookiesResult.cookies));

    const response = await page.goto(jobUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    if (!response) {
      return { ok: false, reason: "parse_error", message: "No response from Upwork" };
    }

    const status = response.status();
    if (status === 404) {
      return { ok: false, reason: "not_found", message: "Job no longer available" };
    }
    if (status === 429) {
      return { ok: false, reason: "rate_limited", message: "Upwork rate-limited the request" };
    }

    const finalUrl = page.url();
    if (finalUrl.includes("/login") || finalUrl.includes("/account-security")) {
      await markSessionExpired(db, account);
      return {
        ok: false,
        reason: "session_expired",
        message: `${account} redirected to login — cookies expired`,
      };
    }

    // Wait briefly for main content; ignore timeout.
    await page.waitForSelector("h1, [data-test='job-title']", { timeout: 6_000 }).catch(() => {});

    const html = await page.content();
    const fromHtml = extractJobData(html);

    // Supplement with live DOM queries — more reliable for hydrated Upwork pages.
    const live = await page
      .evaluate((): {
        beschrijving: string;
        categories: string[];
        screeningQs: string[];
        country: string;
        clientNaam: string;
        clientVerified: boolean;
        clientReviews: number | null;
        clientRating: number | null;
        clientSpent: number | null;
        clientHireRate: number | null;
        budgetRaw: string;
        durationEstimate: string;
        experienceRaw: string;
        proposalsRaw: string;
      } => {
        const getText = (selectors: string[]): string => {
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.textContent) {
              const t = el.textContent.replace(/\s+/g, " ").trim();
              if (t) return t;
            }
          }
          return "";
        };
        const getAll = (selectors: string[]): string[] => {
          for (const sel of selectors) {
            const els = Array.from(document.querySelectorAll(sel));
            if (els.length > 0) {
              return els
                .map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim())
                .filter((s) => s.length > 0);
            }
          }
          return [];
        };

        const beschrijving = getText([
          "[data-test='job-description'] .air3-truncation-wrapper",
          "[data-test='job-description']",
          "[data-qa='job-description']",
          "section[aria-labelledby*='description'] p",
          ".break.words",
        ]);

        const screeningQs = getAll([
          "[data-test='additional-questions'] li",
          "[data-qa='screening-questions'] li",
          "section[aria-labelledby*='questions'] li",
        ]);

        const categories = getAll([
          "[data-test='attr-item'] .air3-badge",
          "[data-test='features-list'] li .air3-badge",
          "[data-qa='skill-label']",
        ]);

        const country = getText([
          "[data-qa='client-location'] strong",
          "[data-test='client-location']",
        ]);

        const clientNaam = getText([
          "[data-test='client-name']",
          "[data-qa='company-name']",
        ]);

        const clientVerified = !!document.querySelector(
          "[data-qa='client-payment-verified']",
        );

        const ratingText = getText([
          "[data-test='rating-value']",
          "[data-qa='rating-number']",
          ".air3-rating-value-text",
        ]);
        const clientRating = ratingText ? Number(ratingText.replace(",", ".")) : NaN;

        const reviewsText = getText([
          "[data-test='reviews-count']",
          "[data-qa='reviews-count']",
        ]);
        const reviewsMatch = reviewsText.match(/(\d+)/);
        const clientReviews = reviewsMatch ? Number(reviewsMatch[1]) : null;

        const spentText = getText([
          "[data-qa='client-spend'] strong",
          "[data-test='client-spend']",
        ]);
        const spentMatch = spentText.match(/\$?([\d.,]+)\s*([KMkm])?/);
        let clientSpent: number | null = null;
        if (spentMatch) {
          const base = Number(spentMatch[1].replace(/,/g, ""));
          const mult = spentMatch[2] ? { K: 1000, k: 1000, M: 1_000_000, m: 1_000_000 }[spentMatch[2]] : 1;
          if (Number.isFinite(base) && mult) clientSpent = base * mult;
        }

        const hireText = getText([
          "[data-qa='client-hire-rate'] strong",
          "[data-test='client-hire-rate']",
        ]);
        const hireMatch = hireText.match(/(\d+)\s*%/);
        const clientHireRate = hireMatch ? Number(hireMatch[1]) : null;

        const budgetRaw = getText([
          "[data-test='budget-amount']",
          "[data-qa='budget']",
          "li[data-cy='budget']",
          "[data-test='is-fixed-price'] strong",
          "[data-test='hourly-rate'] strong",
        ]);

        const durationEstimate = getText([
          "[data-test='duration'] strong",
          "[data-qa='duration']",
        ]);

        const experienceRaw = getText([
          "[data-test='contractor-tier'] strong",
          "[data-qa='experience-level']",
        ]);

        const proposalsRaw = getText([
          "[data-qa='client-job-posting-stats-proposals']",
          "[data-test='proposals']",
        ]);

        return {
          beschrijving,
          categories,
          screeningQs,
          country,
          clientNaam,
          clientVerified,
          clientReviews,
          clientRating: Number.isFinite(clientRating) ? clientRating : null,
          clientSpent,
          clientHireRate,
          budgetRaw,
          durationEstimate,
          experienceRaw,
          proposalsRaw,
        };
      })
      .catch(() => null);

    const data: DeepFetchData = { ...fromHtml };
    if (live) {
      if (live.beschrijving && live.beschrijving.length > (data.beschrijving ?? "").length) {
        data.beschrijving = live.beschrijving;
      }
      if (live.screeningQs.length) data.screeningQs = live.screeningQs;
      if (live.categories.length) data.categoryLabels = live.categories;
      if (live.country) data.country = live.country;
      if (live.clientNaam) data.clientNaam = live.clientNaam;
      if (live.clientVerified) data.clientVerified = true;
      if (live.clientReviews !== null) data.clientReviews = live.clientReviews;
      if (live.clientRating !== null) data.clientRating = live.clientRating;
      if (live.clientSpent !== null) data.clientSpent = live.clientSpent;
      if (live.clientHireRate !== null) data.clientHireRate = live.clientHireRate;
      if (live.durationEstimate) data.durationEstimate = live.durationEstimate;

      const exp = parseExperienceLevel(live.experienceRaw);
      if (exp) data.experienceLevel = exp;

      const budget = parseBudget(live.budgetRaw);
      if (budget.type) {
        data.budgetType = budget.type;
        if (budget.min !== undefined) data.budgetMin = budget.min;
        if (budget.max !== undefined) data.budgetMax = budget.max;
      }

      const proposals = parseProposalsRange(live.proposalsRaw);
      if (proposals.min !== undefined) data.proposalsRangeMin = proposals.min;
      if (proposals.max !== undefined) data.proposalsRangeMax = proposals.max;
    }

    // Treat empty result as parse_error so the caller can mark ingest_partial
    // rather than pretending we scraped something.
    if (!data.beschrijving || data.beschrijving.length < 20) {
      return {
        ok: false,
        reason: "parse_error",
        message: "Could not extract job description — selectors may need update",
      };
    }

    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      reason: "parse_error",
      message: `Deep-fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

function parseExperienceLevel(raw: string): ExperienceLevel | undefined {
  const s = raw.toLowerCase();
  if (!s) return undefined;
  if (s.includes("entry")) return "entry";
  if (s.includes("intermediate")) return "intermediate";
  if (s.includes("expert")) return "expert";
  return undefined;
}

// "$50-$100", "$15.00 Fixed-price", "$25.00-$50.00 per hour"
function parseBudget(raw: string): { type?: BudgetType; min?: number; max?: number } {
  if (!raw) return {};
  const low = raw.toLowerCase();
  const type: BudgetType | undefined = low.includes("hour")
    ? "hourly"
    : low.includes("fixed")
      ? "fixed"
      : undefined;

  const nums = Array.from(raw.matchAll(/\$?\s*(\d+(?:[.,]\d+)?)/g))
    .map((m) => Number(m[1].replace(",", ".")))
    .filter((n) => Number.isFinite(n));

  if (nums.length === 0) return { type };
  const min = nums[0];
  const max = nums.length > 1 ? nums[nums.length - 1] : undefined;
  return { type, min, max };
}

// "Less than 5", "5 to 10", "20 to 50"
function parseProposalsRange(raw: string): { min?: number; max?: number } {
  if (!raw) return {};
  const less = raw.match(/less than\s+(\d+)/i);
  if (less) return { min: 0, max: Number(less[1]) };
  const range = raw.match(/(\d+)\s*(?:to|-|–)\s*(\d+)/i);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const single = raw.match(/(\d+)\+?/);
  if (single) return { min: Number(single[1]) };
  return {};
}

// Fallback extractor — works on raw HTML without a headless browser.
// Used for tests, and as a first pass before live DOM queries supplement it.
export function extractJobData(html: string): DeepFetchData {
  const data: DeepFetchData = { beschrijving: "" };

  const nextData = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextData) {
    try {
      const parsed = JSON.parse(nextData[1]) as unknown;
      const pageProps = (parsed as { props?: { pageProps?: unknown } })?.props?.pageProps;
      const desc = (pageProps as { job?: { description?: unknown } })?.job?.description;
      if (typeof desc === "string" && desc.length > 0) {
        data.beschrijving = desc;
      }
    } catch {
      // fall through
    }
  }

  if (!data.beschrijving) {
    const og = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/);
    if (og) data.beschrijving = decodeHtmlEntities(og[1]);
  }

  if (!data.beschrijving) {
    const meta = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/);
    if (meta) data.beschrijving = decodeHtmlEntities(meta[1]);
  }

  return data;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
