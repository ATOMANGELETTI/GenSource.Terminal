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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub codename: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub edition: Option<u16>,
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
    #[serde(default)]
    pub codename: String,
    #[serde(default)]
    pub edition: Option<u16>,
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
            codename: if self.codename.trim().is_empty() {
                None
            } else {
                Some(self.codename)
            },
            edition: self.edition,
        }
    }
}

/// A shell profile from `settings.json` `profiles` (resolved by id at spawn).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TerminalProfile {
    pub id: String,
    pub name: String,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub starting_directory: Option<String>,
}

fn default_profiles() -> Vec<TerminalProfile> {
    vec![
        TerminalProfile {
            id: "powershell".into(),
            name: "PowerShell".into(),
            command: "powershell.exe".into(),
            args: vec!["-NoLogo".into()],
            starting_directory: None,
        },
        TerminalProfile {
            id: "cmd".into(),
            name: "CMD".into(),
            command: "cmd.exe".into(),
            args: Vec::new(),
            starting_directory: None,
        },
    ]
}

fn default_default_profile() -> String {
    "powershell".into()
}

fn default_scrollback_lines() -> f64 {
    5000.0
}

fn default_cursor_style() -> String {
    "bar".into()
}

fn default_cursor_blink() -> bool {
    true
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
    #[serde(default = "default_default_profile")]
    pub default_profile: String,
    #[serde(default)]
    pub terminal_font_family: Option<String>,
    #[serde(default)]
    pub terminal_font_size: Option<f64>,
    #[serde(default = "default_scrollback_lines")]
    pub scrollback_lines: f64,
    #[serde(default = "default_cursor_style")]
    pub cursor_style: String,
    #[serde(default = "default_cursor_blink")]
    pub cursor_blink: bool,
    #[serde(default = "default_profiles")]
    pub profiles: Vec<TerminalProfile>,
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
            default_profile: default_default_profile(),
            terminal_font_family: None,
            terminal_font_size: None,
            scrollback_lines: default_scrollback_lines(),
            cursor_style: default_cursor_style(),
            cursor_blink: default_cursor_blink(),
            profiles: default_profiles(),
        }
    }
}

/// IPC: `pty_create` args (camelCase from frontend).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyCreateArgs {
    pub profile_id: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtySessionIdArgs {
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyWriteArgs {
    pub session_id: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyResizeArgs {
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyCreateResult {
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyOutputEvent {
    pub session_id: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyExitEvent {
    pub session_id: String,
    pub code: Option<i32>,
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
