use serde::Deserialize;
use std::process::Command;
use warp::Filter;

fn projects_dir() -> String {
    if cfg!(target_os = "macos") {
        dirs::home_dir()
            .map(|h| h.join("Autronis/Projects").to_string_lossy().to_string())
            .unwrap_or_else(|| "/Users/semmiegijs/Autronis/Projects".to_string())
    } else {
        r"C:\Users\semmi\OneDrive\Claude AI\Projects".to_string()
    }
}
const PORT: u16 = 3847;

#[derive(Deserialize)]
struct OpenProjectRequest {
    project: String,
}

pub async fn start_server() {
    let cors = warp::cors()
        .allow_any_origin()
        .allow_methods(vec!["POST", "OPTIONS"])
        .allow_headers(vec!["Content-Type"]);

    let open_project = warp::path("open-project")
        .and(warp::post())
        .and(warp::body::json())
        .map(|body: OpenProjectRequest| {
            let base = projects_dir();
            let sep = if cfg!(target_os = "windows") { "\\" } else { "/" };
            let project_dir = format!("{}{}{}", base, sep, body.project);
            let path = std::path::Path::new(&project_dir);

            if !path.exists() || !path.is_dir() {
                eprintln!("[http] Project dir niet gevonden: {}", project_dir);
                return warp::reply::with_status(
                    warp::reply::json(&serde_json::json!({ "fout": "Project map niet gevonden" })),
                    warp::http::StatusCode::NOT_FOUND,
                );
            }

            // Open VS Code in project dir
            #[cfg(target_os = "windows")]
            let vscode_result = Command::new("cmd")
                .args(["/C", "code", &project_dir])
                .spawn();

            #[cfg(not(target_os = "windows"))]
            let vscode_result = Command::new("code")
                .arg(&project_dir)
                .spawn();

            match vscode_result {
                Ok(_) => eprintln!("[http] VS Code geopend: {}", project_dir),
                Err(e) => eprintln!("[http] VS Code openen mislukt: {}", e),
            }

            // Open Claude Code in project dir
            #[cfg(target_os = "windows")]
            let claude_result = Command::new("cmd")
                .args(["/C", "claude", "--resume"])
                .current_dir(&project_dir)
                .spawn();

            #[cfg(not(target_os = "windows"))]
            let claude_result = Command::new("claude")
                .arg("--resume")
                .current_dir(&project_dir)
                .spawn();

            match claude_result {
                Ok(_) => eprintln!("[http] Claude geopend in: {}", project_dir),
                Err(e) => eprintln!("[http] Claude openen mislukt: {}", e),
            }

            warp::reply::with_status(
                warp::reply::json(&serde_json::json!({
                    "succes": true,
                    "project": body.project,
                    "dir": project_dir
                })),
                warp::http::StatusCode::OK,
            )
        })
        .with(cors);

    // Health check
    let health = warp::path("health")
        .and(warp::get())
        .map(|| warp::reply::json(&serde_json::json!({ "status": "ok" })));

    let routes = open_project.or(health);

    eprintln!("[http] Server gestart op port {}", PORT);
    warp::serve(routes).run(([127, 0, 0, 1], PORT)).await;
}
