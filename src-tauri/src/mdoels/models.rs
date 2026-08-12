//! Shared data models. Note: this directory is intentionally named `mdoels`
//! (a pre-existing typo in the template); preserve it unless asked to rename.

use serde::{Deserialize, Serialize};

/// Basic metadata about the running application, exposed to the frontend
/// via the `get_app_info` command. Prefer values from `appinfo.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub product_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub identifier: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub publisher: Option<String>,
}

/// On-disk `other/configs/appinfo.json` shape (read-only at runtime).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfoFile {
    pub name: String,
    #[serde(default)]
    pub product_name: String,
    #[serde(default)]
    pub identifier: String,
    pub version: String,
    #[serde(default)]
    pub publisher: String,
    #[serde(default)]
    pub description: String,
}

impl AppInfoFile {
    pub fn into_app_info(self) -> AppInfo {
        AppInfo {
            name: self.name,
            version: self.version,
            description: if self.description.trim().is_empty() {
                None
            } else {
                Some(self.description)
            },
            product_name: if self.product_name.trim().is_empty() {
                None
            } else {
                Some(self.product_name)
            },
            identifier: if self.identifier.trim().is_empty() {
                None
            } else {
                Some(self.identifier)
            },
            publisher: if self.publisher.trim().is_empty() {
                None
            } else {
                Some(self.publisher)
            },
        }
    }
}

/// On-disk `other/configs/settings.json` shape.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_font_family")]
    pub font_family: String,
    #[serde(default = "default_font_size")]
    pub font_size: f64,
    #[serde(default)]
    pub start_minimized: bool,
    #[serde(default)]
    pub autostart: bool,
    #[serde(default)]
    pub always_on_top: bool,
}

fn default_theme() -> String {
    "nord-polar-night".into()
}

fn default_font_family() -> String {
    "Terminus".into()
}

fn default_font_size() -> f64 {
    14.0
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            font_family: default_font_family(),
            font_size: default_font_size(),
            start_minimized: false,
            autostart: false,
            always_on_top: false,
        }
    }
}

/// Whether a keybinding is registered as an OS-wide global shortcut (fires
/// even when the app isn't focused) or only handled in-app while the
/// window that owns the shortcut has focus. Common editing/clipboard keys
/// (Reload, Copy, Paste, ...) must stay `local` — registering them globally
/// would hijack those keys for every other application on the system.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum KeybindingScope {
    Global,
    Local,
}

impl Default for KeybindingScope {
    fn default() -> Self {
        KeybindingScope::Local
    }
}

/// A single shortcut binding from `keybindings.json`. Global-scope bindings
/// are registered with `tauri-plugin-global-shortcut`; local-scope bindings
/// are only read by the frontend (for menu shortcut labels and an in-app
/// `keydown` dispatcher).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Keybinding {
    pub id: String,
    pub shortcut: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub scope: KeybindingScope,
}

fn default_true() -> bool {
    true
}

/// On-disk `other/configs/keybindings.json` shape.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct KeybindingsFile {
    #[serde(default)]
    pub bindings: Vec<Keybinding>,
}

/// On-disk `other/configs/logging.json` shape — independent per-level toggles
/// for file logging under `other/logging/app/`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LoggingSettings {
    #[serde(default = "default_true")]
    pub error: bool,
    #[serde(default = "default_true")]
    pub warn: bool,
    #[serde(default = "default_true")]
    pub info: bool,
    #[serde(default)]
    pub debug: bool,
    #[serde(default)]
    pub trace: bool,
    /// Separate channel for `log_fatal!` (Error level + `gensource::fatal` target).
    #[serde(default = "default_true")]
    pub fatal: bool,
}

impl Default for LoggingSettings {
    fn default() -> Self {
        Self {
            error: true,
            warn: true,
            info: true,
            debug: false,
            trace: false,
            fatal: true,
        }
    }
}
