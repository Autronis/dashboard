mod config;
mod storage;
mod sync;
mod tracker;

use config::Config;
use storage::Storage;
use std::sync::{Arc, Mutex};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    AppHandle, Manager, RunEvent,
};

struct AppState {
    config: Mutex<Config>,
    storage: Mutex<Storage>,
    tracking: Mutex<bool>,
}

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
    // Also update config
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

pub fn run() {
    let config = Config::load();
    let storage = Storage::new().expect("Kon database niet openen");

    let state = Arc::new(AppState {
        tracking: Mutex::new(config.tracking_enabled),
        config: Mutex::new(config),
        storage: Mutex::new(storage),
    });

    let state_for_tracking = Arc::clone(&state);
    let state_for_sync = Arc::clone(&state);

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(Arc::clone(&state))
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            get_status,
            toggle_tracking,
            exclude_current_app,
        ])
        .setup(move |app| {
            // Build tray menu
            let toggle = MenuItemBuilder::with_id("toggle", "Pauzeer tracking").build(app)?;
            let status = MenuItemBuilder::with_id("status", "Status bekijken").build(app)?;
            let exclude = MenuItemBuilder::with_id("exclude", "Huidige app excluden").build(app)?;
            let settings = MenuItemBuilder::with_id("settings", "Instellingen").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Afsluiten").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&toggle)
                .item(&status)
                .separator()
                .item(&exclude)
                .item(&settings)
                .separator()
                .item(&quit)
                .build()?;

            let _tray = TrayIconBuilder::new()
                .tooltip("Autronis Screen Time - Actief")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(move |app: &AppHandle, event| {
                    match event.id().as_ref() {
                        "toggle" => {
                            let state = app.state::<Arc<AppState>>();
                            let mut tracking = state.tracking.lock().unwrap();
                            *tracking = !*tracking;
                            let new_state = *tracking;
                            let mut config = state.config.lock().unwrap();
                            config.tracking_enabled = new_state;
                            config.save();
                        }
                        "status" | "settings" => {
                            if let Some(window) = app.get_webview_window("main") {
                                window.show().ok();
                                window.set_focus().ok();
                            } else {
                                tauri::WebviewWindowBuilder::new(
                                    app,
                                    "main",
                                    tauri::WebviewUrl::default(),
                                )
                                .title("Autronis Screen Time")
                                .inner_size(480.0, 600.0)
                                .resizable(false)
                                .build()
                                .ok();
                            }
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
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // Start tracking loop (runs on Tauri's built-in tokio runtime)
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
                    loop {
                        interval.tick().await;

                        let is_tracking = *state.tracking.lock().unwrap();
                        if !is_tracking {
                            continue;
                        }

                        let idle = tracker::get_idle_duration();
                        if idle.as_secs() > 60 {
                            // Log idle period instead of skipping
                            let storage = state.storage.lock().unwrap();
                            storage.record(
                                "Inactief",
                                "Geen activiteit",
                                None,
                                track_interval as i64,
                            ).ok();
                            continue;
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

            // Start sync loop — fetches unsynced records, drops lock, then does HTTP
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

                        // Get unsynced records while holding lock, then drop it
                        let records = {
                            let storage = state.storage.lock().unwrap();
                            storage.get_unsynced().unwrap_or_default()
                        };
                        // Lock is dropped here — safe to await

                        if records.is_empty() {
                            continue;
                        }

                        match sync::sync_entries(&records, &config).await {
                            Ok((verwerkt, _)) => {
                                // Re-acquire lock to mark synced
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
