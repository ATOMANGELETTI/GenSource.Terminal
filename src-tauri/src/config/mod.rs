//! Load, save, watch, and apply `other/configs/` JSON files next to the app.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::sync::{Arc, Mutex, RwLock};
use std::thread;
use std::time::{Duration, Instant};

use json_comments::StripComments;
use log::{info, warn};
use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::de::DeserializeOwned;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewWindow};
use tauri_plugin_autostart::ManagerExt as AutostartExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use time::OffsetDateTime;

use crate::mdoels::{
    AgentConfig, AppInfo, AppInfoFile, AppSettings, KeybindingScope, KeybindingsFile,
    LoggingSettings,
};
use crate::state::AppState;

/// How long the watcher ignores events after an intentional UI/IPC write.
const SELF_WRITE_IGNORE: Duration = Duration::from_millis(600);

static SETTINGS_SELF_WRITE_UNTIL: Mutex<Option<Instant>> = Mutex::new(None);
static LOGGING_SELF_WRITE_UNTIL: Mutex<Option<Instant>> = Mutex::new(None);
static AGENT_SELF_WRITE_UNTIL: Mutex<Option<Instant>> = Mutex::new(None);

pub const SETTINGS_CHANGED_EVENT: &str = "settings-changed";
pub const LOGGING_CHANGED_EVENT: &str = "logging-changed";
pub const AGENT_CHANGED_EVENT: &str = "agent-changed";

const SETTINGS_FILE: &str = "settings.json";
const KEYBINDINGS_FILE: &str = "keybindings.json";
const APPINFO_FILE: &str = "appinfo.json";
const LOGGING_FILE: &str = "logging.json";
const AGENT_FILE: &str = "agent.json";

const DEFAULT_SETTINGS_JSON: &str = include_str!("../../../other/configs/settings.json");
const DEFAULT_KEYBINDINGS_JSON: &str = include_str!("../../../other/configs/keybindings.json");
const DEFAULT_APPINFO_JSON: &str = include_str!("../../../other/configs/appinfo.json");
const DEFAULT_LOGGING_JSON: &str = include_str!("../../../other/configs/logging.json");
/// Shipped default for a missing `agent.json`. Keep `apiKey` empty so a local
/// plaintext key is never baked into the binary via `include_str!`.
const DEFAULT_AGENT_JSON: &str = r#"{
  "activeProvider": "gemini",
  "providers": {
    "gemini": {
      "apiKey": "",
      "model": "gemini-3.6-flash"
    }
  },
  "systemPrompt": "You are GenSource Terminal's agent. Reply in the Agents chat panel. Use tools for files, git, and settings when helpful. Only use the terminal tool when the user asks you to run a shell command."
}
"#;

/// Repo root (parent of `src-tauri`). Used for portable `.env` lookup in dev.
pub fn resolve_repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
}

/// Load gitignored `.env` / `.env.local` / `.env.dev` from the repo root.
///
/// No-op when not `tauri::is_dev()` — packaged builds never read these files.
/// First-set wins: existing process env, then `.env.local`, `.env.dev`, `.env`.
pub fn load_dev_dotenv() {
    if !tauri::is_dev() {
        return;
    }
    let root = resolve_repo_root();
    for name in [".env.local", ".env.dev", ".env"] {
        let path = root.join(name);
        if path.is_file() {
            let _ = dotenvy::from_path(&path);
        }
    }
}

/// Resolve a directory under the live `other/` tree (no `AppHandle` required).
///
/// Dev (`tauri::is_dev()`): repo `other/<subdir>` via `CARGO_MANIFEST_DIR`.
/// Packaged: `<exe_dir>/other/<subdir>`.
pub fn resolve_other_subdir(subdir: &str) -> PathBuf {
    let relative = PathBuf::from("other").join(subdir);
    let dev_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join(&relative);

    if tauri::is_dev() {
        if let Ok(canonical) = fs::canonicalize(&dev_dir) {
            return canonical;
        }
        return dev_dir;
    }

    if let Some(packaged) = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|p| p.join(&relative)))
    {
        return packaged;
    }

    if let Ok(canonical) = fs::canonicalize(&dev_dir) {
        return canonical;
    }

    dev_dir
}

/// Resolve the live `other/configs` directory.
///
/// Dev (`tauri::is_dev()`): repo `other/configs` via `CARGO_MANIFEST_DIR`
/// (bundle resources may also exist under `target/debug/other/` — ignore them).
/// Packaged: `<exe_dir>/other/configs`, with `resource_dir()/other/configs` fallback.
pub fn resolve_configs_dir<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    let early = resolve_other_subdir("configs");

    if tauri::is_dev() {
        return early;
    }

    if early.is_dir() {
        return early;
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        let candidate = resource_dir.join("other").join("configs");
        if candidate.is_dir() {
            return candidate;
        }
    }

    early
}

/// Runtime app log directory: `other/logging/app`.
pub fn resolve_logging_app_dir() -> PathBuf {
    resolve_other_subdir("logging/app")
}

/// Runtime agent log directory: `other/logging/agent`.
pub fn resolve_logging_agent_dir() -> PathBuf {
    resolve_other_subdir("logging/agent")
}

/// Runtime build log directory: `other/logging/build`.
pub fn resolve_logging_build_dir() -> PathBuf {
    resolve_other_subdir("logging/build")
}

/// Ensure config + logging directories and default files exist.
pub fn ensure_logging_dirs() -> Result<(), String> {
    let app_dir = resolve_logging_app_dir();
    let build_dir = resolve_logging_build_dir();
    let agent_dir = resolve_logging_agent_dir();
    fs::create_dir_all(&app_dir).map_err(|e| format!("create logging app dir: {e}"))?;
    fs::create_dir_all(&build_dir).map_err(|e| format!("create logging build dir: {e}"))?;
    fs::create_dir_all(&agent_dir).map_err(|e| format!("create logging agent dir: {e}"))?;
    Ok(())
}

/// Ensure the portable SQLite + Stronghold folders exist under `other/database/`.
pub fn ensure_database_dirs() -> Result<(), String> {
    for subdir in [
        "database/sqlite/agents/chats",
        "database/sqlite/agents/memory",
        "database/sqlite/app",
        "database/stronghold",
    ] {
        let path = resolve_other_subdir(subdir);
        fs::create_dir_all(&path).map_err(|e| format!("create {subdir}: {e}"))?;
    }
    Ok(())
}

/// Stronghold salt file: `other/database/stronghold/salt.txt`.
pub fn resolve_stronghold_salt_path() -> PathBuf {
    resolve_other_subdir("database/stronghold").join("salt.txt")
}

/// Stronghold vault snapshot: `other/database/stronghold/vault.hold`.
pub fn resolve_stronghold_vault_path() -> PathBuf {
    resolve_other_subdir("database/stronghold").join("vault.hold")
}

/// Agent chats SQLite file: `other/database/sqlite/agents/chats/chats.db`.
pub fn resolve_chats_db_path() -> PathBuf {
    resolve_other_subdir("database/sqlite/agents/chats").join("chats.db")
}

/// Display a filesystem path without a Windows `\\?\` prefix (for IPC / Stronghold).
pub fn path_to_portable_string(path: &Path) -> String {
    let raw = path.to_string_lossy();
    raw.strip_prefix(r"\\?\").unwrap_or(raw.as_ref()).to_string()
}

/// Ensure the config files exist. Never overwrites an existing
/// `appinfo.json` (read-only / user-visible metadata).
pub fn ensure_config_files(dir: &Path) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| format!("create configs dir: {e}"))?;

    write_default_if_missing(dir.join(SETTINGS_FILE), DEFAULT_SETTINGS_JSON)?;
    write_default_if_missing(dir.join(KEYBINDINGS_FILE), DEFAULT_KEYBINDINGS_JSON)?;
    write_default_if_missing(dir.join(APPINFO_FILE), DEFAULT_APPINFO_JSON)?;
    write_default_if_missing(dir.join(LOGGING_FILE), DEFAULT_LOGGING_JSON)?;
    write_default_if_missing(dir.join(AGENT_FILE), DEFAULT_AGENT_JSON)?;

    Ok(())
}

/// Build the per-run log file stem: `HH-MM-SS_YYYY-MM-DD_{version}`.
pub fn format_log_stem(version: &str) -> String {
    let now = OffsetDateTime::now_local().unwrap_or_else(|_| OffsetDateTime::now_utc());
    let version = version.trim().replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
    format!(
        "{:02}-{:02}-{:02}_{:04}-{:02}-{:02}_{version}",
        now.hour(),
        now.minute(),
        now.second(),
        now.year(),
        u8::from(now.month()),
        now.day(),
    )
}

/// Prefer `appinfo.json` version; fall back to the given package version string.
pub fn resolve_log_version(configs_dir: &Path, package_version: &str) -> String {
    load_appinfo(configs_dir)
        .map(|info| info.version)
        .filter(|v| !v.trim().is_empty())
        .unwrap_or_else(|| package_version.to_string())
}

fn write_default_if_missing(path: PathBuf, contents: &str) -> Result<(), String> {
    if path.exists() {
        return Ok(());
    }
    fs::write(&path, contents).map_err(|e| format!("write {}: {e}", path.display()))
}

/// Parse JSON that may include `//` or `/* */` comments (JSONC), as used in
/// the user-editable files under `other/configs/`.
fn parse_jsonc<T: DeserializeOwned>(raw: &str) -> Result<T, serde_json::Error> {
    serde_json::from_reader(StripComments::new(raw.as_bytes()))
}

/// Post-load normalize for terminal keys: empty profiles → builtins, bad
/// `defaultProfile` → fallback, clamp scrollback, fix invalid cursor style.
pub fn normalize_terminal_settings(settings: &mut crate::mdoels::AppSettings) {
    if settings.profiles.is_empty() {
        settings.profiles = crate::mdoels::AppSettings::default().profiles;
    }
    if !settings
        .profiles
        .iter()
        .any(|p| p.id == settings.default_profile)
    {
        if settings.profiles.iter().any(|p| p.id == "powershell") {
            settings.default_profile = "powershell".into();
        } else {
            settings.default_profile = settings.profiles[0].id.clone();
        }
    }
    let sb = settings.scrollback_lines;
    settings.scrollback_lines = if !sb.is_finite() {
        5000.0
    } else if sb < 100.0 {
        100.0
    } else if sb > 100_000.0 {
        100_000.0
    } else {
        sb.floor()
    };
    match settings.cursor_style.as_str() {
        "block" | "underline" | "bar" => {}
        _ => settings.cursor_style = "bar".into(),
    }
}

pub fn load_settings(dir: &Path) -> AppSettings {
    let path = dir.join(SETTINGS_FILE);
    let mut settings = match fs::read_to_string(&path) {
        Ok(raw) => match parse_jsonc::<AppSettings>(&raw) {
            Ok(settings) => settings,
            Err(err) => {
                warn!("corrupt settings.json ({err}); merging with defaults");
                merge_settings_partial(&raw).unwrap_or_default()
            }
        },
        Err(err) => {
            warn!("could not read settings.json ({err}); using defaults");
            AppSettings::default()
        }
    };
    normalize_terminal_settings(&mut settings);
    settings
}

fn merge_settings_partial(raw: &str) -> Option<AppSettings> {
    let value: serde_json::Value = parse_jsonc(raw).ok()?;
    let defaults = serde_json::to_value(AppSettings::default()).ok()?;
    let merged = merge_json(defaults, value);
    serde_json::from_value(merged).ok()
}

fn merge_json(mut base: serde_json::Value, overlay: serde_json::Value) -> serde_json::Value {
    match (&mut base, overlay) {
        (serde_json::Value::Object(base_map), serde_json::Value::Object(overlay_map)) => {
            for (key, value) in overlay_map {
                let entry = base_map.entry(key).or_insert(serde_json::Value::Null);
                *entry = merge_json(entry.take(), value);
            }
            base
        }
        (_, overlay) => overlay,
    }
}

pub fn load_keybindings(dir: &Path) -> KeybindingsFile {
    let path = dir.join(KEYBINDINGS_FILE);
    match fs::read_to_string(&path) {
        Ok(raw) => parse_jsonc(&raw).unwrap_or_else(|err| {
            warn!("corrupt keybindings.json ({err}); using empty bindings");
            KeybindingsFile::default()
        }),
        Err(err) => {
            warn!("could not read keybindings.json ({err}); using empty bindings");
            KeybindingsFile::default()
        }
    }
}

pub fn load_appinfo(dir: &Path) -> Option<AppInfoFile> {
    let path = dir.join(APPINFO_FILE);
    let raw = fs::read_to_string(&path).ok()?;
    parse_jsonc(&raw).ok()
}

pub fn load_logging(dir: &Path) -> LoggingSettings {
    let path = dir.join(LOGGING_FILE);
    match fs::read_to_string(&path) {
        Ok(raw) => parse_logging_json(&raw).unwrap_or_else(|| {
            warn!("corrupt logging.json; using defaults");
            LoggingSettings::default()
        }),
        Err(err) => {
            warn!("could not read logging.json ({err}); using defaults");
            LoggingSettings::default()
        }
    }
}

fn parse_logging_json(raw: &str) -> Option<LoggingSettings> {
    let value: serde_json::Value = parse_jsonc(raw).ok()?;
    let migrated = migrate_legacy_logging_value(value);
    merge_logging_value(migrated)
}

/// Lift pre-nested `{ error, warn, … }` files into `{ app: { … } }`.
fn migrate_legacy_logging_value(mut value: serde_json::Value) -> serde_json::Value {
    let Some(obj) = value.as_object_mut() else {
        return value;
    };
    if obj.contains_key("app") {
        return value;
    }
    let mut app = serde_json::Map::new();
    for key in ["error", "warn", "info", "debug", "trace", "fatal"] {
        if let Some(v) = obj.remove(key) {
            app.insert(key.to_string(), v);
        }
    }
    if !app.is_empty() {
        obj.insert("app".to_string(), serde_json::Value::Object(app));
    }
    value
}

fn merge_logging_value(value: serde_json::Value) -> Option<LoggingSettings> {
    let defaults = serde_json::to_value(LoggingSettings::default()).ok()?;
    let merged = merge_json(defaults, value);
    serde_json::from_value(merged).ok()
}

/// Pretty-print camelCase JSON (2-space indent, trailing newline, no comments).
fn write_pretty_json<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let body = serde_json::to_string_pretty(value)
        .map_err(|e| format!("serialize {}: {e}", path.display()))?;
    let mut out = body;
    if !out.ends_with('\n') {
        out.push('\n');
    }
    fs::write(path, out).map_err(|e| format!("write {}: {e}", path.display()))
}

fn note_settings_self_write() {
    match SETTINGS_SELF_WRITE_UNTIL.lock() {
        Ok(mut guard) => *guard = Some(Instant::now() + SELF_WRITE_IGNORE),
        Err(poisoned) => {
            *poisoned.into_inner() = Some(Instant::now() + SELF_WRITE_IGNORE);
        }
    }
}

fn note_logging_self_write() {
    match LOGGING_SELF_WRITE_UNTIL.lock() {
        Ok(mut guard) => *guard = Some(Instant::now() + SELF_WRITE_IGNORE),
        Err(poisoned) => {
            *poisoned.into_inner() = Some(Instant::now() + SELF_WRITE_IGNORE);
        }
    }
}

fn note_agent_self_write() {
    match AGENT_SELF_WRITE_UNTIL.lock() {
        Ok(mut guard) => *guard = Some(Instant::now() + SELF_WRITE_IGNORE),
        Err(poisoned) => {
            *poisoned.into_inner() = Some(Instant::now() + SELF_WRITE_IGNORE);
        }
    }
}

fn is_settings_self_write() -> bool {
    let guard = SETTINGS_SELF_WRITE_UNTIL
        .lock()
        .unwrap_or_else(|p| p.into_inner());
    guard.is_some_and(|until| Instant::now() < until)
}

fn is_logging_self_write() -> bool {
    let guard = LOGGING_SELF_WRITE_UNTIL
        .lock()
        .unwrap_or_else(|p| p.into_inner());
    guard.is_some_and(|until| Instant::now() < until)
}

fn is_agent_self_write() -> bool {
    let guard = AGENT_SELF_WRITE_UNTIL
        .lock()
        .unwrap_or_else(|p| p.into_inner());
    guard.is_some_and(|until| Instant::now() < until)
}

/// Write normalized `settings.json` (pretty camelCase JSON).
pub fn write_settings(dir: &Path, settings: &AppSettings) -> Result<(), String> {
    write_pretty_json(&dir.join(SETTINGS_FILE), settings)
}

/// Write `logging.json` (pretty camelCase JSON).
pub fn write_logging(dir: &Path, settings: &LoggingSettings) -> Result<(), String> {
    write_pretty_json(&dir.join(LOGGING_FILE), settings)
}

/// Write `agent.json` (pretty camelCase JSON).
pub fn write_agent(dir: &Path, config: &AgentConfig) -> Result<(), String> {
    write_pretty_json(&dir.join(AGENT_FILE), config)
}

pub fn load_agent(dir: &Path) -> AgentConfig {
    let path = dir.join(AGENT_FILE);
    match fs::read_to_string(&path) {
        Ok(raw) => match parse_jsonc::<AgentConfig>(&raw) {
            Ok(mut config) => {
                normalize_agent_config(&mut config);
                config
            }
            Err(err) => {
                warn!("corrupt agent.json ({err}); using defaults");
                AgentConfig::default()
            }
        },
        Err(err) => {
            warn!("could not read agent.json ({err}); using defaults");
            AgentConfig::default()
        }
    }
}

fn normalize_agent_config(config: &mut AgentConfig) {
    if config.active_provider.trim().is_empty() {
        config.active_provider = default_agent_provider_name();
    }
    if config.system_prompt.trim().is_empty() {
        config.system_prompt = AgentConfig::default().system_prompt;
    }
    if !config.providers.contains_key("gemini") {
        config
            .providers
            .insert("gemini".into(), crate::mdoels::AgentProviderConfig::default());
    }
    for provider in config.providers.values_mut() {
        if provider.model.trim().is_empty() {
            provider.model = "gemini-3.6-flash".into();
        }
    }
}

fn default_agent_provider_name() -> String {
    "gemini".into()
}

pub fn emit_agent_changed<R: Runtime>(app: &AppHandle<R>, config: &AgentConfig) {
    if let Err(err) = app.emit(AGENT_CHANGED_EVENT, config) {
        warn!("failed to emit {AGENT_CHANGED_EVENT}: {err}");
    }
}

/// Clear provider API keys before writing `agent.json` (keys live in Stronghold).
pub fn strip_agent_api_keys(config: &mut AgentConfig) {
    for provider in config.providers.values_mut() {
        provider.api_key.clear();
    }
}

/// Persist `agent.json` and notify the frontend.
/// Provider API keys are always stripped; they belong in Stronghold, not JSON.
pub fn save_and_emit_agent<R: Runtime>(
    app: &AppHandle<R>,
    config: AgentConfig,
) -> Result<AgentConfig, String> {
    let mut config = config;
    strip_agent_api_keys(&mut config);
    normalize_agent_config(&mut config);

    let state = app.state::<AppState>();
    let configs_dir = state
        .configs_dir
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .clone()
        .ok_or_else(|| "configs dir not initialized".to_string())?;

    note_agent_self_write();
    write_agent(&configs_dir, &config)?;
    emit_agent_changed(app, &config);
    Ok(config)
}

/// Write `keybindings.json` (pretty camelCase JSON).
pub fn write_keybindings(dir: &Path, file: &KeybindingsFile) -> Result<(), String> {
    write_pretty_json(&dir.join(KEYBINDINGS_FILE), file)
}

/// Normalize, persist `settings.json`, update `AppState`, and apply live effects.
pub fn save_and_apply_settings<R: Runtime>(
    app: &AppHandle<R>,
    mut settings: AppSettings,
) -> Result<AppSettings, String> {
    normalize_terminal_settings(&mut settings);

    let state = app.state::<AppState>();
    let configs_dir = state
        .configs_dir
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone()
        .ok_or_else(|| "configs dir not initialized".to_string())?;

    note_settings_self_write();
    write_settings(&configs_dir, &settings)?;

    let previous = state
        .settings
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();

    {
        let mut guard = state.settings.lock().unwrap_or_else(|p| p.into_inner());
        *guard = settings.clone();
    }

    if settings.always_on_top != previous.always_on_top {
        if let Some(window) = app.get_webview_window("main") {
            apply_always_on_top(&window, &settings);
        }
    }

    if settings.autostart != previous.autostart {
        apply_autostart(app, settings.autostart);
    }

    if ui_settings_changed(&previous, &settings) {
        emit_settings_changed(app, &settings);
    }

    Ok(settings)
}

/// Persist `logging.json` and re-apply the live log filter (same path as watcher).
pub fn save_and_apply_logging<R: Runtime>(
    app: &AppHandle<R>,
    configs_dir: &Path,
    logging: &Arc<RwLock<LoggingSettings>>,
    next: LoggingSettings,
) -> Result<LoggingSettings, String> {
    note_logging_self_write();
    write_logging(configs_dir, &next)?;
    apply_logging_settings(logging, next.clone());
    emit_logging_changed(app, &next);
    Ok(next)
}

/// Persist `keybindings.json`. Global shortcuts still require an app restart;
/// local bindings are re-fetched by the frontend.
pub fn save_keybindings_file(configs_dir: &Path, file: &KeybindingsFile) -> Result<(), String> {
    write_keybindings(configs_dir, file)
}

pub fn apply_logging_settings(logging: &Arc<RwLock<LoggingSettings>>, next: LoggingSettings) {
    match logging.write() {
        Ok(mut guard) => *guard = next,
        Err(poisoned) => {
            *poisoned.into_inner() = next;
        }
    }
}

pub fn reload_logging_settings(
    configs_dir: &Path,
    logging: &Arc<RwLock<LoggingSettings>>,
) -> LoggingSettings {
    let next = load_logging(configs_dir);
    apply_logging_settings(logging, next.clone());
    next
}

pub fn app_info_from_package<R: Runtime>(app: &AppHandle<R>) -> AppInfo {
    let package_info = app.package_info();
    let description = package_info.description.trim();
    AppInfo {
        name: package_info.name.clone(),
        version: package_info.version.to_string(),
        description: if description.is_empty() {
            None
        } else {
            Some(description.to_string())
        },
        product_name: Some(package_info.name.clone()),
        identifier: None,
        publisher: None,
        codename: None,
        edition: None,
    }
}

pub fn emit_settings_changed<R: Runtime>(app: &AppHandle<R>, settings: &AppSettings) {
    if let Err(err) = app.emit(SETTINGS_CHANGED_EVENT, settings) {
        warn!("failed to emit {SETTINGS_CHANGED_EVENT}: {err}");
    }
}

pub fn emit_logging_changed<R: Runtime>(app: &AppHandle<R>, logging: &LoggingSettings) {
    if let Err(err) = app.emit(LOGGING_CHANGED_EVENT, logging) {
        warn!("failed to emit {LOGGING_CHANGED_EVENT}: {err}");
    }
}

/// Nord0 — dark theme `--bg` (polar-night / frost / aurora dark).
const SPLASH_BG_DARK: (u8, u8, u8) = (0x2e, 0x34, 0x40);
/// Nord6 — light theme `--bg` (snow-storm / frost-light / aurora-light).
const SPLASH_BG_LIGHT: (u8, u8, u8) = (0xec, 0xef, 0xf4);

/// Whether the OS prefers a dark app chrome (Windows `AppsUseLightTheme`).
/// Defaults to dark when unknown so early chrome matches Polar Night fallback.
pub fn is_system_dark() -> bool {
    #[cfg(windows)]
    {
        let output = std::process::Command::new("reg")
            .args([
                "query",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize",
                "/v",
                "AppsUseLightTheme",
            ])
            .output();
        match output {
            Ok(out) if out.status.success() => {
                let text = String::from_utf8_lossy(&out.stdout);
                // `0x1` = light apps; `0x0` = dark apps.
                !text.lines().any(|line| {
                    line.contains("AppsUseLightTheme") && line.contains("0x1")
                })
            }
            _ => true,
        }
    }
    #[cfg(not(windows))]
    {
        true
    }
}

/// Resolves `settings.json` theme preference to splash RGB, mirroring
/// frontend `resolveTheme` + CSS `--bg` (nord0 dark / nord6 light).
pub fn splash_background_rgb(theme: &str) -> (u8, u8, u8) {
    let key = theme.trim().to_ascii_lowercase();
    let light = match key.as_str() {
        "nord-snow-storm" | "snow-storm" | "nord-frost-light" | "frost-light"
        | "nord-aurora-light" | "aurora-light" => true,
        "nord-polar-night" | "polar-night" | "frost-dark" | "nord-frost-dark"
        | "aurora-dark" | "nord-aurora-dark" => false,
        // OS-aware prefs (same set as frontend `followsSystemScheme`).
        "system" | "frost" | "nord-frost" | "aurora" | "nord-aurora" => !is_system_dark(),
        _ => false,
    };
    if light {
        SPLASH_BG_LIGHT
    } else {
        SPLASH_BG_DARK
    }
}

/// Apply theme-correct native splash color, then show + focus (splash starts hidden).
pub fn reveal_splash_window<R: Runtime>(app: &AppHandle<R>, theme: &str) {
    let Some(splash) = app.get_webview_window("splash") else {
        warn!("splash window missing; cannot reveal");
        return;
    };

    let (r, g, b) = splash_background_rgb(theme);
    let color = tauri::window::Color(r, g, b, 255);
    if let Err(err) = splash.set_background_color(Some(color)) {
        warn!("splash set_background_color failed: {err}");
    }
    if let Err(err) = splash.show() {
        warn!("splash show failed: {err}");
    }
    if let Err(err) = splash.set_focus() {
        warn!("splash set_focus failed: {err}");
    }
}

pub fn apply_always_on_top<R: Runtime>(window: &WebviewWindow<R>, settings: &AppSettings) {
    let always_on_top = window.is_always_on_top().unwrap_or(false);
    if settings.always_on_top != always_on_top {
        if let Err(err) = window.set_always_on_top(settings.always_on_top) {
            warn!("set_always_on_top failed: {err}");
        }
    }
}

/// Applies `startMinimized` by hiding or showing the window.
///
/// Boot visibility is owned by the splash window (main starts hidden; splash
/// shows main when ready unless `startMinimized`). Kept for callers that need
/// to re-sync after a settings change.
#[allow(dead_code)]
pub fn apply_start_minimized<R: Runtime>(window: &WebviewWindow<R>, settings: &AppSettings) {
    if settings.start_minimized {
        let _ = window.hide();
    } else {
        let _ = window.show();
    }
}

pub fn apply_autostart<R: Runtime>(app: &AppHandle<R>, enabled: bool) {
    let manager = app.autolaunch();
    let currently_enabled = manager.is_enabled().unwrap_or(false);
    if enabled == currently_enabled {
        return;
    }

    let result = if enabled {
        manager.enable()
    } else {
        manager.disable()
    };
    if let Err(err) = result {
        warn!("autostart sync failed: {err}");
    }
}

/// Registers only `scope: "global"` bindings as OS-wide hotkeys. `"local"`
/// bindings (the majority — Reload, Zoom, Copy/Paste, menu toggles, ...) are
/// intentionally skipped here; they're read by the frontend via
/// `get_keybindings` and dispatched from an in-app `keydown` listener that
/// only fires while the owning window is focused.
pub fn register_keybindings<R: Runtime>(app: &AppHandle<R>, bindings: &KeybindingsFile) {
    for binding in &bindings.bindings {
        if !binding.enabled || binding.scope != KeybindingScope::Global {
            continue;
        }

        let id = binding.id.clone();
        let shortcut = binding.shortcut.clone();
        let result = app.global_shortcut().on_shortcut(
            shortcut.as_str(),
            move |app_handle, _shortcut, event| {
                if event.state() != ShortcutState::Pressed {
                    return;
                }
                match id.as_str() {
                    "window.show" => {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "window.hide" => {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "app.quit" => {
                        crate::commands::request_quit_with_flush(app_handle);
                    }
                    other => {
                        info!("unhandled keybinding id: {other}");
                    }
                }
            },
        );

        if let Err(err) = result {
            warn!("failed to register shortcut '{}': {err}", binding.shortcut);
        }
    }
}

/// True when a settings delta needs a frontend `settings-changed` emit.
///
/// Window-only fields (`always_on_top`, `autostart`, `start_minimized`) are
/// applied in Rust and intentionally excluded so toggles do not force UI
/// re-renders.
fn ui_settings_changed(previous: &AppSettings, next: &AppSettings) -> bool {
    previous.theme != next.theme
        || previous.font_family != next.font_family
        || (previous.font_size - next.font_size).abs() > f64::EPSILON
        || previous.particle_effect != next.particle_effect
        || previous.default_profile != next.default_profile
        || previous.terminal_font_family != next.terminal_font_family
        || previous.terminal_font_size != next.terminal_font_size
        || (previous.scrollback_lines - next.scrollback_lines).abs() > f64::EPSILON
        || previous.cursor_style != next.cursor_style
        || previous.cursor_blink != next.cursor_blink
        || previous.file_icon_set != next.file_icon_set
        || previous.profiles != next.profiles
}

pub fn reload_and_apply_settings<R: Runtime>(app: &AppHandle<R>) -> Result<AppSettings, String> {
    let state = app.state::<AppState>();
    let configs_dir = state
        .configs_dir
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone()
        .ok_or_else(|| "configs dir not initialized".to_string())?;

    let previous = state
        .settings
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();
    let settings = load_settings(&configs_dir);

    {
        let mut guard = state.settings.lock().unwrap_or_else(|p| p.into_inner());
        *guard = settings.clone();
    }

    if settings.always_on_top != previous.always_on_top {
        if let Some(window) = app.get_webview_window("main") {
            apply_always_on_top(&window, &settings);
        }
    }

    if settings.autostart != previous.autostart {
        apply_autostart(app, settings.autostart);
    }

    if ui_settings_changed(&previous, &settings) {
        emit_settings_changed(app, &settings);
    }

    Ok(settings)
}

pub fn start_settings_watcher<R: Runtime>(app: AppHandle<R>, configs_dir: PathBuf) {
    let settings_path = configs_dir.join(SETTINGS_FILE);
    let logging_path = configs_dir.join(LOGGING_FILE);
    let (tx, rx) = mpsc::channel();

    thread::spawn(move || {
        let mut watcher: RecommendedWatcher = match Watcher::new(
            tx,
            notify::Config::default().with_poll_interval(Duration::from_millis(500)),
        ) {
            Ok(watcher) => watcher,
            Err(err) => {
                warn!("settings watcher failed to start: {err}");
                return;
            }
        };

        if let Err(err) = watcher.watch(&configs_dir, RecursiveMode::NonRecursive) {
            warn!("settings watcher watch failed: {err}");
            return;
        }

        info!(
            "watching settings at {} and logging at {}",
            settings_path.display(),
            logging_path.display()
        );

        let mut last_settings_apply = Instant::now()
            .checked_sub(Duration::from_secs(1))
            .unwrap_or_else(Instant::now);
        let mut last_logging_apply = Instant::now()
            .checked_sub(Duration::from_secs(1))
            .unwrap_or_else(Instant::now);
        let mut last_agent_apply = Instant::now()
            .checked_sub(Duration::from_secs(1))
            .unwrap_or_else(Instant::now);

        while let Ok(event) = rx.recv() {
            let Ok(event) = event else {
                continue;
            };

            match event.kind {
                EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_) => {}
                _ => continue,
            }

            let touches_settings = event.paths.iter().any(|path| {
                path.file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| name.eq_ignore_ascii_case(SETTINGS_FILE))
            });
            let touches_logging = event.paths.iter().any(|path| {
                path.file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| name.eq_ignore_ascii_case(LOGGING_FILE))
            });
            let touches_agent = event.paths.iter().any(|path| {
                path.file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| name.eq_ignore_ascii_case(AGENT_FILE))
            });

            if touches_settings
                && !is_settings_self_write()
                && last_settings_apply.elapsed() >= Duration::from_millis(250)
            {
                last_settings_apply = Instant::now();
                thread::sleep(Duration::from_millis(80));
                match reload_and_apply_settings(&app) {
                    Ok(_) => info!("reloaded settings.json from disk"),
                    Err(err) => warn!("settings reload failed: {err}"),
                }
            }

            if touches_logging
                && !is_logging_self_write()
                && last_logging_apply.elapsed() >= Duration::from_millis(250)
            {
                last_logging_apply = Instant::now();
                thread::sleep(Duration::from_millis(80));
                let state = app.state::<AppState>();
                let next = reload_logging_settings(&configs_dir, &state.logging);
                emit_logging_changed(&app, &next);
                info!(
                    "reloaded logging.json (app debug={}, build debug={}, agent prompts={}, agent reasoning={})",
                    next.app.debug,
                    next.build.debug,
                    next.agent.prompts,
                    next.agent.reasoning
                );
            }

            if touches_agent
                && !is_agent_self_write()
                && last_agent_apply.elapsed() >= Duration::from_millis(250)
            {
                last_agent_apply = Instant::now();
                thread::sleep(Duration::from_millis(80));
                let next = load_agent(&configs_dir);
                emit_agent_changed(&app, &next);
                info!("reloaded agent.json from disk");
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loads_repo_settings_defaults() {
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("other")
            .join("configs");
        let settings = load_settings(&dir);
        assert_eq!(settings.theme, "nord-polar-night");
        assert_eq!(settings.font_family, "Terminus");
        assert_eq!(settings.font_size, 14.0);
        assert!(!settings.autostart);
        assert!(!settings.always_on_top);
        assert_eq!(settings.default_profile, "powershell");
        assert_eq!(settings.scrollback_lines, 5000.0);
        assert_eq!(settings.cursor_style, "bar");
        assert!(settings.cursor_blink);
        assert_eq!(settings.profiles.len(), 2);
        assert_eq!(settings.profiles[0].id, "powershell");
        assert_eq!(settings.profiles[1].id, "cmd");
    }

    #[test]
    fn loads_repo_keybindings() {
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("other")
            .join("configs");
        let keys = load_keybindings(&dir);
        assert!(keys
            .bindings
            .iter()
            .any(|b| b.id == "window.show" && b.enabled));
    }

    #[test]
    fn loads_repo_appinfo() {
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("other")
            .join("configs");
        let info = load_appinfo(&dir).expect("appinfo.json");
        assert_eq!(info.identifier, "com.gensource.terminal");
        assert_eq!(info.version, "0.1.0");
        assert_eq!(info.codename, "terminal");
        assert_eq!(info.edition, Some(2026));
    }

    #[test]
    fn loads_repo_logging() {
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("other")
            .join("configs");
        let logging = load_logging(&dir);
        assert!(logging.app.error);
        assert!(logging.app.warn);
        assert!(logging.app.info);
        assert!(logging.app.debug);
        assert!(logging.app.trace);
        assert!(logging.app.fatal);
        assert!(logging.build.error);
        assert!(!logging.build.debug);
        assert!(!logging.build.trace);
        assert!(logging.agent.prompts);
        assert!(logging.agent.replies);
        assert!(logging.agent.tools);
        assert!(!logging.agent.reasoning);
    }

    #[test]
    fn migrates_legacy_top_level_logging_keys_into_app() {
        let logging = parse_logging_json(
            r#"{"error":true,"warn":true,"info":true,"debug":true,"trace":false,"fatal":true}"#,
        )
        .expect("parse legacy");
        assert!(logging.app.debug);
        assert!(!logging.app.trace);
        assert!(!logging.build.debug);
        assert!(logging.agent.prompts);
        assert!(!logging.agent.reasoning);
    }

    #[test]
    fn format_log_stem_includes_version() {
        let stem = format_log_stem("0.1.0");
        assert!(stem.ends_with("_0.1.0"), "stem={stem}");
        assert_eq!(stem.matches('-').count(), 4);
        assert_eq!(stem.matches('_').count(), 2);
    }

    #[test]
    fn merges_partial_settings() {
        let raw = r#"{"theme":"custom","fontSize":18}"#;
        let settings = merge_settings_partial(raw).expect("merge");
        assert_eq!(settings.theme, "custom");
        assert_eq!(settings.font_size, 18.0);
        assert_eq!(settings.font_family, "Terminus");
    }

    #[test]
    fn writes_pretty_camel_case_settings_roundtrip() {
        let dir = std::env::temp_dir().join(format!(
            "gensource-config-settings-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("mkdir");
        let mut settings = AppSettings::default();
        settings.theme = "nord-frost".into();
        settings.font_size = 16.0;
        write_settings(&dir, &settings).expect("write");
        let raw = fs::read_to_string(dir.join(SETTINGS_FILE)).expect("read");
        assert!(raw.contains("\"fontSize\": 16.0") || raw.contains("\"fontSize\": 16"));
        assert!(raw.contains("\"theme\": \"nord-frost\""));
        assert!(!raw.contains("//"));
        let loaded = load_settings(&dir);
        assert_eq!(loaded.theme, "nord-frost");
        assert_eq!(loaded.font_size, 16.0);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn writes_pretty_logging_and_keybindings() {
        let dir = std::env::temp_dir().join(format!(
            "gensource-config-logging-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("mkdir");
        let mut logging = LoggingSettings::default();
        logging.app.debug = true;
        write_logging(&dir, &logging).expect("write logging");
        let loaded = load_logging(&dir);
        assert!(loaded.app.debug);
        let raw = fs::read_to_string(dir.join(LOGGING_FILE)).expect("read logging");
        assert!(raw.contains("\"app\""));
        assert!(raw.contains("\"build\""));
        assert!(raw.contains("\"agent\""));

        let keys = KeybindingsFile {
            bindings: vec![crate::mdoels::Keybinding {
                id: "window.show".into(),
                shortcut: "Ctrl+Shift+T".into(),
                enabled: true,
                scope: KeybindingScope::Global,
            }],
        };
        write_keybindings(&dir, &keys).expect("write keys");
        let loaded_keys = load_keybindings(&dir);
        assert_eq!(loaded_keys.bindings.len(), 1);
        assert_eq!(loaded_keys.bindings[0].shortcut, "Ctrl+Shift+T");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn parses_jsonc_comments() {
        let raw = r#"
            // appearance
            {
              "theme": "nord-frost", /* override */
              "fontSize": 16
            }
        "#;
        let settings: AppSettings = parse_jsonc(raw).expect("jsonc");
        assert_eq!(settings.theme, "nord-frost");
        assert_eq!(settings.font_size, 16.0);
    }

    #[test]
    fn splash_background_fixed_themes() {
        assert_eq!(
            splash_background_rgb("nord-polar-night"),
            (0x2e, 0x34, 0x40)
        );
        assert_eq!(
            splash_background_rgb("nord-snow-storm"),
            (0xec, 0xef, 0xf4)
        );
        assert_eq!(
            splash_background_rgb("frost-light"),
            (0xec, 0xef, 0xf4)
        );
        assert_eq!(
            splash_background_rgb("nord-frost-dark"),
            (0x2e, 0x34, 0x40)
        );
        assert_eq!(
            splash_background_rgb("aurora-light"),
            (0xec, 0xef, 0xf4)
        );
    }

    #[test]
    fn portable_database_paths_use_other_database() {
        let chats = path_to_portable_string(&resolve_chats_db_path()).replace('\\', "/");
        let vault = path_to_portable_string(&resolve_stronghold_vault_path()).replace('\\', "/");
        let salt = path_to_portable_string(&resolve_stronghold_salt_path()).replace('\\', "/");
        assert!(
            chats.contains("other/database/sqlite/agents/chats/chats.db"),
            "chats={chats}"
        );
        assert!(
            vault.contains("other/database/stronghold/vault.hold"),
            "vault={vault}"
        );
        assert!(
            salt.contains("other/database/stronghold/salt.txt"),
            "salt={salt}"
        );
        assert!(!chats.contains("C:/Users/"), "must not hardcode a user home");
    }

    #[test]
    fn strip_agent_api_keys_clears_providers() {
        let mut config = AgentConfig::default();
        config
            .providers
            .get_mut("gemini")
            .expect("gemini")
            .api_key = "should-not-persist".into();
        strip_agent_api_keys(&mut config);
        assert!(config.active().api_key.is_empty());
    }

    #[test]
    fn strip_agent_api_keys_keeps_vault_password() {
        let mut config = AgentConfig::default();
        config.vault_password = "portable-secret".into();
        config
            .providers
            .get_mut("gemini")
            .expect("gemini")
            .api_key = "should-not-persist".into();
        strip_agent_api_keys(&mut config);
        assert!(config.active().api_key.is_empty());
        assert_eq!(config.vault_password, "portable-secret");
    }

    #[test]
    fn empty_vault_password_is_omitted_from_json() {
        let json = serde_json::to_string(&AgentConfig::default()).expect("serialize");
        assert!(
            !json.contains("vaultPassword"),
            "empty vaultPassword should skip_serializing_if: {json}"
        );
    }

    #[test]
    fn repo_root_dotenv_paths_are_portable() {
        let root = resolve_repo_root();
        let example = root.join(".env.example");
        let rendered = example.to_string_lossy().replace('\\', "/");
        assert!(
            rendered.contains(".env.example"),
            "example={rendered}"
        );
        assert!(
            !rendered.contains("C:/Users/"),
            "must not hardcode a user home: {rendered}"
        );
    }

    #[test]
    fn splash_background_unknown_defaults_dark() {
        assert_eq!(splash_background_rgb("custom"), (0x2e, 0x34, 0x40));
        assert_eq!(splash_background_rgb(""), (0x2e, 0x34, 0x40));
    }

    #[test]
    fn splash_background_os_aware_is_binary_nord() {
        let system = splash_background_rgb("system");
        let frost = splash_background_rgb("nord-frost");
        let aurora = splash_background_rgb("aurora");
        assert!(
            system == (0x2e, 0x34, 0x40) || system == (0xec, 0xef, 0xf4),
            "system={system:?}"
        );
        assert_eq!(system, frost);
        assert_eq!(system, aurora);
    }

    #[test]
    fn ui_settings_changed_ignores_window_only_fields() {
        let base = AppSettings::default();
        let mut next = base.clone();
        next.always_on_top = !base.always_on_top;
        next.autostart = !base.autostart;
        next.start_minimized = !base.start_minimized;
        assert!(!ui_settings_changed(&base, &next));
    }

    #[test]
    fn ui_settings_changed_detects_theme_and_terminal_fields() {
        let base = AppSettings::default();

        let mut theme = base.clone();
        theme.theme = "nord-frost".into();
        assert!(ui_settings_changed(&base, &theme));

        let mut font = base.clone();
        font.font_family = "Ubuntu".into();
        assert!(ui_settings_changed(&base, &font));

        let mut size = base.clone();
        size.font_size = base.font_size + 2.0;
        assert!(ui_settings_changed(&base, &size));

        let mut particles = base.clone();
        particles.particle_effect = "orbs".into();
        assert!(ui_settings_changed(&base, &particles));

        let mut icons = base.clone();
        icons.file_icon_set = "seti".into();
        assert!(ui_settings_changed(&base, &icons));

        let mut cursor = base.clone();
        cursor.cursor_style = "block".into();
        assert!(ui_settings_changed(&base, &cursor));

        let mut blink = base.clone();
        blink.cursor_blink = !base.cursor_blink;
        assert!(ui_settings_changed(&base, &blink));

        let mut scrollback = base.clone();
        scrollback.scrollback_lines = 2000.0;
        assert!(ui_settings_changed(&base, &scrollback));

        let mut profile = base.clone();
        profile.default_profile = "cmd".into();
        assert!(ui_settings_changed(&base, &profile));

        let mut term_font = base.clone();
        term_font.terminal_font_family = Some("Fira Code".into());
        assert!(ui_settings_changed(&base, &term_font));

        let mut term_size = base.clone();
        term_size.terminal_font_size = Some(18.0);
        assert!(ui_settings_changed(&base, &term_size));

        let mut profiles = base.clone();
        profiles.profiles[0].name = "PS".into();
        assert!(ui_settings_changed(&base, &profiles));
    }
}

#[cfg(test)]
mod terminal_settings_tests {
    use super::*;
    use crate::mdoels::AppSettings;

    #[test]
    fn empty_profiles_get_builtins() {
        let mut s = AppSettings::default();
        s.profiles.clear();
        normalize_terminal_settings(&mut s);
        assert_eq!(s.profiles.len(), 2);
        assert_eq!(s.profiles[0].id, "powershell");
        assert_eq!(s.profiles[1].id, "cmd");
    }

    #[test]
    fn bad_default_profile_falls_back() {
        let mut s = AppSettings::default();
        s.default_profile = "nope".into();
        normalize_terminal_settings(&mut s);
        assert_eq!(s.default_profile, "powershell");
    }

    #[test]
    fn scrollback_clamped() {
        let mut s = AppSettings::default();
        s.scrollback_lines = 1.0;
        normalize_terminal_settings(&mut s);
        assert_eq!(s.scrollback_lines, 100.0);
        s.scrollback_lines = 999_999.0;
        normalize_terminal_settings(&mut s);
        assert_eq!(s.scrollback_lines, 100_000.0);
        s.scrollback_lines = f64::NAN;
        normalize_terminal_settings(&mut s);
        assert_eq!(s.scrollback_lines, 5000.0);
    }
}
