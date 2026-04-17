#!/usr/bin/env node
// Auto-sync van Syb's lead-dashboard-v2 (https://github.com/Autronis/lead-dashboard-v2)
// naar deze repo. Detecteert nieuwe commits en past automatisch toe:
//
//   1. Migrations changed → src/types/supabase-leads.ts regenereren
//      (vereist SUPABASE_ACCESS_TOKEN of een ingelogde supabase CLI)
//
//   2. Edge functions changed → ALLOWED_FUNCTIONS whitelist patchen in
//      src/app/api/leads/edge-function/[name]/route.ts
//
//   3. Iets veranderd dat niet auto-fixbaar is → dashboard-taak aanmaken
//      (cluster: backend-infra) zodat Sem of Claude 'm in een sessie ziet
//
// Loopt in twee contexten:
//   - Lokaal:  `node scripts/sync-syb-leads.mjs [--dry-run] [--force]`
//   - GitHub Action: zie .github/workflows/sync-syb-leads.yml
//
// State zit in .syb-sync-state.json (committed) — bevat de laatste verwerkte SHA.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const SYB_OWNER = "Autronis";
const SYB_REPO = "lead-dashboard-v2";
const SUPABASE_PROJECT_ID = "hurzsuwaccglzoblqkxd";

const STATE_FILE = resolve(REPO_ROOT, ".syb-sync-state.json");
const TYPES_FILE = resolve(REPO_ROOT, "src/types/supabase-leads.ts");
const ROUTE_FILE = resolve(
  REPO_ROOT,
  "src/app/api/leads/edge-function/[name]/route.ts"
);

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const VERBOSE = process.argv.includes("--verbose") || process.env.RUNNER_DEBUG === "1";

function log(...args) {
  console.log(...args);
}

function debug(...args) {
  if (VERBOSE) console.log("  ›", ...args);
}

function gh(args) {
  return execSync(`gh ${args}`, { encoding: "utf8" }).trim();
}

function ghJson(args) {
  return JSON.parse(gh(args));
}

function loadState() {
  if (!existsSync(STATE_FILE)) {
    return { lastSha: null, lastSyncAt: null, lastSyncSummary: null };
  }
  return JSON.parse(readFileSync(STATE_FILE, "utf8"));
}

function saveState(state) {
  if (DRY_RUN) {
    debug("would write state", state);
    return;
  }
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
}

function getHeadSha() {
  return gh(`api repos/${SYB_OWNER}/${SYB_REPO}/commits/main --jq .sha`);
}

function getCommitInfo(sha) {
  const c = ghJson(`api repos/${SYB_OWNER}/${SYB_REPO}/commits/${sha}`);
  return {
    sha: c.sha,
    message: c.commit.message.split("\n")[0],
    author: c.commit.author.name,
    date: c.commit.author.date,
    url: c.html_url,
  };
}

function getChangedFiles(fromSha, toSha) {
  // Returns up to 300 changed files between two SHAs.
  const cmp = ghJson(
    `api repos/${SYB_OWNER}/${SYB_REPO}/compare/${fromSha}...${toSha}`
  );
  return (cmp.files || []).map((f) => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
  }));
}

function categorize(files) {
  const buckets = {
    migrations: [],
    functions: new Set(),
    other: [],
  };
  for (const f of files) {
    if (f.filename.startsWith("supabase/migrations/")) {
      buckets.migrations.push(f);
    } else if (f.filename.startsWith("supabase/functions/")) {
      const m = f.filename.match(/^supabase\/functions\/([^/]+)\//);
      if (m) buckets.functions.add(m[1]);
    } else {
      buckets.other.push(f);
    }
  }
  return {
    migrations: buckets.migrations,
    functions: [...buckets.functions].sort(),
    other: buckets.other,
  };
}

// ── 1. Types regen ────────────────────────────────────────────────

function regenerateTypes() {
  log("🔄 Regenerating Supabase types...");
  if (DRY_RUN) {
    debug("would run: npx supabase gen types typescript");
    return { changed: false, error: null };
  }

  if (!process.env.SUPABASE_ACCESS_TOKEN) {
    log("  ✗ SUPABASE_ACCESS_TOKEN ontbreekt — kan types niet regenereren");
    log("    Maak er een aan op https://supabase.com/dashboard/account/tokens");
    log("    en zet 'm in .env.local en GitHub Secrets.");
    return { changed: false, error: "SUPABASE_ACCESS_TOKEN missing" };
  }

  let output;
  try {
    output = execSync(
      `npx --yes supabase@latest gen types typescript --project-id ${SUPABASE_PROJECT_ID} --schema public`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
  } catch (e) {
    const stderr = e.stderr?.toString() || "";
    // Filter npm warnings; pick the first non-warning line
    const realError = stderr
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("npm warn") && !l.startsWith("npm notice"))
      .join("\n")
      .trim() || e.message;
    log(`  ✗ Type regen faalde: ${realError.split("\n")[0]}`);
    return { changed: false, error: realError };
  }

  if (!output.includes("export type Database")) {
    return { changed: false, error: "Unexpected output (no Database export)" };
  }

  // Wrap in a header so devs know not to hand-edit it.
  const header = `// Auto-generated by scripts/sync-syb-leads.mjs from project ${SUPABASE_PROJECT_ID}.
// DO NOT EDIT MANUALLY — your changes will be overwritten on next sync.
// Source of truth: https://github.com/${SYB_OWNER}/${SYB_REPO}
`;

  // Read current to compare meaningfully
  const current = existsSync(TYPES_FILE) ? readFileSync(TYPES_FILE, "utf8") : "";
  // Strip headers from both for comparison so a header-only diff doesn't count
  const stripHeader = (s) => s.replace(/^\/\/.*\n/gm, "").trim();
  if (stripHeader(current) === stripHeader(output)) {
    log("  ✓ Types al up-to-date");
    return { changed: false, error: null };
  }

  writeFileSync(TYPES_FILE, header + "\n" + output);
  log(`  ✓ Wrote ${TYPES_FILE.replace(REPO_ROOT + "/", "")}`);
  return { changed: true, error: null };
}

// ── 2. Whitelist patcher ──────────────────────────────────────────

function readAllowedFunctions() {
  const content = readFileSync(ROUTE_FILE, "utf8");
  const m = content.match(/const ALLOWED_FUNCTIONS = new Set\(\[([\s\S]*?)\]\);/);
  if (!m) throw new Error("Kan ALLOWED_FUNCTIONS niet vinden in route.ts");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

function writeAllowedFunctions(functions) {
  const content = readFileSync(ROUTE_FILE, "utf8");
  const lines = functions.map((f) => `  "${f}",`).join("\n");
  const newBlock = `const ALLOWED_FUNCTIONS = new Set([\n${lines}\n]);`;
  const updated = content.replace(
    /const ALLOWED_FUNCTIONS = new Set\(\[[\s\S]*?\]\);/,
    newBlock
  );
  if (DRY_RUN) {
    debug("would update whitelist with", functions.length, "functions");
    return;
  }
  writeFileSync(ROUTE_FILE, updated);
}

// Functions die alleen extern worden aangeroepen (email links, n8n webhooks)
// en NIET via onze dashboard proxy horen te lopen. Deze worden nooit aan de
// ALLOWED_FUNCTIONS whitelist toegevoegd, zelfs als ze in Syb's repo staan.
const EXCLUDED_FUNCTIONS = new Set([
  "unsubscribe",
]);

function getCurrentSybFunctions() {
  const contents = ghJson(
    `api repos/${SYB_OWNER}/${SYB_REPO}/contents/supabase/functions`
  );
  return contents
    .filter((c) => c.type === "dir" && !c.name.startsWith("_") && !EXCLUDED_FUNCTIONS.has(c.name))
    .map((c) => c.name)
    .sort();
}

function syncWhitelist() {
  log("🔄 Syncing edge function whitelist...");
  const current = readAllowedFunctions();
  const fresh = getCurrentSybFunctions();
  const added = fresh.filter((f) => !current.includes(f));
  const removed = current.filter((f) => !fresh.includes(f));

  if (added.length === 0 && removed.length === 0) {
    log("  ✓ Whitelist al in sync");
    return { changed: false, added: [], removed: [] };
  }

  writeAllowedFunctions(fresh);
  log(`  ✓ Whitelist updated: +${added.length} -${removed.length}`);
  if (added.length) log(`    Added:   ${added.join(", ")}`);
  if (removed.length) log(`    Removed: ${removed.join(", ")}`);
  return { changed: true, added, removed };
}

// ── 3. Dashboard task aanmaken ────────────────────────────────────

async function createDashboardTask({ commits, changes, typesChanged, whitelistChange }) {
  const apiKey = process.env.DASHBOARD_API_KEY;
  const dashboardUrl =
    process.env.DASHBOARD_URL || "https://dashboard.autronis.nl";
  if (!apiKey) {
    log("  ⚠ DASHBOARD_API_KEY niet gezet — taak wordt niet aangemaakt");
    return;
  }

  const lines = [];
  lines.push(`Syb pushte ${commits.length} commit(s) naar lead-dashboard-v2:`);
  for (const c of commits.slice(0, 5)) {
    lines.push(`- [${c.sha.slice(0, 7)}] ${c.message} (${c.author})`);
  }
  if (commits.length > 5) lines.push(`- ... +${commits.length - 5} meer`);
  lines.push("");

  if (changes.migrations.length > 0) {
    lines.push(`### Migrations gewijzigd (${changes.migrations.length})`);
    for (const m of changes.migrations.slice(0, 8)) {
      lines.push(`- \`${m.filename.replace("supabase/migrations/", "")}\` (${m.status})`);
    }
    lines.push("");
    if (typesChanged) {
      lines.push("✓ \`src/types/supabase-leads.ts\` is automatisch geregenereerd.");
    } else {
      lines.push("⚠️ Types regen liep niet door — handmatig checken.");
    }
    lines.push("");
  }

  if (whitelistChange.changed) {
    lines.push("### Edge functions gewijzigd");
    if (whitelistChange.added.length) {
      lines.push(`Nieuw: ${whitelistChange.added.map((f) => `\`${f}\``).join(", ")}`);
    }
    if (whitelistChange.removed.length) {
      lines.push(
        `Verwijderd: ${whitelistChange.removed.map((f) => `\`${f}\``).join(", ")}`
      );
    }
    lines.push("");
    lines.push("✓ Whitelist in `src/app/api/leads/edge-function/[name]/route.ts` is automatisch bijgewerkt.");
    lines.push("");
  }

  if (changes.other.length > 0 && changes.migrations.length === 0 && !whitelistChange.changed) {
    lines.push(`(${changes.other.length} bestand(en) gewijzigd buiten supabase/ — geen actie nodig)`);
    lines.push("");
  }

  lines.push("**Wat moet ik doen?**");
  if (changes.migrations.length > 0 || whitelistChange.added.length > 0) {
    lines.push(
      "Check of de nieuwe schema kolommen of edge functions ergens in de UI gesurfaced moeten worden."
    );
    lines.push(
      "- Nieuwe DB kolommen → mogelijk filter/kolom toevoegen aan `/leads` of `/leads/rebuild-prep`"
    );
    lines.push(
      "- Nieuwe edge functions → check of er een proxy-call vanuit een feature gemaakt moet worden"
    );
  } else {
    lines.push("Niks denk ik — types & whitelist zijn auto-gesynct, geen UI werk nodig.");
  }
  lines.push("");
  lines.push(`Vergelijking: https://github.com/${SYB_OWNER}/${SYB_REPO}/compare/${commits[commits.length - 1].sha}^...${commits[0].sha}`);

  const titel = `Syb pushed lead-dashboard-v2: ${commits[0].message.slice(0, 60)}`;
  const body = {
    projectNaam: "Lead Dashboard v2",
    voltooide_taken: [],
    nieuwe_taken: [
      {
        titel,
        fase: "Onderhoud",
        cluster: "backend-infra",
        prioriteit: "normaal",
        omschrijving: lines.join("\n"),
        geschatteDuur: 30,
      },
    ],
  };

  if (DRY_RUN) {
    debug("would POST task:", JSON.stringify(body, null, 2));
    return;
  }

  const res = await fetch(`${dashboardUrl}/api/projecten/sync-taken`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    log(`  ⚠ Task creation faalde: HTTP ${res.status} ${text.slice(0, 200)}`);
    return;
  }
  log(`  ✓ Dashboard taak aangemaakt`);

  // Push notificatie naar Sem (user id 1) zodat hij 't meteen ziet
  await sendPushNotification(apiKey, dashboardUrl, titel, commits);
}

async function sendPushNotification(apiKey, dashboardUrl, titel, commits) {
  const bericht = commits.length === 1
    ? commits[0].message
    : `${commits.length} commits — ${commits[0].message}`;

  try {
    const res = await fetch(`${dashboardUrl}/api/push/test`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        titel: `🔄 ${titel}`,
        bericht,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      log(`  ✓ Push notificatie verstuurd (${data.verzonden} devices)`);
    } else {
      log(`  ⚠ Push notificatie faalde: HTTP ${res.status}`);
    }
  } catch (e) {
    log(`  ⚠ Push notificatie faalde: ${e.message}`);
  }
}

// ── 4. Git commit & push ──────────────────────────────────────────

function gitStatus() {
  return execSync("git status --porcelain", { encoding: "utf8", cwd: REPO_ROOT }).trim();
}

function commitAndPush(summary) {
  const status = gitStatus();
  if (!status) {
    log("  ✓ Geen wijzigingen om te committen");
    return false;
  }
  if (DRY_RUN) {
    debug("would commit:", status);
    return true;
  }
  // Stage alleen de files die we mogen aanraken
  execSync(
    `git add ${TYPES_FILE.replace(REPO_ROOT + "/", "")} ${ROUTE_FILE.replace(REPO_ROOT + "/", "")} ${STATE_FILE.replace(REPO_ROOT + "/", "")}`,
    { cwd: REPO_ROOT, stdio: "inherit" }
  );
  // Niks gestaged? Skip
  const staged = execSync("git diff --cached --name-only", { encoding: "utf8", cwd: REPO_ROOT }).trim();
  if (!staged) {
    log("  ✓ Niks gestaged");
    return false;
  }
  const message = `chore(sync): auto-sync van Syb's lead-dashboard-v2\n\n${summary}`;
  execSync(`git commit -m ${JSON.stringify(message)}`, { cwd: REPO_ROOT, stdio: "inherit" });
  if (process.env.SKIP_PUSH !== "1") {
    execSync("git push", { cwd: REPO_ROOT, stdio: "inherit" });
  }
  return true;
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  log(`📡 Sync vanaf ${SYB_OWNER}/${SYB_REPO}${DRY_RUN ? " (dry-run)" : ""}`);

  const state = loadState();
  const headSha = getHeadSha();
  log(`  Huidige HEAD: ${headSha.slice(0, 7)}`);
  log(`  Laatst gezien: ${state.lastSha ? state.lastSha.slice(0, 7) : "(geen — eerste run)"}`);

  if (state.lastSha === headSha && !FORCE) {
    log("✓ Niks nieuws.");
    return;
  }

  // Eerste run? Sla SHA op zonder iets te syncen — anders krijgen we 100+ commits
  // teruggediffd waarin we niks zinnigs van weten.
  if (!state.lastSha && !FORCE) {
    log("⚠ Eerste run — alleen SHA opslaan, nog geen sync.");
    log("   Run met --force om alsnog een initiële sync te doen.");
    saveState({
      lastSha: headSha,
      lastSyncAt: new Date().toISOString(),
      lastSyncSummary: "Initiele baseline, geen sync uitgevoerd",
    });
    return;
  }

  // Diff bepalen
  const fromSha = state.lastSha || headSha;
  const files = state.lastSha ? getChangedFiles(fromSha, headSha) : [];
  const changes = categorize(files);

  log(
    `📊 ${files.length} bestand(en) gewijzigd: ${changes.migrations.length} migrations, ${changes.functions.length} functions, ${changes.other.length} overig`
  );

  // Acties
  let typesResult = { changed: false, error: null };
  if (changes.migrations.length > 0 || FORCE) {
    typesResult = regenerateTypes();
  }

  let whitelistResult = { changed: false, added: [], removed: [] };
  if (changes.functions.length > 0 || FORCE) {
    whitelistResult = syncWhitelist();
  }

  // Commits ophalen voor context in de taak
  let commits = [];
  if (state.lastSha) {
    try {
      const cmp = ghJson(
        `api repos/${SYB_OWNER}/${SYB_REPO}/compare/${fromSha}...${headSha}`
      );
      commits = (cmp.commits || []).map((c) => ({
        sha: c.sha,
        message: c.commit.message.split("\n")[0],
        author: c.commit.author.name,
      }));
    } catch (e) {
      debug("kon commits niet ophalen:", e.message);
    }
  }
  if (commits.length === 0) {
    commits = [getCommitInfo(headSha)];
  }

  // Altijd taak + push notificatie bij elke nieuwe Syb push
  const somethingChanged =
    typesResult.changed ||
    whitelistResult.changed ||
    changes.migrations.length > 0 ||
    changes.functions.length > 0;

  await createDashboardTask({
    commits,
    changes,
    typesChanged: typesResult.changed,
    whitelistChange: whitelistResult,
  });

  // State bijwerken
  const summary = [
    typesResult.changed && "types regen",
    whitelistResult.changed &&
      `whitelist ±${whitelistResult.added.length}/${whitelistResult.removed.length}`,
    !somethingChanged && "geen file changes",
  ]
    .filter(Boolean)
    .join(", ");

  saveState({
    lastSha: headSha,
    lastSyncAt: new Date().toISOString(),
    lastSyncSummary: summary || "no-op",
  });

  // Git commit & push
  if (somethingChanged && !DRY_RUN) {
    commitAndPush(summary);
  }

  log(`✓ Sync klaar (${summary || "no-op"})`);
}

main().catch((e) => {
  console.error("✗ Sync faalde:", e.message);
  if (VERBOSE) console.error(e.stack);
  process.exit(1);
});
