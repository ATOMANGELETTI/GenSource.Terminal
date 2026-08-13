//! Source Control IPC: discover/init, status, stage/unstage/discard, commit, branches.

use crate::git;
use crate::mdoels::{
    GitBranchInfo, GitCommitResult, GitOpenResult, GitStatusResult,
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
