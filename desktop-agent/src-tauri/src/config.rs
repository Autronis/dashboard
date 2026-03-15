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
}

impl Default for Config {
    fn default() -> Self {
        Self {
            api_url: "http://localhost:3000".to_string(),
            api_token: String::new(),
            track_interval_secs: 5,
            sync_interval_secs: 30,
            excluded_apps: vec![
                "1Password".to_string(),
                "KeePass".to_string(),
                "Windows Security".to_string(),
            ],
            tracking_enabled: true,
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
