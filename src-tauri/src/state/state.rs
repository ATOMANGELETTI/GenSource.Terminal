//! Shared Tauri state, registered via `Builder::manage` in `lib.rs`.

use std::path::PathBuf;
use std::sync::{Arc, Mutex, RwLock};

use crate::mdoels::{AppSettings, LoggingSettings};

/// In-memory app state shared across commands and the config watcher.
pub struct AppState {
    pub greet_count: Mutex<u64>,
    pub configs_dir: Mutex<Option<PathBuf>>,
    /// Live settings, kept in sync with `settings.json`.
    pub settings: Mutex<AppSettings>,
    /// Live logging toggles, shared with the log plugin filter.
    pub logging: Arc<RwLock<LoggingSettings>>,
}

impl AppState {
    /// Create state seeded from disk so early `get_settings` / `get_app_info`
    /// (e.g. splash before `.setup` finishes) do not see blank defaults.
    pub fn new(
        logging: Arc<RwLock<LoggingSettings>>,
        settings: AppSettings,
        configs_dir: Option<PathBuf>,
    ) -> Self {
        Self {
            greet_count: Mutex::new(0),
            configs_dir: Mutex::new(configs_dir),
            settings: Mutex::new(settings),
            logging,
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new(
            Arc::new(RwLock::new(LoggingSettings::default())),
            AppSettings::default(),
            None,
        )
    }
}
