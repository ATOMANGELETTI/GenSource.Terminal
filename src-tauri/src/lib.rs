//! GenSource Terminal Tauri v2 app library. Registers all desktop plugins,
//! shared state, and IPC commands, then hands off to the Tauri runtime.

// Prebuilt libsodium (via tauri-plugin-stronghold) emits MSVC LNK4099/LNK4098
// on Windows debug links; allow until upstream ships matching PDBs/CRT.
#![cfg_attr(all(windows, target_env = "msvc"), allow(linker_messages))]

#[path = "commands/commands.rs"]
mod commands;
mod config;
mod logging;
#[path = "mdoels/models.rs"]
mod mdoels;
mod pty;
#[path = "state/state.rs"]
mod state;

use std::sync::{Arc, RwLock};

use log::LevelFilter;
use tauri::image::Image;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, RunEvent, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_log::{Target, TargetKind};
use tauri_plugin_positioner::{Position, WindowExt};

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Single-instance must be registered before any other plugin so it can
    // observe the deep-link argv on a second launch. Desktop-only: there is
    // no concept of "another instance" on mobile.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            log::info!("second instance launched with args: {argv:?}");
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));
    }

    let early_configs = config::resolve_other_subdir("configs");
    let _ = config::ensure_config_files(&early_configs);
    let _ = config::ensure_logging_dirs();

    let logging_settings = Arc::new(RwLock::new(config::load_logging(&early_configs)));
    let log_filter_state = Arc::clone(&logging_settings);
    // Seed settings before windows/commands run so packaged splash cannot
    // race `.setup` and lock onto AppSettings::default() (polar-night).
    let early_settings = config::load_settings(&early_configs);

    let package_version = env!("CARGO_PKG_VERSION");
    let log_version = config::resolve_log_version(&early_configs, package_version);
    // Include the `.log` suffix in `file_name`: tauri-plugin-log calls
    // `Path::with_extension("log")`, which would otherwise replace the last
    // semver segment (e.g. `0.1.0` → `0.1.log`).
    let log_file_name = format!("{}.log", config::format_log_stem(&log_version));
    let app_log_dir = config::resolve_logging_app_dir();

    builder = builder
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(if cfg!(debug_assertions) {
                    LevelFilter::Debug
                } else {
                    LevelFilter::Info
                })
                .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepOne)
                .max_file_size(10_000_000)
                .filter(move |metadata| {
                    let guard = log_filter_state
                        .read()
                        .unwrap_or_else(|poisoned| poisoned.into_inner());
                    logging::allows(&guard, metadata)
                })
                .clear_targets()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::Folder {
                        path: app_log_dir,
                        file_name: Some(log_file_name),
                    }),
                ])
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        // Ephemeral windows must not be restored: tray-menu is a flyout that
        // should only appear on right-click; splash is a one-shot boot screen.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_denylist(&["tray-menu", "splash"])
                .build(),
        )
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        // `plugins.updater` in tauri.conf.json must include `pubkey` (required
        // by the plugin Config deserializer) or startup fails. Placeholder
        // empty pubkey/endpoints are fine for template builds; set a real
        // pubkey and endpoints (or Builder `.pubkey()`/`.endpoints()`) before
        // shipping updates.
        .plugin(tauri_plugin_updater::Builder::new().build())
        // SQLite database is opened lazily from the frontend, e.g.
        // `Database.load("sqlite:gensource.db")`; the path resolves under
        // the app's data directory (see `fs`/`sql` capability scopes).
        .plugin(tauri_plugin_sql::Builder::new().build())
        // Synced from settings.json `autostart` on startup / settings reload.
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_websocket::init())
        .plugin(tauri_plugin_cli::init())
        .manage(AppState::new(
            Arc::clone(&logging_settings),
            early_settings,
            Some(early_configs.clone()),
        ))
        .manage(Arc::new(pty::PtySessionPool::default()))
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::get_app_info,
            commands::get_settings,
            commands::reload_settings,
            commands::get_keybindings,
            commands::open_configs_folder,
            commands::hide_main_window,
            commands::quit_app,
            commands::pty_create,
            commands::pty_write,
            commands::pty_resize,
            commands::pty_kill,
        ])
        .setup(|app| {
            // Stronghold needs a filesystem path for its key-derivation
            // salt, which is only resolvable once the app handle exists, so
            // it is registered here instead of the plugin chain above.
            // Vaults are opened lazily via the `stronghold.initialize`
            // frontend/JS command with a user-supplied password — nothing
            // here touches disk or panics at startup.
            let salt_path = app
                .path()
                .app_local_data_dir()
                .expect("app_local_data_dir should be resolvable")
                .join("stronghold-salt.txt");
            app.handle()
                .plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build())?;

            // Register all desktop deep-link schemes at runtime too, so
            // `gensource://...` works for unpackaged dev builds on Windows
            // and Linux (macOS relies solely on the static config).
            #[cfg(any(windows, target_os = "linux"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = app.deep_link().register_all();
            }

            let configs_dir = config::resolve_configs_dir(app.handle());
            if let Err(err) = config::ensure_config_files(&configs_dir) {
                log::warn!("ensure config files: {err}");
            }
            if let Err(err) = config::ensure_logging_dirs() {
                log::warn!("ensure logging dirs: {err}");
            }

            let settings = config::load_settings(&configs_dir);
            let keybindings = config::load_keybindings(&configs_dir);
            let logging = config::load_logging(&configs_dir);
            let product_name = config::load_appinfo(&configs_dir)
                .map(|info| {
                    if !info.product_name.trim().is_empty() {
                        info.product_name
                    } else {
                        info.name
                    }
                })
                .unwrap_or_else(|| "GenSource Terminal".into());

            {
                let state = app.state::<AppState>();
                *state
                    .configs_dir
                    .lock()
                    .unwrap_or_else(|p| p.into_inner()) = Some(configs_dir.clone());
                *state.settings.lock().unwrap_or_else(|p| p.into_inner()) = settings.clone();
                config::apply_logging_settings(&state.logging, logging);
            }

            // Theme-correct native bg, then show (splash starts hidden to avoid
            // WebView2's default white surface while Vite/CSS load).
            config::reveal_splash_window(app.handle(), &settings.theme);

            // Main stays hidden until the splash window finishes its hybrid
            // boot handoff (see SplashWindow). Force-hide in case
            // window-state restored visibility from a prior session.
            // startMinimized is honored by the splash when revealing main.
            if let Some(window) = app.get_webview_window("main") {
                config::apply_always_on_top(&window, &settings);
                let _ = window.hide();
            }
            // Tray flyout must stay hidden until an explicit right-click
            // (denylist above prevents restore; this covers any edge case).
            if let Some(menu) = app.get_webview_window("tray-menu") {
                let _ = menu.hide();
            }

            config::apply_autostart(app.handle(), settings.autostart);
            config::register_keybindings(app.handle(), &keybindings);
            config::emit_settings_changed(app.handle(), &settings);
            config::start_settings_watcher(app.handle().clone(), configs_dir);

            log::info!("application logging initialized");

            // System tray uses the bundled PNG (RGBA) so the notification-area
            // glyph stays sharp with transparency on Windows. The right-click
            // menu is a real flat-styled window (`tray-menu`, declared in
            // tauri.conf.json) instead of a native OS menu, so it always
            // matches the app's own theme. Left click still shows/focuses
            // `main`, matching common tray UX.
            let tray_icon = Image::from_bytes(include_bytes!("../icons/32x32.png"))?;

            TrayIconBuilder::new()
                .icon(tray_icon)
                .tooltip(&product_name)
                .on_tray_icon_event(|tray, event| {
                    let app = tray.app_handle();
                    // Required by tauri-plugin-positioner to know where the
                    // tray icon is before `Position::TrayCenter` can be used.
                    tauri_plugin_positioner::on_tray_event(app, &event);

                    match event {
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        TrayIconEvent::Click {
                            button: MouseButton::Right,
                            button_state: MouseButtonState::Up,
                            ..
                        } => {
                            if let Some(menu) = app.get_webview_window("tray-menu") {
                                let _ = menu.as_ref().window().move_window(Position::TrayCenter);
                                let _ = menu.show();
                                let _ = menu.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // Dismiss the tray flyout as soon as it loses focus (clicking
            // elsewhere, or an item invoking a command) instead of closing
            // it, so the next right-click reopens instantly.
            if let Some(menu) = app.get_webview_window("tray-menu") {
                let hideable = menu.clone();
                menu.on_window_event(move |event| {
                    if let WindowEvent::Focused(false) = event {
                        let _ = hideable.hide();
                    }
                });
            }

            Ok(())
        });

    builder
        .build(tauri::generate_context!())
        .expect("error while building the GenSource Terminal app")
        .run(|app_handle, event| {
            match event {
                RunEvent::ExitRequested { .. } => {
                    log::info!("GenSource Terminal is exiting");
                    if let Some(pool) = app_handle.try_state::<Arc<pty::PtySessionPool>>() {
                        pool.kill_all();
                    }
                }
                RunEvent::Exit => {
                    if let Some(pool) = app_handle.try_state::<Arc<pty::PtySessionPool>>() {
                        pool.kill_all();
                    }
                }
                _ => {}
            }
        });
}
