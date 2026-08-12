//! `#[tauri::command]` handlers. Register new commands in the
//! `invoke_handler![...]` list in `lib.rs`.

use tauri::{AppHandle, Manager, State};

use crate::config;
use crate::mdoels::{AppInfo, AppSettings, Keybinding};
use crate::state::AppState;

/// Simple example command: greets `name` and tracks how many times any
/// window has called it via `AppState::greet_count`.
#[tauri::command]
pub fn greet(state: State<'_, AppState>, name: &str) -> String {
    let mut count = state
        .greet_count
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    *count += 1;
    format!("Hello, {name}! You've been greeted {count} time(s) from Rust.")
}

/// Returns application metadata from `other/configs/appinfo.json` when
/// available, otherwise falls back to the Cargo / Tauri package info.
#[tauri::command]
pub fn get_app_info(app: AppHandle, state: State<'_, AppState>) -> AppInfo {
    let configs_dir = state
        .configs_dir
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .clone();

    if let Some(dir) = configs_dir {
        if let Some(file) = config::load_appinfo(&dir) {
            return file.into_app_info();
        }
    }

    config::app_info_from_package(&app)
}

/// Returns the current in-memory settings (loaded from `settings.json`).
#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> AppSettings {
    state
        .settings
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .clone()
}

/// Reloads `settings.json` from disk, applies always-on-top/autostart, and
/// emits `settings-changed`. Useful for debugging; the file watcher also does this.
#[tauri::command]
pub fn reload_settings(app: AppHandle) -> Result<AppSettings, String> {
    config::reload_and_apply_settings(&app)
}

/// Returns every binding from `keybindings.json` so the frontend can render
/// menu shortcut labels and dispatch `local`-scope shortcuts itself.
#[tauri::command]
pub fn get_keybindings(state: State<'_, AppState>) -> Vec<Keybinding> {
    let configs_dir = state
        .configs_dir
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .clone();

    match configs_dir {
        Some(dir) => config::load_keybindings(&dir).bindings,
        None => Vec::new(),
    }
}

/// Opens `other/configs/` (dev repo path or the installed app's resource
/// path — same resolution `config::resolve_configs_dir` uses at startup) in
/// the OS file explorer. Backs the "Preferences" menu item everywhere.
#[tauri::command]
pub fn open_configs_folder(app: AppHandle) -> Result<(), String> {
    let configs_dir = config::resolve_configs_dir(&app);
    tauri_plugin_opener::open_path(&configs_dir, None::<&str>)
        .map_err(|err| format!("failed to open {}: {err}", configs_dir.display()))
}

/// Hides the main window (used by the tray flyout's "Hide" row).
#[tauri::command]
pub fn hide_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|err| err.to_string())?;
    }
    Ok(())
}

/// Exits the app (used by the tray flyout's "Quit" row).
#[tauri::command]
pub fn quit_app(app: AppHandle) {
    app.exit(0);
}
