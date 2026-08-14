//! Source Control IPC: discover/init, status, list-dir, stage/unstage/discard, commit, branches.

use tauri::{AppHandle, State};

use crate::git::{self, GitWatcher};
use crate::mdoels::{
    GitBranchInfo, GitCommitResult, GitDiffSide, GitFileDiff, GitOpenResult, GitStatusResult,
    GitTreeEntry,
};

/// Discover whether `path` (or an ancestor) is a git repository.
#[tauri::command]
pub fn git_open_folder(path: String) -> Result<GitOpenResult, String> {
    git::open_folder(path.trim())
}

/// Initialize a new repository with a worktree at `path`.
#[tauri::command]
pub fn git_init(path: String) -> Result<GitOpenResult, String> {
    git::init_repo(path.trim())
}

/// Collect staged / unstaged / untracked / conflicted paths for the repo at `path`.
#[tauri::command]
pub fn git_status(path: String) -> Result<GitStatusResult, String> {
    git::status(path.trim())
}

/// List one worktree directory with git decorations. `dir` defaults to the root.
#[tauri::command]
pub fn git_list_dir(path: String, dir: Option<String>) -> Result<Vec<GitTreeEntry>, String> {
    git::list_dir(path.trim(), dir.as_deref().unwrap_or(""))
}

/// Stage the given paths into the index (`path` = any path inside the repo).
#[tauri::command]
pub fn git_stage(path: String, paths: Vec<String>) -> Result<(), String> {
    git::stage(path.trim(), &paths)
}

/// Unstage the given paths (restore index from HEAD for those paths).
#[tauri::command]
pub fn git_unstage(path: String, paths: Vec<String>) -> Result<(), String> {
    git::unstage(path.trim(), &paths)
}

/// Discard changes for paths (restore index + worktree from HEAD, or delete untracked).
#[tauri::command]
pub fn git_discard(path: String, paths: Vec<String>) -> Result<(), String> {
    git::discard(path.trim(), &paths)
}

/// Create a commit from the current index with `message`.
#[tauri::command]
pub fn git_commit(path: String, message: String) -> Result<GitCommitResult, String> {
    git::commit(path.trim(), &message)
}

/// List local branches for the repository at `path`.
#[tauri::command]
pub fn git_branches(path: String) -> Result<Vec<GitBranchInfo>, String> {
    git::branches(path.trim())
}

/// Check out an existing local branch.
#[tauri::command]
pub fn git_checkout(path: String, branch: String) -> Result<(), String> {
    git::checkout(path.trim(), branch.trim())
}

/// Create a local branch from HEAD; optionally check it out.
#[tauri::command]
pub fn git_create_branch(path: String, name: String, checkout: bool) -> Result<(), String> {
    git::create_branch(path.trim(), name.trim(), checkout)
}

/// Start a recursive worktree watch; emits debounced `scm-changed` events.
/// Stops any previous watch first. `path` may be any path inside the repo.
#[tauri::command]
pub fn git_watch_start(
    app: AppHandle,
    watcher: State<'_, GitWatcher>,
    path: String,
) -> Result<(), String> {
    let root = git::resolve_worktree_root(path.trim())?;
    watcher.start(app, root)
}

/// Stop the active SCM worktree watch, if any.
#[tauri::command]
pub fn git_watch_stop(watcher: State<'_, GitWatcher>) -> Result<(), String> {
    watcher.stop();
    Ok(())
}

/// Unified per-file diff (`filePath` + `side` from the webview).
#[tauri::command(rename_all = "camelCase")]
pub fn git_file_diff(
    path: String,
    file_path: String,
    side: GitDiffSide,
) -> Result<GitFileDiff, String> {
    git::file_diff(path.trim(), file_path.trim(), side)
}
