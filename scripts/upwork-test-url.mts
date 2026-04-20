/* eslint-disable no-console */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.argv[2];
const accountArg = process.argv[3];

if (!url || !url.startsWith("https://www.upwork.com/")) {
  console.error("Usage: npm run upwork:test-url -- <full-upwork-url> [sem|syb]");
  console.error("Voorbeeld: npm run upwork:test-url -- https://www.upwork.com/jobs/~01abcd...");
  process.exit(1);
}

const account = accountArg === "syb" ? "syb" : "sem";

const { db } = await import("../src/lib/db");
const { deepFetchJob } = await import("../src/lib/upwork/deep-fetch");

console.log(`Testing deep-fetch als [${account}] op:\n  ${url}\n`);

const result = await deepFetchJob(db, account, url);

if (!result.ok) {
  console.error(`✗ ${result.reason}`);
  console.error(`  ${result.message}`);
  process.exit(1);
}

const d = result.data;
console.log("✓ Gelukt\n");
console.log(`Beschrijving        : ${d.beschrijving.length} chars`);
console.log(`  preview: ${d.beschrijving.slice(0, 200)}${d.beschrijving.length > 200 ? "..." : ""}`);
console.log(`Budget type         : ${d.budgetType ?? "-"}`);
console.log(`Budget min/max      : ${d.budgetMin ?? "-"} / ${d.budgetMax ?? "-"}`);
console.log(`Experience level    : ${d.experienceLevel ?? "-"}`);
console.log(`Duration            : ${d.durationEstimate ?? "-"}`);
console.log(`Country             : ${d.country ?? "-"}`);
console.log(`Client naam         : ${d.clientNaam ?? "-"}`);
console.log(`Client verified     : ${d.clientVerified ?? "-"}`);
console.log(`Client rating       : ${d.clientRating ?? "-"}`);
console.log(`Client reviews      : ${d.clientReviews ?? "-"}`);
console.log(`Client spent        : ${d.clientSpent ?? "-"}`);
console.log(`Client hire rate    : ${d.clientHireRate ?? "-"}`);
console.log(`Categories (${d.categoryLabels?.length ?? 0}) : ${d.categoryLabels?.join(", ") ?? "-"}`);
console.log(`Screening Qs (${d.screeningQs?.length ?? 0}):`);
(d.screeningQs ?? []).forEach((q, i) => console.log(`  ${i + 1}. ${q}`));
console.log(`Proposals range     : ${d.proposalsRangeMin ?? "-"} - ${d.proposalsRangeMax ?? "-"}`);

process.exit(0);
