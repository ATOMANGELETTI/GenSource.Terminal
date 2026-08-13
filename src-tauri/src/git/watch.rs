//! Debounced worktree file watcher for Source Control live refresh.
//! Emits `scm-changed` only — staging stays on the frontend.

use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::Mutex;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use log::{info, warn};
use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Runtime};

/// Frontend event name for worktree FS changes (debounced).
pub const SCM_CHANGED_EVENT: &str = "scm-changed";

const DEBOUNCE: Duration = Duration::from_millis(400);
const POLL_INTERVAL: Duration = Duration::from_millis(500);
const STOP_POLL: Duration = Duration::from_millis(100);

/// Payload for [`SCM_CHANGED_EVENT`].
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScmChangedPayload {
    /// Absolute worktree root being watched.
    pub root: String,
}

/// Managed app state: at most one recursive worktree watch at a time.
#[derive(Default)]
pub struct GitWatcher {
    inner: Mutex<Option<ActiveWatch>>,
}

struct ActiveWatch {
    root: PathBuf,
    /// Dropping the watcher disconnects the notify channel and ends the loop.
    watcher: RecommendedWatcher,
    stop_tx: mpsc::Sender<()>,
    join: Option<JoinHandle<()>>,
}

impl GitWatcher {
    /// Stop any prior watch, then recursively watch `root` (git worktree).
    pub fn start<R: Runtime>(&self, app: AppHandle<R>, root: PathBuf) -> Result<(), String> {
        self.stop();

        let (event_tx, event_rx) = mpsc::channel();
        let (stop_tx, stop_rx) = mpsc::channel();

        let mut watcher: RecommendedWatcher = Watcher::new(
            event_tx,
            notify::Config::default().with_poll_interval(POLL_INTERVAL),
        )
        .map_err(|err| format!("git watcher failed to start: {err}"))?;

        watcher
            .watch(&root, RecursiveMode::Recursive)
            .map_err(|err| format!("git watcher watch failed: {err}"))?;

        let root_display = root.display().to_string();
        let root_for_emit = root.clone();
        let join = thread::spawn(move || {
            info!("watching scm worktree at {root_display}");
            let mut last_emit = Instant::now()
                .checked_sub(DEBOUNCE)
                .unwrap_or_else(Instant::now);

            loop {
                if stop_rx.try_recv().is_ok() {
                    break;
                }

                match event_rx.recv_timeout(STOP_POLL) {
                    Ok(Ok(event)) => {
                        match event.kind {
                            EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_) => {}
                            _ => continue,
                        }

                        if !event_touches_worktree(&event.paths) {
                            continue;
                        }

                        if last_emit.elapsed() < DEBOUNCE {
                            continue;
                        }
                        last_emit = Instant::now();

                        let payload = ScmChangedPayload {
                            root: root_for_emit.to_string_lossy().into_owned(),
                        };
                        if let Err(err) = app.emit(SCM_CHANGED_EVENT, &payload) {
                            warn!("failed to emit {SCM_CHANGED_EVENT}: {err}");
                        }
                    }
                    Ok(Err(err)) => {
                        warn!("git watcher event error: {err}");
                    }
                    Err(RecvTimeoutError::Timeout) => {}
                    Err(RecvTimeoutError::Disconnected) => break,
                }
            }

            info!("stopped scm watch at {root_display}");
        });

        let mut guard = self.inner.lock().unwrap_or_else(|p| p.into_inner());
        *guard = Some(ActiveWatch {
            root,
            watcher,
            stop_tx,
            join: Some(join),
        });
        Ok(())
    }

    /// Drop the active watcher and join the background thread.
    pub fn stop(&self) {
        let mut guard = self.inner.lock().unwrap_or_else(|p| p.into_inner());
        let Some(mut active) = guard.take() else {
            return;
        };
        let _ = active.stop_tx.send(());
        drop(active.watcher);
        if let Some(join) = active.join.take() {
            let _ = join.join();
        }
        let _ = active.root;
    }
}

/// True when at least one path is outside any `.git` directory component.
fn event_touches_worktree(paths: &[PathBuf]) -> bool {
    if paths.is_empty() {
        // Some platforms emit empty path lists; treat as a worktree change.
        return true;
    }
    paths.iter().any(|path| !path_is_inside_dot_git(path))
}

fn path_is_inside_dot_git(path: &Path) -> bool {
    path.components().any(|c| c.as_os_str() == ".git")
}

/// Discover the git worktree root for `path` (any path inside the repo).
pub fn resolve_worktree_root(path: impl AsRef<Path>) -> Result<PathBuf, String> {
    let repo = super::open_repo(path)?;
    super::workdir(&repo)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_dot_git_paths() {
        assert!(path_is_inside_dot_git(Path::new(r"C:\repo\.git\index")));
        assert!(path_is_inside_dot_git(Path::new("/repo/.git/objects/ab")));
        assert!(!path_is_inside_dot_git(Path::new(r"C:\repo\src\main.rs")));
        assert!(!path_is_inside_dot_git(Path::new("/repo/README.md")));
    }

    #[test]
    fn empty_paths_count_as_worktree_touch() {
        assert!(event_touches_worktree(&[]));
        assert!(!event_touches_worktree(&[PathBuf::from("/repo/.git/index")]));
        assert!(event_touches_worktree(&[
            PathBuf::from("/repo/.git/index"),
            PathBuf::from("/repo/src/a.rs"),
        ]));
    }
}
