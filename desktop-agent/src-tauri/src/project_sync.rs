use crate::config::Config;
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

const PROJECTS_DIR: &str = r"C:\Users\semmi\OneDrive\Claude AI\Projects";
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
    dir.join("PROJECT_BRIEF.md").exists()
        || dir.join("TODO.md").exists()
        || dir.join("package.json").exists()
}

fn git_sync(dir: &Path) {
    if !dir.join(".git").exists() {
        return;
    }

    // Check if remote exists
    let has_remote = std::process::Command::new("git")
        .args(["remote", "get-url", "origin"])
        .current_dir(dir)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if !has_remote {
        return;
    }

    // Pull latest
    let _ = std::process::Command::new("git")
        .args(["pull", "--ff-only", "--quiet"])
        .current_dir(dir)
        .output();

    // Check for local changes
    let status = std::process::Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(dir)
        .output();

    let has_changes = match &status {
        Ok(o) => !o.stdout.is_empty(),
        Err(_) => false,
    };

    if !has_changes {
        return;
    }

    // Auto commit and push
    let _ = std::process::Command::new("git")
        .args(["add", "-A"])
        .current_dir(dir)
        .output();

    let dir_name = dir.file_name().unwrap_or_default().to_string_lossy();
    let msg = format!("Auto-sync: {}", dir_name);
    let commit = std::process::Command::new("git")
        .args(["commit", "-m", &msg, "--quiet"])
        .current_dir(dir)
        .output();

    if let Ok(o) = commit {
        if o.status.success() {
            let push = std::process::Command::new("git")
                .args(["push", "--quiet"])
                .current_dir(dir)
                .output();
            match push {
                Ok(p) if p.status.success() => {
                    eprintln!("[project-sync] Auto-pushed {}", dir_name);
                },
                Ok(p) => {
                    let stderr = String::from_utf8_lossy(&p.stderr);
                    eprintln!("[project-sync] Push failed for {}: {}", dir_name, stderr.trim());
                },
                Err(e) => eprintln!("[project-sync] Push error for {}: {}", dir_name, e),
            }
        }
    }
}

fn scan_projects() -> Vec<AgentProject> {
    let projects_dir = PathBuf::from(PROJECTS_DIR);
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

        // Auto-sync with GitHub (pull + push)
        git_sync(&path);

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
    let projects = scan_projects();

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
