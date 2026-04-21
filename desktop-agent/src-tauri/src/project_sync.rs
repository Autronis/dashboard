use crate::config::Config;
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

// Debounce: alleen pushen als de laatste push naar dezelfde repo >10 min
// geleden was. Zorgt dat parallel werkende Claude chats niet elk een
// Vercel deploy triggeren — commits accumuleren lokaal, push komt 1x
// per 10 min per repo.
const PUSH_DEBOUNCE_SECS: u64 = 600;

fn last_push_marker(dir_name: &str) -> std::path::PathBuf {
    let base = dirs::cache_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("/tmp"))
        .join("autronis-desktop-agent")
        .join("last-push");
    let _ = fs::create_dir_all(&base);
    base.join(dir_name)
}

fn seconds_since_last_push(dir_name: &str) -> Option<u64> {
    let marker = last_push_marker(dir_name);
    let content = fs::read_to_string(&marker).ok()?;
    let last: u64 = content.trim().parse().ok()?;
    let now = SystemTime::now().duration_since(UNIX_EPOCH).ok()?.as_secs();
    Some(now.saturating_sub(last))
}

fn record_push(dir_name: &str) {
    let marker = last_push_marker(dir_name);
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let _ = fs::write(&marker, now.to_string());
}

fn projects_dir() -> std::path::PathBuf {
    if cfg!(target_os = "macos") {
        dirs::home_dir()
            .map(|h| h.join("Autronis/Projects"))
            .unwrap_or_else(|| std::path::PathBuf::from("/Users/semmiegijs/Autronis/Projects"))
    } else {
        std::path::PathBuf::from(r"C:\Users\semmi\OneDrive\Claude AI\Projects")
    }
}
const SKIP_DIRS: &[&str] = &["autronis-website"];

#[derive(Debug, Serialize)]
struct AgentTask {
    titel: String,
    fase: String,
    done: bool,
    volgorde: i32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentProject {
    naam: String,
    dir: String,
    omschrijving: String,
    tech_stack: Vec<String>,
    taken: Vec<AgentTask>,
}

#[derive(Debug, Serialize)]
struct SyncPayload {
    projects: Vec<AgentProject>,
}


// Map directory names to friendly project names
fn dir_to_name(dir: &str) -> String {
    let mapping: HashMap<&str, &str> = HashMap::from([
        ("sales-engine", "Sales Engine"),
        ("investment-engine", "Investment Engine"),
        ("case-study-generator", "Case Study Generator"),
        ("learning-radar", "Learning Radar"),
        ("autronis-dashboard", "Autronis Dashboard"),
    ]);

    mapping
        .get(dir)
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            dir.replace('-', " ")
                .split_whitespace()
                .map(|w| {
                    let mut chars = w.chars();
                    match chars.next() {
                        None => String::new(),
                        Some(c) => c.to_uppercase().to_string() + &chars.collect::<String>(),
                    }
                })
                .collect::<Vec<_>>()
                .join(" ")
        })
}

fn parse_todo_md(content: &str) -> Vec<AgentTask> {
    let mut tasks = Vec::new();
    let mut current_fase = String::new();
    let mut order = 0;

    for line in content.lines() {
        // Match phase headers
        if let Some(_caps) = regex_lite::Regex::new(r"(?i)^(?:Phase|Fase)\s+\d+\s*[-–:]\s*(.+)")
            .ok()
            .and_then(|re| re.captures(line))
        {
            current_fase = line.trim().to_string();
            if current_fase.starts_with("Phase") || current_fase.starts_with("phase") {
                current_fase = current_fase.replacen("Phase", "Fase", 1).replacen("phase", "Fase", 1);
            }
            continue;
        }

        // Match ### headers as phases
        if line.starts_with("## ") || line.starts_with("### ") {
            let trimmed = line.trim_start_matches('#').trim();
            current_fase = trimmed.to_string();
            continue;
        }

        // Match task checkboxes
        if let Some(caps) = regex_lite::Regex::new(r"^\s*[-*]?\s*\[([xX ])\]\s*(.+)")
            .ok()
            .and_then(|re| re.captures(line))
        {
            let done = caps.get(1).map(|m| m.as_str()).unwrap_or(" ") != " ";
            let titel = caps.get(2).map(|m| m.as_str()).unwrap_or("").trim().to_string();

            tasks.push(AgentTask {
                titel,
                fase: current_fase.clone(),
                done,
                volgorde: order,
            });
            order += 1;
        }
    }

    tasks
}

fn parse_brief(content: &str) -> (String, String) {
    let mut naam = String::new();
    let mut omschrijving = String::new();

    for line in content.lines() {
        if naam.is_empty() {
            if let Some(title) = line.strip_prefix("# ") {
                naam = title.trim().to_string();
                continue;
            }
        }
        if !naam.is_empty() && omschrijving.is_empty() && !line.trim().is_empty() && !line.starts_with('#') {
            omschrijving = line.trim().to_string();
            break;
        }
    }

    (naam, omschrijving)
}

fn detect_tech_stack(dir: &Path) -> Vec<String> {
    let pkg_path = dir.join("package.json");
    if !pkg_path.exists() {
        return Vec::new();
    }

    let content = match fs::read_to_string(&pkg_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let pkg: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };

    let mut stack = Vec::new();
    let mut all_deps: Vec<String> = Vec::new();

    if let Some(deps) = pkg.get("dependencies").and_then(|d| d.as_object()) {
        all_deps.extend(deps.keys().cloned());
    }
    if let Some(deps) = pkg.get("devDependencies").and_then(|d| d.as_object()) {
        all_deps.extend(deps.keys().cloned());
    }

    let has = |name: &str| all_deps.iter().any(|d| d == name);

    if has("next") { stack.push("Next.js".into()); }
    if has("react") { stack.push("React".into()); }
    if has("vue") { stack.push("Vue".into()); }
    if has("typescript") || dir.join("tsconfig.json").exists() { stack.push("TypeScript".into()); }
    if has("tailwindcss") { stack.push("Tailwind CSS".into()); }
    if has("drizzle-orm") { stack.push("Drizzle ORM".into()); }
    if has("prisma") || has("@prisma/client") { stack.push("Prisma".into()); }
    if has("@supabase/supabase-js") { stack.push("Supabase".into()); }
    if has("@anthropic-ai/sdk") { stack.push("Claude API".into()); }
    if has("openai") { stack.push("OpenAI".into()); }

    stack
}

fn is_project_dir(dir: &Path) -> bool {
    // Skip git worktree checkouts: in een worktree is .git een FILE met
    // "gitdir: ..." inhoud, niet een directory. Een echt project heeft .git
    // als directory (of helemaal niet). Worktrees moeten geen losse
    // dashboard-projecten worden — dat creëert duplicaten van het hoofdproject.
    let dot_git = dir.join(".git");
    if dot_git.is_file() {
        return false;
    }
    // Skip dirs die zelf .worktrees heten (parent van worktree checkouts)
    if dir.file_name().and_then(|n| n.to_str()) == Some(".worktrees") {
        return false;
    }
    dir.join("PROJECT_BRIEF.md").exists()
        || dir.join("TODO.md").exists()
        || dir.join("package.json").exists()
}

fn git_cmd(dir: &Path, args: &[&str]) -> Option<std::process::Output> {
    let mut cmd = std::process::Command::new("git");
    cmd.args(args)
        .current_dir(dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.output().ok()
}

fn git_sync(dir: &Path, auto_push: bool) {
    if !dir.join(".git").exists() {
        return;
    }

    // Check if remote exists
    let has_remote = git_cmd(dir, &["remote", "get-url", "origin"])
        .map(|o| o.status.success())
        .unwrap_or(false);

    if !has_remote {
        return;
    }

    // Altijd pullen mag (goedkoop, ff-only, geen write-kant).
    git_cmd(dir, &["pull", "--ff-only", "--quiet"]);

    // Auto add/commit/push alleen als expliciet aan. Default false
    // omdat dit anders Vercel deploys laat queuen bij parallelle chats.
    if !auto_push {
        return;
    }

    // Check for local changes
    let has_changes = git_cmd(dir, &["status", "--porcelain"])
        .map(|o| !o.stdout.is_empty())
        .unwrap_or(false);

    if !has_changes {
        return;
    }

    // Auto commit and push
    git_cmd(dir, &["add", "-A"]);

    let dir_name = dir.file_name().unwrap_or_default().to_string_lossy();
    let msg = format!("Auto-sync: {}", dir_name);

    let committed = git_cmd(dir, &["commit", "-m", &msg, "--quiet"])
        .map(|o| o.status.success())
        .unwrap_or(false);

    if committed {
        // Debounce: skip push als we binnen PUSH_DEBOUNCE_SECS al gepusht
        // hebben. Commits blijven lokaal en worden bij de volgende push
        // mee-gepushed in één Vercel deploy.
        if let Some(elapsed) = seconds_since_last_push(&dir_name) {
            if elapsed < PUSH_DEBOUNCE_SECS {
                eprintln!(
                    "[project-sync] Committed {} but skipping push ({}s since last, debounce {}s)",
                    dir_name, elapsed, PUSH_DEBOUNCE_SECS
                );
                return;
            }
        }

        match git_cmd(dir, &["push", "--quiet"]) {
            Some(p) if p.status.success() => {
                eprintln!("[project-sync] Auto-pushed {}", dir_name);
                record_push(&dir_name);
            },
            Some(p) => {
                let stderr = String::from_utf8_lossy(&p.stderr);
                eprintln!("[project-sync] Push failed for {}: {}", dir_name, stderr.trim());
            },
            None => eprintln!("[project-sync] Push error for {}", dir_name),
        }
    }
}

fn scan_projects(auto_push: bool) -> Vec<AgentProject> {
    let projects_dir = projects_dir();
    let entries = match fs::read_dir(&projects_dir) {
        Ok(e) => e,
        Err(e) => {
            eprintln!("[project-sync] Kan projects dir niet lezen: {}", e);
            return Vec::new();
        }
    };

    let mut projects = Vec::new();

    for entry in entries.flatten() {
        let dir_name = entry.file_name().to_string_lossy().to_string();

        if SKIP_DIRS.contains(&dir_name.as_str()) {
            continue;
        }

        let path = entry.path();
        if !path.is_dir() || !is_project_dir(&path) {
            continue;
        }

        // Pull altijd; add/commit/push alleen als auto_push actief is.
        git_sync(&path, auto_push);

        let mut naam = dir_to_name(&dir_name);
        let mut omschrijving = String::new();

        // Read PROJECT_BRIEF.md
        let brief_path = path.join("PROJECT_BRIEF.md");
        if brief_path.exists() {
            if let Ok(content) = fs::read_to_string(&brief_path) {
                let (brief_naam, brief_omschrijving) = parse_brief(&content);
                if !brief_naam.is_empty() {
                    naam = brief_naam;
                }
                omschrijving = brief_omschrijving;
            }
        }

        // Parse TODO.md
        let todo_path = path.join("TODO.md");
        let taken = if todo_path.exists() {
            fs::read_to_string(&todo_path)
                .map(|content| parse_todo_md(&content))
                .unwrap_or_default()
        } else {
            Vec::new()
        };

        let tech_stack = detect_tech_stack(&path);

        projects.push(AgentProject {
            naam,
            dir: dir_name,
            omschrijving,
            tech_stack,
            taken,
        });
    }

    projects
}

pub async fn sync_projects(config: &Config) -> Result<String, String> {
    let projects = scan_projects(config.auto_push_enabled);

    if projects.is_empty() {
        return Ok("Geen projecten gevonden".into());
    }

    let project_count = projects.len();
    let payload = SyncPayload { projects };

    let client = reqwest::Client::new();
    let url = format!("{}/api/projecten/sync-from-agent", config.api_url);

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", config.api_token))
        .header("Content-Type", "application/json")
        .json(&payload)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("Project sync fout: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Project sync mislukt ({}): {}", status, body));
    }

    Ok(format!("{} projecten gesynct", project_count))
}

// ─── Reverse sync: ensure local folders exist for all dashboard projects ───

#[derive(Debug, serde::Deserialize)]
struct DashboardProject {
    #[allow(dead_code)]
    id: i64,
    naam: String,
    status: Option<String>,
    #[serde(rename = "githubUrl")]
    github_url: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
struct DashboardProjectsResponse {
    projecten: Vec<DashboardProject>,
}

/// Normalize a project name for filesystem comparison:
/// lowercase, replace spaces/slashes with dashes, strip non-alphanumeric
fn normalize_for_fs(name: &str) -> String {
    name.to_lowercase()
        .chars()
        .map(|c| match c {
            ' ' | '/' | '\\' | '_' => '-',
            c if c.is_alphanumeric() || c == '-' => c,
            _ => '-',
        })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

/// Check if a folder already exists that matches a dashboard project name
fn folder_exists_for_project(dir: &Path, project_name: &str) -> bool {
    let target = normalize_for_fs(project_name);
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                continue; // skip hidden folders like .archived-X
            }
            let normalized = normalize_for_fs(&name);
            if normalized == target {
                return true;
            }
            // Also accept substring match (both ways) for robustness
            if normalized.contains(&target) || target.contains(&normalized) {
                if normalized.len() >= 5 && target.len() >= 5 {
                    return true;
                }
            }
        }
    }
    false
}

/// Fetches all active projects from the dashboard and creates local folders
/// for any that don't exist yet. Non-destructive — never deletes or renames.
pub async fn ensure_folders_from_dashboard(config: &Config) -> Result<String, String> {
    let projects_dir = projects_dir();
    if !projects_dir.exists() {
        fs::create_dir_all(&projects_dir)
            .map_err(|e| format!("Kon projects dir niet aanmaken: {}", e))?;
    }

    let client = reqwest::Client::new();
    let url = format!("{}/api/projecten", config.api_url);

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", config.api_token))
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("Kon projecten niet ophalen: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Projecten fetch mislukt: {}", response.status()));
    }

    let data: DashboardProjectsResponse = response
        .json()
        .await
        .map_err(|e| format!("Kon JSON niet parsen: {}", e))?;

    let mut created = 0;
    let mut skipped = 0;

    for project in &data.projecten {
        // Only act on active projects
        if project.status.as_deref() == Some("afgerond") {
            continue;
        }

        if folder_exists_for_project(&projects_dir, &project.naam) {
            skipped += 1;
            continue;
        }

        // Create new folder with normalized name
        let folder_name = normalize_for_fs(&project.naam);
        let folder_path = projects_dir.join(&folder_name);

        // Als het dashboard een github_url heeft → git clone, anders mkdir + brief.
        // Clone faalt gracieus terug naar mkdir+brief zodat een ontbrekende
        // git installatie of auth issue de sync niet blokkeert.
        let cloned = if let Some(url) = &project.github_url {
            match std::process::Command::new("git")
                .arg("clone")
                .arg(url)
                .arg(&folder_path)
                .output()
            {
                Ok(out) if out.status.success() => {
                    eprintln!("[folder-sync] Cloned {} → {}", url, folder_name);
                    true
                }
                Ok(out) => {
                    let stderr = String::from_utf8_lossy(&out.stderr);
                    eprintln!(
                        "[folder-sync] git clone {} faalde: {}",
                        url,
                        stderr.trim()
                    );
                    false
                }
                Err(e) => {
                    eprintln!("[folder-sync] kan git niet vinden: {}", e);
                    false
                }
            }
        } else {
            false
        };

        if !cloned {
            if let Err(e) = fs::create_dir_all(&folder_path) {
                eprintln!("[folder-sync] Kon '{}' niet aanmaken: {}", folder_name, e);
                continue;
            }

            // Write a minimal PROJECT_BRIEF.md
            let brief_path = folder_path.join("PROJECT_BRIEF.md");
            let brief_content = format!(
                "# {}\n\n## Doel\n_Beschrijf het doel van dit project._\n\n## Status\nAutomatisch aangemaakt door de desktop agent na detectie in het dashboard.\n\n## Volgende stappen\n- [ ] Projectbeschrijving invullen\n- [ ] Initiële taken toevoegen\n",
                project.naam
            );
            let _ = fs::write(&brief_path, brief_content);
        }

        created += 1;
    }

    Ok(format!(
        "Folder sync: {} aangemaakt, {} al aanwezig",
        created, skipped
    ))
}
