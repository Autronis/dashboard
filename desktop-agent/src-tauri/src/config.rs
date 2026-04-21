use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub api_url: String,
    pub api_token: String,
    pub track_interval_secs: u64,
    pub sync_interval_secs: u64,
    pub excluded_apps: Vec<String>,
    pub tracking_enabled: bool,
    #[serde(default = "default_dashboard_dir")]
    pub dashboard_dir: String,
    #[serde(default = "default_locatie")]
    pub locatie: String,
    // Bewust default false: deze agent deed voorheen elke 2 min
    // `git add -A && commit && push` in alle projectmappen, wat
    // Vercel deploys liet queuen bij meerdere parallelle Claude chats.
    // Als dit weer aan moet: zet op true in config.json of via UI.
    #[serde(default)]
    pub auto_push_enabled: bool,
}

fn default_locatie() -> String {
    if cfg!(target_os = "macos") {
        "kantoor".to_string()
    } else {
        "thuis".to_string()
    }
}

fn default_dashboard_dir() -> String {
    if cfg!(target_os = "macos") {
        dirs::home_dir()
            .map(|h| h.join("Autronis/Projects/autronis-dashboard").to_string_lossy().to_string())
            .unwrap_or_else(|| "/Users/semmiegijs/Autronis/Projects/autronis-dashboard".to_string())
    } else {
        r"C:\Users\semmi\OneDrive\Claude AI\Projects\autronis-dashboard".to_string()
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            api_url: "https://dashboard.autronis.nl".to_string(),
            api_token: String::new(),
            track_interval_secs: 5,
            sync_interval_secs: 30,
            excluded_apps: vec![
                "1Password".to_string(),
                "KeePass".to_string(),
                "Windows Security".to_string(),
                "LockApp".to_string(),
                "SearchHost".to_string(),
                "ShellHost".to_string(),
                "ShellExperienceHost".to_string(),
                "loginwindow".to_string(),
                "ScreenSaverEngine".to_string(),
                "Keychain Access".to_string(),
            ],
            tracking_enabled: true,
            dashboard_dir: default_dashboard_dir(),
            locatie: default_locatie(),
            auto_push_enabled: false,
        }
    }
}

impl Config {
    pub fn config_path() -> PathBuf {
        let config_dir = dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("autronis-screentime");
        fs::create_dir_all(&config_dir).ok();
        config_dir.join("config.json")
    }

    pub fn load() -> Self {
        let path = Self::config_path();
        if path.exists() {
            let content = fs::read_to_string(&path).unwrap_or_default();
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            let config = Self::default();
            config.save();
            config
        }
    }

    pub fn save(&self) {
        let path = Self::config_path();
        if let Ok(json) = serde_json::to_string_pretty(self) {
            fs::write(path, json).ok();
        }
    }

    pub fn is_excluded(&self, app_name: &str) -> bool {
        self.excluded_apps.iter().any(|e| {
            app_name.to_lowercase().contains(&e.to_lowercase())
        })
    }
}
