use serde::Deserialize;
use std::process::Command;
use warp::Filter;

const PROJECTS_DIR: &str = r"C:\Users\semmi\OneDrive\Claude AI\Projects";
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
            let project_dir = format!("{}\\{}", PROJECTS_DIR, body.project);
            let path = std::path::Path::new(&project_dir);

            if !path.exists() || !path.is_dir() {
                eprintln!("[http] Project dir niet gevonden: {}", project_dir);
                return warp::reply::with_status(
                    warp::reply::json(&serde_json::json!({ "fout": "Project map niet gevonden" })),
                    warp::http::StatusCode::NOT_FOUND,
                );
            }

            // Open VS Code in project dir
            match Command::new("cmd")
                .args(["/C", "code", &project_dir])
                .spawn()
            {
                Ok(_) => eprintln!("[http] VS Code geopend: {}", project_dir),
                Err(e) => eprintln!("[http] VS Code openen mislukt: {}", e),
            }

            // Open Claude Code in project dir
            match Command::new("cmd")
                .args([
                    "/C",
                    "claude",
                    "--resume",
                ])
                .current_dir(&project_dir)
                .spawn()
            {
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
