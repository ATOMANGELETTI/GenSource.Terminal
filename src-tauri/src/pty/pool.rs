//! `PtySessionPool` — spawn/read/write/resize/kill ConPTY sessions.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::thread;

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

use crate::config;
use crate::mdoels::{AppSettings, PtyExitEvent, PtyOutputEvent};

pub struct PtySessionPool {
    inner: Mutex<HashMap<String, SessionHandles>>,
}

struct SessionHandles {
    master: Box<dyn MasterPty + Send>,
    writer: Mutex<Box<dyn Write + Send>>,
    killer: Mutex<Box<dyn portable_pty::ChildKiller + Send + Sync>>,
}

impl Default for PtySessionPool {
    fn default() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }
}

impl PtySessionPool {
    pub fn create(
        &self,
        app: &AppHandle,
        settings: &AppSettings,
        profile_id: &str,
        cols: u16,
        rows: u16,
    ) -> Result<String, String> {
        let profile = settings
            .profiles
            .iter()
            .find(|p| p.id == profile_id)
            .cloned()
            .ok_or_else(|| format!("profile not found: {profile_id}"))?;

        let session_id = Uuid::new_v4().to_string();
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: rows.max(1),
                cols: cols.max(1),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("failed to open pty: {e}"))?;

        let mut cmd = CommandBuilder::new(&profile.command);
        for arg in &profile.args {
            cmd.arg(arg);
        }
        if is_powershell_command(&profile.command) {
            inject_powershell_nord_prompt(&mut cmd, &profile.args, &settings.theme);
        }
        if let Some(dir) = profile
            .starting_directory
            .as_deref()
            .filter(|s| !s.is_empty())
        {
            cmd.cwd(dir);
        } else if let Some(home) = dirs_home() {
            cmd.cwd(home);
        }

        let mut child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("failed to spawn {}: {e}", profile.command))?;
        let killer = child.clone_killer();
        // Drop the slave so the child can receive EOF when the master closes.
        drop(pair.slave);

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("failed to clone pty reader: {e}"))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("failed to take pty writer: {e}"))?;

        {
            let mut map = self.inner.lock().map_err(|e| e.to_string())?;
            map.insert(
                session_id.clone(),
                SessionHandles {
                    master: pair.master,
                    writer: Mutex::new(writer),
                    killer: Mutex::new(killer),
                },
            );
        }

        let app_out = app.clone();
        let id_out = session_id.clone();
        thread::spawn(move || {
            let mut buf = [0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = app_out.emit(
                            "pty-output",
                            PtyOutputEvent {
                                session_id: id_out.clone(),
                                data,
                            },
                        );
                    }
                    Err(_) => break,
                }
            }
            let code = child.wait().ok().map(|s| s.exit_code() as i32);
            let _ = app_out.emit(
                "pty-exit",
                PtyExitEvent {
                    session_id: id_out.clone(),
                    code,
                },
            );
            if let Some(pool) = app_out.try_state::<Arc<PtySessionPool>>() {
                pool.remove(&id_out);
            }
        });

        Ok(session_id)
    }

    pub fn write(&self, session_id: &str, data: &str) -> Result<(), String> {
        let map = self.inner.lock().map_err(|e| e.to_string())?;
        let session = map
            .get(session_id)
            .ok_or_else(|| format!("session not found: {session_id}"))?;
        let mut writer = session.writer.lock().map_err(|e| e.to_string())?;
        writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("pty write failed: {e}"))?;
        writer
            .flush()
            .map_err(|e| format!("pty flush failed: {e}"))?;
        Ok(())
    }

    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let map = self.inner.lock().map_err(|e| e.to_string())?;
        let session = map
            .get(session_id)
            .ok_or_else(|| format!("session not found: {session_id}"))?;
        session
            .master
            .resize(PtySize {
                rows: rows.max(1),
                cols: cols.max(1),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("pty resize failed: {e}"))
    }

    pub fn kill(&self, session_id: &str) -> Result<(), String> {
        let mut map = self.inner.lock().map_err(|e| e.to_string())?;
        if let Some(session) = map.remove(session_id) {
            let mut killer = session.killer.lock().map_err(|e| e.to_string())?;
            let _ = killer.kill();
        }
        Ok(())
    }

    pub fn kill_all(&self) {
        if let Ok(mut map) = self.inner.lock() {
            for (_, session) in map.drain() {
                if let Ok(mut killer) = session.killer.lock() {
                    let _ = killer.kill();
                }
            }
        }
    }

    pub fn remove(&self, session_id: &str) {
        if let Ok(mut map) = self.inner.lock() {
            map.remove(session_id);
        }
    }
}

fn dirs_home() -> Option<std::path::PathBuf> {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(std::path::PathBuf::from)
}

fn is_powershell_command(command: &str) -> bool {
    let name = Path::new(command)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(command);
    let lower = name.to_ascii_lowercase();
    matches!(
        lower.as_str(),
        "powershell.exe" | "powershell" | "pwsh.exe" | "pwsh"
    )
}

/// True when profile args already drive `-Command` / `-File` (skip prompt inject).
fn powershell_args_own_entry(args: &[String]) -> bool {
    args.iter().any(|arg| {
        let lower = arg.to_ascii_lowercase();
        lower == "-command"
            || lower == "-c"
            || lower.starts_with("-command:")
            || lower == "-encodedcommand"
            || lower == "-ec"
            || lower == "-file"
            || lower == "-f"
            || lower.starts_with("-file:")
    })
}

fn quote_powershell_single(path: &str) -> String {
    format!("'{}'", path.replace('\'', "''"))
}

/// Dot-source bundled Nord powerline prompt; set `GENSOURCE_THEME` from app settings.
/// Keeps existing `-NoLogo`; adds process-scoped `-ExecutionPolicy Bypass`, `-NoProfile`,
/// and `-NoExit -Command` when the script is present. Does not change machine/user policy.
fn inject_powershell_nord_prompt(cmd: &mut CommandBuilder, profile_args: &[String], theme: &str) {
    cmd.env("GENSOURCE_THEME", theme);

    if powershell_args_own_entry(profile_args) {
        return;
    }

    let script = config::resolve_other_subdir("prompts").join("nord-powerline.ps1");
    if !script.is_file() {
        return;
    }

    let path = script.to_string_lossy();
    let load = format!(". {}", quote_powershell_single(path.as_ref()));
    // Process-scoped only — allows bundling unsigned nord-powerline.ps1 without
    // Set-ExecutionPolicy. -NoProfile keeps user profiles from fighting prompt init
    // (injection already skips when the profile owns -Command/-File).
    cmd.arg("-ExecutionPolicy");
    cmd.arg("Bypass");
    cmd.arg("-NoProfile");
    cmd.arg("-NoExit");
    cmd.arg("-Command");
    cmd.arg(load);
}
