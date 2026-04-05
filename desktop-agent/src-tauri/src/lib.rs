mod config;
mod http_server;
mod project_sync;
mod storage;
mod sync;
mod tracker;

use config::Config;
use storage::Storage;
use std::sync::{Arc, Mutex};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    AppHandle, Manager, RunEvent, WebviewUrl,
};

struct AppState {
    config: Mutex<Config>,
    storage: Mutex<Storage>,
    tracking: Mutex<bool>,
    nextjs_process: Mutex<Option<tokio::process::Child>>,
}

// ============ TAURI COMMANDS ============

#[tauri::command]
fn get_config(state: tauri::State<Arc<AppState>>) -> Config {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
fn save_config(state: tauri::State<Arc<AppState>>, config: Config) {
    config.save();
    *state.config.lock().unwrap() = config;
}

#[tauri::command]
fn get_status(state: tauri::State<Arc<AppState>>) -> serde_json::Value {
    let tracking = *state.tracking.lock().unwrap();
    let storage = state.storage.lock().unwrap();
    let (total_secs, top_app) = storage.today_stats().unwrap_or((0, "-".to_string()));
    let unsynced = storage.get_unsynced().map(|r| r.len()).unwrap_or(0);

    serde_json::json!({
        "tracking": tracking,
        "todaySeconds": total_secs,
        "topApp": top_app,
        "unsyncedCount": unsynced,
    })
}

#[tauri::command]
fn toggle_tracking(state: tauri::State<Arc<AppState>>) -> bool {
    let mut tracking = state.tracking.lock().unwrap();
    *tracking = !*tracking;
    let new_state = *tracking;
    let mut config = state.config.lock().unwrap();
    config.tracking_enabled = new_state;
    config.save();
    new_state
}

#[tauri::command]
fn exclude_current_app(state: tauri::State<Arc<AppState>>) -> Option<String> {
    if let Some(info) = tracker::get_active_window() {
        let mut config = state.config.lock().unwrap();
        if !config.is_excluded(&info.app) {
            config.excluded_apps.push(info.app.clone());
            config.save();
        }
        Some(info.app)
    } else {
        None
    }
}

// ============ NEXT.JS SERVER MANAGEMENT ============

async fn is_port_available(port: u16) -> bool {
    match reqwest::Client::new()
        .get(format!("http://localhost:{}", port))
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await
    {
        Ok(_) => true,
        Err(_) => false,
    }
}

async fn start_nextjs(dashboard_dir: &str) -> Option<tokio::process::Child> {
    eprintln!("[nextjs] Starting dev server in: {}", dashboard_dir);

    #[cfg(target_os = "windows")]
    let child = tokio::process::Command::new("cmd")
        .args(["/C", "npm", "run", "dev"])
        .current_dir(dashboard_dir)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .stdin(std::process::Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .ok()?;

    #[cfg(not(target_os = "windows"))]
    let child = tokio::process::Command::new("npm")
        .args(["run", "dev"])
        .current_dir(dashboard_dir)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .stdin(std::process::Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .ok()?;

    // Wait for server to be ready (max 60 seconds)
    for i in 0..60 {
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        if is_port_available(3000).await {
            eprintln!("[nextjs] Server ready after {}s", i + 1);
            return Some(child);
        }
    }

    eprintln!("[nextjs] Server did not start within 60s");
    Some(child)
}

async fn ensure_nextjs_running(state: &Arc<AppState>) {
    if is_port_available(3000).await {
        eprintln!("[nextjs] Server already running on port 3000");
        return;
    }

    let dashboard_dir = {
        state.config.lock().unwrap().dashboard_dir.clone()
    };

    if let Some(child) = start_nextjs(&dashboard_dir).await {
        *state.nextjs_process.lock().unwrap() = Some(child);
    }
}

// ============ DASHBOARD WINDOW ============

fn open_dashboard(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("dashboard") {
        window.show().ok();
        window.set_focus().ok();
        return;
    }

    let url = WebviewUrl::External("http://localhost:3000".parse().unwrap());

    tauri::WebviewWindowBuilder::new(app, "dashboard", url)
        .title("Autronis Dashboard")
        .inner_size(1400.0, 900.0)
        .min_inner_size(800.0, 600.0)
        .center()
        .decorations(true)
        .build()
        .ok();
}

// ============ NOTIFICATION HELPERS ============

fn show_notification(app: &AppHandle, title: &str, body: &str) {
    use tauri_plugin_notification::NotificationExt;
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .ok();
}

// ============ MAIN APP ============

pub fn run() {
    let config = Config::load();
    let storage = Storage::new().expect("Kon database niet openen");

    let state = Arc::new(AppState {
        tracking: Mutex::new(config.tracking_enabled),
        config: Mutex::new(config),
        storage: Mutex::new(storage),
        nextjs_process: Mutex::new(None),
    });

    let state_for_tracking = Arc::clone(&state);
    let state_for_sync = Arc::clone(&state);
    let state_for_nextjs = Arc::clone(&state);
    let state_for_notifications = Arc::clone(&state);
    let state_for_project_sync = Arc::clone(&state);

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_notification::init())
        .manage(Arc::clone(&state))
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            get_status,
            toggle_tracking,
            exclude_current_app,
        ])
        .setup(move |app| {
            let app_handle = app.handle().clone();

            // Build tray menu
            let dashboard_item = MenuItemBuilder::with_id("dashboard", "Dashboard openen").build(app)?;
            let toggle = MenuItemBuilder::with_id("toggle", "Pauzeer tracking").build(app)?;
            let exclude = MenuItemBuilder::with_id("exclude", "Huidige app excluden").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Afsluiten").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&dashboard_item)
                .separator()
                .item(&toggle)
                .item(&exclude)
                .separator()
                .item(&quit)
                .build()?;

            let _tray = TrayIconBuilder::new()
                .tooltip("Autronis Dashboard")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(move |app: &AppHandle, event| {
                    match event.id().as_ref() {
                        "dashboard" => {
                            open_dashboard(app);
                        }
                        "toggle" => {
                            let state = app.state::<Arc<AppState>>();
                            let mut tracking = state.tracking.lock().unwrap();
                            *tracking = !*tracking;
                            let new_state = *tracking;
                            let mut config = state.config.lock().unwrap();
                            config.tracking_enabled = new_state;
                            config.save();
                        }
                        "exclude" => {
                            let state = app.state::<Arc<AppState>>();
                            if let Some(info) = tracker::get_active_window() {
                                let mut config = state.config.lock().unwrap();
                                if !config.is_excluded(&info.app) {
                                    config.excluded_apps.push(info.app);
                                    config.save();
                                }
                            }
                        }
                        "quit" => {
                            // Kill Next.js process if we started it
                            let state = app.state::<Arc<AppState>>();
                            if let Some(mut child) = state.nextjs_process.lock().unwrap().take() {
                                tauri::async_runtime::spawn(async move {
                                    child.kill().await.ok();
                                });
                            }
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // On macOS: skip Next.js server + dashboard window (tracker only)
            // On Windows: start Next.js and open dashboard as before
            #[cfg(not(target_os = "macos"))]
            tauri::async_runtime::spawn({
                let state = Arc::clone(&state_for_nextjs);
                let app = app_handle.clone();
                async move {
                    ensure_nextjs_running(&state).await;
                    open_dashboard(&app);
                }
            });

            #[cfg(target_os = "macos")]
            let _ = &state_for_nextjs; // suppress unused warning

            // Start screen time tracking loop
            tauri::async_runtime::spawn({
                let state = Arc::clone(&state_for_tracking);
                async move {
                    let track_interval = {
                        let config = state.config.lock().unwrap();
                        config.track_interval_secs
                    };
                    let mut interval = tokio::time::interval(
                        std::time::Duration::from_secs(track_interval)
                    );
                    // Warmup: only start recording after 2 min of continuous activity
                    let mut active_streak_secs: u64 = 0;
                    let warmup_threshold: u64 = 120; // 2 minutes
                    let mut warmed_up = false;

                    loop {
                        interval.tick().await;

                        let is_tracking = *state.tracking.lock().unwrap();
                        if !is_tracking {
                            active_streak_secs = 0;
                            warmed_up = false;
                            continue;
                        }

                        let idle = tracker::get_idle_duration();

                        // 10 minuten geen input = STOP + reset warmup
                        if idle.as_secs() > 600 {
                            active_streak_secs = 0;
                            warmed_up = false;
                            continue;
                        }

                        // 2-10 min idle = inactief, reset warmup
                        if idle.as_secs() > 120 {
                            active_streak_secs = 0;
                            warmed_up = false;
                            continue;
                        }

                        // User is active — build up warmup streak
                        active_streak_secs += track_interval;

                        // Don't record until warmed up (2 min of activity)
                        if !warmed_up {
                            if active_streak_secs >= warmup_threshold {
                                warmed_up = true;
                                eprintln!("[tracking] Warmed up after {}s of activity", active_streak_secs);
                            } else {
                                continue; // Skip recording, still warming up
                            }
                        }

                        if let Some(info) = tracker::get_active_window() {
                            let config = state.config.lock().unwrap();
                            if config.is_excluded(&info.app) {
                                continue;
                            }
                            drop(config);

                            let storage = state.storage.lock().unwrap();
                            storage.record(
                                &info.app,
                                &info.title,
                                info.url.as_deref(),
                                track_interval as i64,
                            ).ok();
                        }
                    }
                }
            });

            // Start sync loop
            tauri::async_runtime::spawn({
                let state = Arc::clone(&state_for_sync);
                async move {
                    let sync_interval = {
                        let config = state.config.lock().unwrap();
                        config.sync_interval_secs
                    };
                    let mut interval = tokio::time::interval(
                        std::time::Duration::from_secs(sync_interval)
                    );
                    loop {
                        interval.tick().await;

                        let config = state.config.lock().unwrap().clone();
                        if config.api_token.is_empty() {
                            continue;
                        }

                        let records = {
                            let storage = state.storage.lock().unwrap();
                            storage.get_unsynced().unwrap_or_default()
                        };

                        if records.is_empty() {
                            continue;
                        }

                        match sync::sync_entries(&records, &config).await {
                            Ok((verwerkt, _)) => {
                                let storage = state.storage.lock().unwrap();
                                let ids: Vec<String> = records.iter()
                                    .map(|r| r.client_id.clone()).collect();
                                storage.mark_synced(&ids).ok();
                                storage.cleanup().ok();
                                if verwerkt > 0 {
                                    eprintln!("[sync] {} entries verwerkt", verwerkt);
                                }
                            }
                            Err(e) => {
                                eprintln!("[sync] Fout: {}", e);
                            }
                        }
                    }
                }
            });

            // Notification check loop — check for daily briefing alerts
            tauri::async_runtime::spawn({
                let state = Arc::clone(&state_for_notifications);
                let app = app_handle.clone();
                async move {
                    // Wait 30 seconds before first check
                    tokio::time::sleep(std::time::Duration::from_secs(30)).await;

                    let mut interval = tokio::time::interval(
                        std::time::Duration::from_secs(300) // Check every 5 minutes
                    );
                    loop {
                        interval.tick().await;

                        let config = state.config.lock().unwrap().clone();
                        if config.api_token.is_empty() {
                            continue;
                        }

                        // Check for pending notifications from the dashboard API
                        let url = format!("{}/api/notifications/pending", config.api_url);
                        let client = reqwest::Client::new();
                        let response = client
                            .get(&url)
                            .header("Authorization", format!("Bearer {}", config.api_token))
                            .timeout(std::time::Duration::from_secs(5))
                            .send()
                            .await;

                        if let Ok(res) = response {
                            if let Ok(data) = res.json::<serde_json::Value>().await {
                                if let Some(notifications) = data.get("notifications").and_then(|n| n.as_array()) {
                                    for notif in notifications {
                                        let title = notif.get("title")
                                            .and_then(|t| t.as_str())
                                            .unwrap_or("Autronis");
                                        let body = notif.get("body")
                                            .and_then(|b| b.as_str())
                                            .unwrap_or("");
                                        show_notification(&app, title, body);
                                    }
                                }
                            }
                        }
                    }
                }
            });

            // Local HTTP server for dashboard → VS Code integration
            tauri::async_runtime::spawn(async move {
                http_server::start_server().await;
            });

            // Project sync loop — scan local project dirs every 10 minutes
            tauri::async_runtime::spawn({
                let state = Arc::clone(&state_for_project_sync);
                async move {
                    // Wait 30 seconds before first sync
                    tokio::time::sleep(std::time::Duration::from_secs(30)).await;

                    let mut interval = tokio::time::interval(
                        std::time::Duration::from_secs(120) // Every 2 minutes
                    );
                    loop {
                        interval.tick().await;

                        let config = state.config.lock().unwrap().clone();
                        if config.api_token.is_empty() {
                            continue;
                        }

                        match project_sync::sync_projects(&config).await {
                            Ok(msg) => eprintln!("[project-sync] {}", msg),
                            Err(e) => eprintln!("[project-sync] Fout: {}", e),
                        }
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Kon Tauri app niet starten")
        .run(|_app_handle, event| {
            if let RunEvent::ExitRequested { api, .. } = event {
                // Keep running in system tray when window is closed
                api.prevent_exit();
            }
        });
}
