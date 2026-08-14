//! Pure-Rust gitoxide (`gix`) helpers for the Source Control panel.
//! No system `git.exe` — local discover/init/status/index/commit/branch ops.

mod diff;
mod watch;

pub use diff::file_diff;
pub use watch::{resolve_worktree_root, GitWatcher};

use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Component, Path, PathBuf};

use gix::bstr::{BStr, BString, ByteSlice};
use gix::diff::index::Change as TreeIndexChange;
use gix::objs::tree::EntryKind;
use gix::refs::transaction::{Change, LogChange, PreviousValue, RefEdit, RefLog};
use gix::refs::{FullName, Target};
use gix::status::index_worktree::iter::Summary as IwSummary;
use gix::{ObjectId, Repository};

use crate::mdoels::{
    GitBranchInfo, GitChangeStatus, GitCommitResult, GitOpenResult, GitStatusEntry, GitStatusResult,
    GitTreeDecoration, GitTreeEntry, GitTreeEntryKind,
};

/// Discover whether `path` (or an ancestor) is a git worktree and return SCM metadata.
pub fn open_folder(path: impl AsRef<Path>) -> Result<GitOpenResult, String> {
    let folder = normalize_existing_dir(path)?;
    let folder_path = path_to_string(&folder);

    match gix::discover(&folder) {
        Ok(repo) => open_result_from_repo(repo, folder_path),
        Err(_) => Ok(GitOpenResult {
            folder_path: folder_path.clone(),
            root: folder_path,
            is_repo: false,
            branch: None,
            head: None,
            ahead: None,
            behind: None,
        }),
    }
}

/// Initialize a repository with a worktree at `path`.
pub fn init_repo(path: impl AsRef<Path>) -> Result<GitOpenResult, String> {
    let folder = normalize_existing_dir(path)?;
    let folder_path = path_to_string(&folder);
    let repo = gix::init(&folder).map_err(|err| format!("git init failed: {err}"))?;
    open_result_from_repo(repo, folder_path)
}

/// Status lists for the worktree at `repo_path` (any path inside the repo).
pub fn status(repo_path: impl AsRef<Path>) -> Result<GitStatusResult, String> {
    let repo = open_repo(repo_path)?;
    let workdir = workdir(&repo)?;
    let mut result = GitStatusResult::default();

    let iter = repo
        .status(gix::progress::Discard)
        .map_err(|err| format!("status platform: {err}"))?
        .into_iter(std::iter::empty::<BString>())
        .map_err(|err| format!("status iterator: {err}"))?;

    for item in iter {
        let item = item.map_err(|err| format!("status item: {err}"))?;
        match item {
            gix::status::Item::TreeIndex(change) => {
                let (status, path) = map_tree_index_change(&change);
                result.staged.push(make_entry(&workdir, path, status));
            }
            gix::status::Item::IndexWorktree(change) => {
                let Some(summary) = change.summary() else {
                    continue;
                };
                let path = bstr_to_string(change.rela_path());
                match summary {
                    IwSummary::Added => {
                        result
                            .untracked
                            .push(make_entry(&workdir, path, GitChangeStatus::Untracked));
                    }
                    IwSummary::Removed => {
                        result
                            .unstaged
                            .push(make_entry(&workdir, path, GitChangeStatus::Deleted));
                    }
                    IwSummary::Modified => {
                        result
                            .unstaged
                            .push(make_entry(&workdir, path, GitChangeStatus::Modified));
                    }
                    IwSummary::TypeChange => {
                        result
                            .unstaged
                            .push(make_entry(&workdir, path, GitChangeStatus::TypeChange));
                    }
                    IwSummary::Renamed => {
                        result
                            .unstaged
                            .push(make_entry(&workdir, path, GitChangeStatus::Renamed));
                    }
                    IwSummary::Copied => {
                        result
                            .unstaged
                            .push(make_entry(&workdir, path, GitChangeStatus::Copied));
                    }
                    IwSummary::IntentToAdd => {
                        result
                            .unstaged
                            .push(make_entry(&workdir, path, GitChangeStatus::IntentToAdd));
                    }
                    IwSummary::Conflict => {
                        result
                            .conflicted
                            .push(make_entry(&workdir, path, GitChangeStatus::Conflict));
                    }
                }
            }
        }
    }

    sort_entries(&mut result.staged);
    sort_entries(&mut result.unstaged);
    sort_entries(&mut result.untracked);
    sort_entries(&mut result.conflicted);
    Ok(result)
}

/// List one worktree directory with git decorations (not a full-repo walk).
/// `dir` is a worktree-relative `/` path or absolute path under the worktree;
/// empty/`None` lists the worktree root. `.git` is hidden. Ignored paths are
/// included so expanding a parent can show grayed `target/`-style dirs.
pub fn list_dir(repo_path: impl AsRef<Path>, dir: &str) -> Result<Vec<GitTreeEntry>, String> {
    let repo = open_repo(repo_path)?;
    let workdir = workdir(&repo)?;
    let (abs_dir, rela_dir) = resolve_list_dir(&workdir, dir)?;

    let maps = StatusMaps::from_status(status(&workdir)?);
    let index = mutable_index(&repo)?;
    let mut excludes = repo
        .excludes(
            &index,
            None,
            gix::worktree::stack::state::ignore::Source::WorktreeThenIdMappingIfNotSkipped,
        )
        .map_err(|err| format!("excludes stack: {err}"))?;

    let mut seen: HashSet<String> = HashSet::new();
    let mut entries: Vec<GitTreeEntry> = Vec::new();

    match fs::read_dir(&abs_dir) {
        Ok(read_dir) => {
            for entry in read_dir {
                let entry = match entry {
                    Ok(e) => e,
                    Err(_) => continue,
                };
                let name = entry.file_name().to_string_lossy().into_owned();
                if name.is_empty() || name == ".git" {
                    continue;
                }
                let meta = match entry.metadata() {
                    Ok(m) => m,
                    Err(_) => continue,
                };
                let is_dir = meta.is_dir();
                if !is_dir && !(meta.is_file() || meta.is_symlink()) {
                    continue;
                }
                let child_rela = join_rela(&rela_dir, &name);
                let classified = classify_tree_entry(
                    &workdir,
                    &name,
                    &child_rela,
                    is_dir,
                    &maps,
                    &index,
                    &mut excludes,
                );
                seen.insert(name.to_ascii_lowercase());
                entries.push(classified);
            }
        }
        Err(err) => {
            if !abs_dir.exists() && has_status_under(&maps, &rela_dir) {
                // Deleted-only directory: still list injected status children.
            } else {
                return Err(format!("failed to list {}: {err}", abs_dir.display()));
            }
        }
    }

    inject_missing_status_children(
        &workdir,
        &rela_dir,
        &maps,
        &index,
        &mut excludes,
        &mut seen,
        &mut entries,
    );

    sort_tree_entries(&mut entries);
    Ok(entries)
}

/// Stage paths (repo-relative `/` or absolute under the worktree).
/// Directory paths expand to nested files (skipping `.git` and empty dirs).
pub fn stage(repo_path: impl AsRef<Path>, paths: &[String]) -> Result<(), String> {
    let repo = open_repo(repo_path)?;
    let workdir = workdir(&repo)?;
    let rela_paths = normalize_paths(&workdir, paths)?;
    let mut index = mutable_index(&repo)?;
    let (mut pipeline, _) = repo
        .filter_pipeline(None)
        .map_err(|err| format!("filter pipeline: {err}"))?;

    for rela in &rela_paths {
        let rela_bstr: &BStr = rela.as_bytes().as_bstr();
        let abs = workdir.join(gix::path::from_bstr(rela_bstr));
        if !abs.exists() {
            remove_path_from_index(&mut index, rela_bstr);
            continue;
        }

        let meta = fs::symlink_metadata(&abs)
            .map_err(|err| format!("stat {}: {err}", abs.display()))?;
        if meta.is_dir() {
            for file_rela in expand_dir_to_files(&workdir, rela)? {
                stage_one_file(&workdir, &mut pipeline, &mut index, &file_rela)?;
            }
            continue;
        }

        stage_one_file(&workdir, &mut pipeline, &mut index, rela)?;
    }

    index.sort_entries();
    write_index(&mut index)
}

/// Stage a single worktree file into `index` via the filter pipeline.
fn stage_one_file(
    workdir: &Path,
    pipeline: &mut gix::filter::Pipeline<'_>,
    index: &mut gix::index::File,
    rela: &str,
) -> Result<(), String> {
    let rela_bstr: &BStr = rela.as_bytes().as_bstr();
    let abs = workdir.join(gix::path::from_bstr(rela_bstr));

    let Some((id, kind, _md)) = pipeline
        .worktree_file_to_object(rela_bstr, index)
        .map_err(|err| format!("stage {rela}: {err}"))?
    else {
        return Err(format!("cannot stage {rela}: unsupported type"));
    };

    let fs_meta = gix::index::fs::Metadata::from_path_no_follow(&abs)
        .map_err(|err| format!("stat {}: {err}", abs.display()))?;
    let stat = gix::index::entry::Stat::from_fs(&fs_meta)
        .map_err(|err| format!("index stat {rela}: {err}"))?;
    let mode = mode_from_kind(kind);

    remove_path_from_index(index, rela_bstr);
    index.dangerously_push_entry(
        stat,
        id,
        gix::index::entry::Flags::empty(),
        mode,
        rela_bstr,
    );
    Ok(())
}

/// Recursively collect repo-relative `/` file paths under `rela_dir`.
/// Skips `.git` directories; empty directories yield an empty list.
fn expand_dir_to_files(workdir: &Path, rela_dir: &str) -> Result<Vec<String>, String> {
    let abs = workdir.join(gix::path::from_bstr(rela_dir.as_bytes().as_bstr()));
    let mut files = Vec::new();
    collect_dir_files(workdir, &abs, &mut files)?;
    Ok(files)
}

fn collect_dir_files(workdir: &Path, dir: &Path, out: &mut Vec<String>) -> Result<(), String> {
    let entries = fs::read_dir(dir)
        .map_err(|err| format!("read dir {}: {err}", dir.display()))?;
    for entry in entries {
        let entry = entry.map_err(|err| format!("read dir entry in {}: {err}", dir.display()))?;
        let name = entry.file_name();
        if name == ".git" {
            continue;
        }
        let path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|err| format!("file type {}: {err}", path.display()))?;
        if file_type.is_dir() {
            collect_dir_files(workdir, &path, out)?;
            continue;
        }
        let rela = path
            .strip_prefix(workdir)
            .map_err(|_| {
                format!(
                    "{} is outside the repository worktree {}",
                    path.display(),
                    workdir.display()
                )
            })?
            .components()
            .map(|c| c.as_os_str().to_string_lossy())
            .collect::<Vec<_>>()
            .join("/");
        if !rela.is_empty() {
            out.push(rela);
        }
    }
    Ok(())
}

/// Unstage paths (restore index entries from HEAD, or drop newly added paths).
pub fn unstage(repo_path: impl AsRef<Path>, paths: &[String]) -> Result<(), String> {
    let repo = open_repo(repo_path)?;
    let workdir = workdir(&repo)?;
    let rela_paths = normalize_paths(&workdir, paths)?;
    let mut index = mutable_index(&repo)?;
    let head_index = head_tree_index(&repo)?;

    for rela in &rela_paths {
        let rela_bstr: &BStr = rela.as_bytes().as_bstr();
        remove_path_from_index(&mut index, rela_bstr);

        if let Some(head_index) = head_index.as_ref() {
            if let Some(entry) = head_index.entry_by_path_and_stage(
                rela_bstr,
                gix::index::entry::Stage::Unconflicted,
            ) {
                index.dangerously_push_entry(
                    entry.stat,
                    entry.id,
                    gix::index::entry::Flags::empty(),
                    entry.mode,
                    rela_bstr,
                );
            }
        }
    }

    index.sort_entries();
    write_index(&mut index)
}

/// Discard changes for paths: restore index + worktree from HEAD, or delete untracked files.
pub fn discard(repo_path: impl AsRef<Path>, paths: &[String]) -> Result<(), String> {
    let repo = open_repo(repo_path)?;
    let workdir = workdir(&repo)?;
    let rela_paths = normalize_paths(&workdir, paths)?;
    let mut index = mutable_index(&repo)?;
    let head_index = head_tree_index(&repo)?;

    for rela in &rela_paths {
        let rela_bstr: &BStr = rela.as_bytes().as_bstr();
        let abs = workdir.join(gix::path::from_bstr(rela_bstr));

        let head_entry = head_index.as_ref().and_then(|hi| {
            hi.entry_by_path_and_stage(rela_bstr, gix::index::entry::Stage::Unconflicted)
                .cloned()
        });

        remove_path_from_index(&mut index, rela_bstr);

        if let Some(entry) = head_entry {
            restore_worktree_blob(&repo, &workdir, rela_bstr, &entry)?;
            index.dangerously_push_entry(
                entry.stat,
                entry.id,
                gix::index::entry::Flags::empty(),
                entry.mode,
                rela_bstr,
            );
        } else if abs.exists() {
            remove_path_recursive(&abs)?;
        }
    }

    index.sort_entries();
    write_index(&mut index)
}

/// Commit the current index with `message`. Requires `user.name` / `user.email` in git config.
pub fn commit(repo_path: impl AsRef<Path>, message: &str) -> Result<GitCommitResult, String> {
    let message = message.trim();
    if message.is_empty() {
        return Err("commit message is required".into());
    }

    let repo = open_repo(repo_path)?;
    let index = mutable_index(&repo)?;
    let tree_id = write_tree_from_index(&repo, &index)?;

    let parent_ids: Vec<ObjectId> = match repo.head_id() {
        Ok(id) => vec![id.detach()],
        Err(_) => Vec::new(),
    };

    if let Some(parent) = parent_ids.first() {
        if let Ok(commit) = repo.find_commit(*parent) {
            if let Ok(head_tree) = commit.tree_id() {
                if head_tree.detach() == tree_id {
                    return Err("nothing to commit (index matches HEAD)".into());
                }
            }
        }
    }

    let author = repo
        .author()
        .ok_or_else(|| {
            "git identity missing: set user.name and user.email in git config".to_string()
        })?
        .map_err(|err| format!("author config: {err}"))?;
    let committer = repo
        .committer()
        .ok_or_else(|| {
            "git identity missing: set user.name and user.email in git config".to_string()
        })?
        .map_err(|err| format!("committer config: {err}"))?;

    let id = repo
        .commit_as(committer, author, "HEAD", message, tree_id, parent_ids)
        .map_err(|err| format!("commit failed: {err}"))?;

    Ok(GitCommitResult {
        id: id.to_string(),
    })
}

/// List local branches.
pub fn branches(repo_path: impl AsRef<Path>) -> Result<Vec<GitBranchInfo>, String> {
    let repo = open_repo(repo_path)?;
    let current = current_branch_name(&repo);

    let platform = repo
        .references()
        .map_err(|err| format!("references: {err}"))?;
    let local = platform
        .local_branches()
        .map_err(|err| format!("local branches: {err}"))?;

    let mut out = Vec::new();
    for r in local {
        let r = r.map_err(|err| format!("branch ref: {err}"))?;
        let name = r
            .name()
            .shorten()
            .to_str()
            .map(|s| s.to_owned())
            .unwrap_or_else(|_| bstr_to_string(r.name().shorten()));
        let is_current = current.as_deref() == Some(name.as_str());
        out.push(GitBranchInfo { name, is_current });
    }
    out.sort_by(|a, b| a.name.to_ascii_lowercase().cmp(&b.name.to_ascii_lowercase()));
    Ok(out)
}

/// Check out an existing local branch (updates HEAD, index, and worktree).
pub fn checkout(repo_path: impl AsRef<Path>, branch: &str) -> Result<(), String> {
    let branch = sanitize_branch_name(branch)?;
    let repo = open_repo(repo_path)?;
    let workdir = workdir(&repo)?;

    let full = format!("refs/heads/{branch}");
    let reference = repo
        .find_reference(&full)
        .map_err(|err| format!("branch '{branch}' not found: {err}"))?;
    let target_id = reference
        .into_fully_peeled_id()
        .map_err(|err| format!("peel branch: {err}"))?
        .detach();

    let commit = repo
        .find_commit(target_id)
        .map_err(|err| format!("load commit: {err}"))?;
    let tree_id = commit
        .tree_id()
        .map_err(|err| format!("commit tree: {err}"))?
        .detach();

    checkout_tree(&repo, &workdir, tree_id)?;
    point_head_to_branch(&repo, &branch)?;
    Ok(())
}

/// Create a local branch from HEAD.
/// When `checkout` is true, switches to the new branch (same tree — HEAD only).
pub fn create_branch(
    repo_path: impl AsRef<Path>,
    name: &str,
    checkout: bool,
) -> Result<(), String> {
    let name = sanitize_branch_name(name)?;
    let repo = open_repo(repo_path)?;

    let head_id = repo
        .head_id()
        .map_err(|_| "cannot create branch: repository has no commits yet".to_string())?
        .detach();

    let full = format!("refs/heads/{name}");
    repo.reference(
        full.as_str(),
        head_id,
        PreviousValue::MustNotExist,
        "branch: Created from HEAD",
    )
    .map_err(|err| format!("create branch '{name}': {err}"))?;

    if checkout {
        point_head_to_branch(&repo, &name)?;
    }
    Ok(())
}

// --- internals ----------------------------------------------------------------

fn open_result_from_repo(repo: Repository, folder_path: String) -> Result<GitOpenResult, String> {
    let root = workdir(&repo)
        .map(|p| path_to_string(&p))
        .unwrap_or_else(|_| path_to_string(repo.git_dir()));

    let branch = current_branch_name(&repo);
    let (head, ahead, behind) = match repo.head_id() {
        Ok(id) => {
            let short = id.shorten().map(|p| p.to_string()).unwrap_or_else(|_| {
                id.to_hex_with_len(7).to_string()
            });
            let (a, b) = ahead_behind(&repo, id.detach());
            (Some(short), a, b)
        }
        Err(_) => (None, None, None),
    };

    Ok(GitOpenResult {
        folder_path,
        root,
        is_repo: true,
        branch,
        head,
        ahead,
        behind,
    })
}

fn ahead_behind(repo: &Repository, local: ObjectId) -> (Option<u32>, Option<u32>) {
    let Ok(head) = repo.head() else {
        return (None, None);
    };
    let Some(referent) = head.try_into_referent() else {
        return (None, None);
    };
    let Some(tracking_res) = referent.remote_tracking_ref_name(gix::remote::Direction::Fetch) else {
        return (None, None);
    };
    let Ok(tracking) = tracking_res else {
        return (None, None);
    };
    let Ok(tracking_ref) = repo.find_reference(tracking.as_ref()) else {
        return (None, None);
    };
    let Ok(upstream_id) = tracking_ref.into_fully_peeled_id() else {
        return (None, None);
    };
    let upstream = upstream_id.detach();

    let ahead = count_unique_commits(repo, local, upstream);
    let behind = count_unique_commits(repo, upstream, local);
    (ahead, behind)
}

fn count_unique_commits(repo: &Repository, tip: ObjectId, hide: ObjectId) -> Option<u32> {
    let walk = repo.rev_walk([tip]).with_hidden([hide]).all().ok()?;
    let mut n = 0u32;
    for item in walk {
        item.ok()?;
        n = n.saturating_add(1);
    }
    Some(n)
}

pub(crate) fn open_repo(path: impl AsRef<Path>) -> Result<Repository, String> {
    let path = path.as_ref();
    if path.as_os_str().is_empty() {
        return Err("path is required".into());
    }
    gix::discover(path).map_err(|err| format!("not a git repository: {err}"))
}

pub(crate) fn workdir(repo: &Repository) -> Result<PathBuf, String> {
    repo.workdir()
        .map(Path::to_path_buf)
        .ok_or_else(|| "repository has no worktree (bare)".to_string())
}

fn normalize_existing_dir(path: impl AsRef<Path>) -> Result<PathBuf, String> {
    let path = path.as_ref();
    if path.as_os_str().is_empty() {
        return Err("path is required".into());
    }
    let meta = fs::symlink_metadata(path)
        .map_err(|err| format!("cannot access {}: {err}", path.display()))?;
    if !meta.is_dir() {
        return Err(format!("{} is not a directory", path.display()));
    }
    Ok(path.to_path_buf())
}

fn current_branch_name(repo: &Repository) -> Option<String> {
    let head = repo.head().ok()?;
    let name = head.referent_name()?;
    Some(bstr_to_string(name.shorten()))
}

pub(crate) fn mutable_index(repo: &Repository) -> Result<gix::index::File, String> {
    match repo.open_index() {
        Ok(index) => Ok(index),
        Err(_) => Ok(gix::index::File::from_state(
            gix::index::State::new(repo.object_hash()),
            repo.index_path(),
        )),
    }
}

pub(crate) fn head_tree_index(repo: &Repository) -> Result<Option<gix::index::File>, String> {
    match repo.head_commit() {
        Ok(commit) => {
            let tree = commit
                .tree_id()
                .map_err(|err| format!("HEAD tree: {err}"))?;
            let index = repo
                .index_from_tree(&tree)
                .map_err(|err| format!("index from HEAD: {err}"))?;
            Ok(Some(index))
        }
        Err(_) => Ok(None),
    }
}

fn write_index(index: &mut gix::index::File) -> Result<(), String> {
    index.remove_tree();
    index
        .write(gix::index::write::Options::default())
        .map_err(|err| format!("write index: {err}"))
}

fn remove_path_from_index(index: &mut gix::index::File, path: &BStr) {
    index.remove_entries(|_idx, p, _entry| p == path);
}

fn write_tree_from_index(
    repo: &Repository,
    index: &gix::index::File,
) -> Result<ObjectId, String> {
    let empty = ObjectId::empty_tree(repo.object_hash());
    let mut editor = repo
        .edit_tree(empty)
        .map_err(|err| format!("tree editor: {err}"))?;

    for (path, entry) in index.entries_with_paths_by_filter_map(|_path, entry| {
        if entry.stage() != gix::index::entry::Stage::Unconflicted {
            None
        } else {
            Some(entry.clone())
        }
    }) {
        let kind = entry
            .mode
            .to_tree_entry_mode()
            .map(|m| m.kind())
            .ok_or_else(|| format!("invalid index mode for {}", bstr_to_string(path)))?;
        if matches!(kind, EntryKind::Tree) {
            continue;
        }
        editor
            .upsert(path, kind, entry.id)
            .map_err(|err| format!("tree upsert {}: {err}", bstr_to_string(path)))?;
    }

    let id = editor
        .write()
        .map_err(|err| format!("write tree: {err}"))?;
    Ok(id.detach())
}

fn restore_worktree_blob(
    repo: &Repository,
    workdir: &Path,
    rela: &BStr,
    entry: &gix::index::Entry,
) -> Result<(), String> {
    let abs = workdir.join(gix::path::from_bstr(rela));
    if let Some(parent) = abs.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("create parent {}: {err}", parent.display()))?;
    }

    let kind = entry
        .mode
        .to_tree_entry_mode()
        .map(|m| m.kind())
        .unwrap_or(EntryKind::Blob);

    match kind {
        EntryKind::Link => {
            let blob = repo
                .find_blob(entry.id)
                .map_err(|err| format!("read symlink blob: {err}"))?;
            let target = gix::path::from_bstr(blob.data.as_bstr());
            if abs.exists() {
                remove_path_recursive(&abs)?;
            }
            #[cfg(windows)]
            {
                use std::os::windows::fs::{symlink_dir, symlink_file};
                if symlink_file(&target, &abs).is_err() && symlink_dir(&target, &abs).is_err() {
                    fs::write(&abs, blob.data.as_slice())
                        .map_err(|err| format!("write link fallback {}: {err}", abs.display()))?;
                }
            }
            #[cfg(not(windows))]
            {
                std::os::unix::fs::symlink(&target, &abs)
                    .map_err(|err| format!("symlink {}: {err}", abs.display()))?;
            }
        }
        EntryKind::Blob | EntryKind::BlobExecutable => {
            let blob = repo
                .find_blob(entry.id)
                .map_err(|err| format!("read blob: {err}"))?;
            if abs.exists() {
                remove_path_recursive(&abs)?;
            }
            fs::write(&abs, blob.data.as_slice())
                .map_err(|err| format!("write {}: {err}", abs.display()))?;
        }
        _ => {
            return Err(format!(
                "cannot restore {}: unsupported entry kind",
                bstr_to_string(rela)
            ));
        }
    }
    Ok(())
}

fn checkout_tree(repo: &Repository, workdir: &Path, tree_id: ObjectId) -> Result<(), String> {
    let mut new_index = repo
        .index_from_tree(&tree_id)
        .map_err(|err| format!("index from tree: {err}"))?;

    let opts = repo
        .checkout_options(gix::worktree::stack::state::attributes::Source::IdMapping)
        .map_err(|err| format!("checkout options: {err}"))?;

    let objects = repo
        .objects
        .clone()
        .into_arc()
        .map_err(|err| format!("object store: {err}"))?;

    gix::worktree::state::checkout(
        &mut new_index,
        workdir,
        objects,
        &gix::progress::Discard,
        &gix::progress::Discard,
        &gix::interrupt::IS_INTERRUPTED,
        opts,
    )
    .map_err(|err| format!("checkout worktree: {err}"))?;

    write_index(&mut new_index)
}

fn point_head_to_branch(repo: &Repository, branch: &str) -> Result<(), String> {
    let name: FullName = format!("refs/heads/{branch}")
        .try_into()
        .map_err(|err| format!("invalid branch ref: {err}"))?;
    repo.edit_reference(RefEdit {
        change: Change::Update {
            log: LogChange {
                mode: RefLog::AndReference,
                force_create_reflog: false,
                message: format!("checkout: moving HEAD to {branch}").into(),
            },
            expected: PreviousValue::Any,
            new: Target::Symbolic(name),
        },
        name: "HEAD".try_into().expect("HEAD is valid"),
        deref: false,
    })
    .map_err(|err| format!("update HEAD: {err}"))?;
    Ok(())
}

fn mode_from_kind(kind: EntryKind) -> gix::index::entry::Mode {
    match kind {
        EntryKind::BlobExecutable => gix::index::entry::Mode::FILE_EXECUTABLE,
        EntryKind::Link => gix::index::entry::Mode::SYMLINK,
        EntryKind::Commit => gix::index::entry::Mode::COMMIT,
        EntryKind::Tree => gix::index::entry::Mode::DIR,
        EntryKind::Blob => gix::index::entry::Mode::FILE,
    }
}

fn map_tree_index_change(change: &TreeIndexChange) -> (GitChangeStatus, String) {
    let path = bstr_to_string(change.location());
    let status = match change {
        TreeIndexChange::Addition { .. } => GitChangeStatus::Added,
        TreeIndexChange::Deletion { .. } => GitChangeStatus::Deleted,
        TreeIndexChange::Modification { .. } => GitChangeStatus::Modified,
        TreeIndexChange::Rewrite { copy: true, .. } => GitChangeStatus::Copied,
        TreeIndexChange::Rewrite { copy: false, .. } => GitChangeStatus::Renamed,
    };
    (status, path)
}

fn make_entry(workdir: &Path, rela: String, status: GitChangeStatus) -> GitStatusEntry {
    let absolute_path =
        path_to_string(&workdir.join(gix::path::from_bstr(rela.as_bytes().as_bstr())));
    GitStatusEntry {
        path: rela,
        absolute_path,
        status,
    }
}

pub(crate) fn normalize_paths(workdir: &Path, paths: &[String]) -> Result<Vec<String>, String> {
    if paths.is_empty() {
        return Err("at least one path is required".into());
    }
    let mut out = Vec::with_capacity(paths.len());
    for raw in paths {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return Err("path is required".into());
        }
        let p = PathBuf::from(trimmed);
        let rela = if p.is_absolute() {
            p.strip_prefix(workdir)
                .map_err(|_| {
                    format!(
                        "{} is outside the repository worktree {}",
                        p.display(),
                        workdir.display()
                    )
                })?
                .to_path_buf()
        } else {
            p
        };
        let rela = rela
            .components()
            .map(|c| c.as_os_str().to_string_lossy())
            .collect::<Vec<_>>()
            .join("/");
        if rela.is_empty() || rela == "." {
            return Err("refusing to operate on repository root".into());
        }
        out.push(rela);
    }
    Ok(out)
}

fn sanitize_branch_name(name: &str) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("branch name is required".into());
    }
    if name.contains([' ', '\\', '~', '^', ':', '?', '*', '['])
        || name.contains("..")
        || name.starts_with('-')
        || name.ends_with('.')
        || name.ends_with('/')
    {
        return Err(format!("invalid branch name '{name}'"));
    }
    if let Err(err) = gix::validate::reference::name_partial(name.as_bytes().as_bstr()) {
        return Err(format!("invalid branch name '{name}': {err}"));
    }
    Ok(name.to_owned())
}

fn remove_path_recursive(path: &Path) -> Result<(), String> {
    let meta = fs::symlink_metadata(path)
        .map_err(|err| format!("stat {}: {err}", path.display()))?;
    if meta.is_dir() {
        fs::remove_dir_all(path).map_err(|err| format!("remove {}: {err}", path.display()))?;
    } else {
        fs::remove_file(path).map_err(|err| format!("remove {}: {err}", path.display()))?;
    }
    Ok(())
}

fn sort_entries(entries: &mut [GitStatusEntry]) {
    entries.sort_by(|a, b| {
        a.path
            .to_ascii_lowercase()
            .cmp(&b.path.to_ascii_lowercase())
    });
}

fn bstr_to_string(s: &BStr) -> String {
    s.to_str()
        .map(|s| s.to_owned())
        .unwrap_or_else(|_| s.to_string())
}

pub(crate) fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

struct StatusMaps {
    staged: HashMap<String, GitChangeStatus>,
    unstaged: HashMap<String, GitChangeStatus>,
    untracked: HashSet<String>,
    conflicted: HashSet<String>,
}

impl StatusMaps {
    fn from_status(status: GitStatusResult) -> Self {
        let mut staged = HashMap::new();
        for entry in status.staged {
            staged.insert(entry.path, entry.status);
        }
        let mut unstaged = HashMap::new();
        for entry in status.unstaged {
            unstaged.insert(entry.path, entry.status);
        }
        Self {
            staged,
            unstaged,
            untracked: status.untracked.into_iter().map(|e| e.path).collect(),
            conflicted: status.conflicted.into_iter().map(|e| e.path).collect(),
        }
    }
}

fn resolve_list_dir(workdir: &Path, dir: &str) -> Result<(PathBuf, String), String> {
    let trimmed = dir.trim();
    if trimmed.is_empty() || trimmed == "." {
        return Ok((workdir.to_path_buf(), String::new()));
    }

    let (abs, rela) = if Path::new(trimmed).is_absolute() {
        let abs = PathBuf::from(trimmed);
        let rela = abs_to_rela(workdir, &abs)?;
        (abs, rela)
    } else {
        let rela = normalize_rela_input(trimmed);
        let abs = workdir.join(gix::path::from_bstr(rela.as_bytes().as_bstr()));
        (abs, rela)
    };

    if is_git_dir(&rela) {
        return Err("refusing to list .git".into());
    }
    Ok((abs, rela))
}

fn normalize_rela_input(dir: &str) -> String {
    dir.replace('\\', "/")
        .split('/')
        .filter(|s| !s.is_empty() && *s != ".")
        .collect::<Vec<_>>()
        .join("/")
}

fn is_git_dir(rela: &str) -> bool {
    rela == ".git" || rela.starts_with(".git/")
}

fn abs_to_rela(workdir: &Path, abs: &Path) -> Result<String, String> {
    if let Ok(rela) = abs.strip_prefix(workdir) {
        return Ok(path_components_rela(rela));
    }
    let wd = normalize_path_key(workdir);
    let ap = normalize_path_key(abs);
    if ap == wd {
        return Ok(String::new());
    }
    let prefix = format!("{wd}/");
    if ap.starts_with(&prefix) {
        let abs_s = path_to_string(abs).replace('\\', "/");
        let wd_s = path_to_string(workdir).replace('\\', "/");
        let wd_trim = wd_s.trim_end_matches('/');
        if abs_s.len() > wd_trim.len() {
            return Ok(abs_s[wd_trim.len()..]
                .trim_start_matches('/')
                .to_string());
        }
        return Ok(String::new());
    }
    Err(format!(
        "{} is outside the repository worktree {}",
        abs.display(),
        workdir.display()
    ))
}

fn normalize_path_key(path: &Path) -> String {
    path_to_string(path)
        .replace('\\', "/")
        .trim_end_matches('/')
        .to_ascii_lowercase()
}

fn path_components_rela(path: &Path) -> String {
    path.components()
        .filter_map(|c| match c {
            Component::Normal(s) => Some(s.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn join_rela(parent: &str, name: &str) -> String {
    if parent.is_empty() {
        name.to_string()
    } else {
        format!("{parent}/{name}")
    }
}

fn path_under(dir: &str, path: &str) -> bool {
    if dir.is_empty() {
        return !path.is_empty();
    }
    path == dir || path.starts_with(&format!("{dir}/"))
}

fn has_status_under(maps: &StatusMaps, dir: &str) -> bool {
    maps.staged.keys().any(|p| path_under(dir, p))
        || maps.unstaged.keys().any(|p| path_under(dir, p))
        || maps.untracked.iter().any(|p| path_under(dir, p))
        || maps.conflicted.iter().any(|p| path_under(dir, p))
}

fn first_child_segment<'a>(dir: &str, path: &'a str) -> Option<(&'a str, bool)> {
    let rest = if dir.is_empty() {
        path
    } else if path == dir {
        return None;
    } else {
        path.strip_prefix(&format!("{dir}/"))?
    };
    match rest.find('/') {
        Some(i) => Some((&rest[..i], false)),
        None => Some((rest, true)),
    }
}

fn index_contains(index: &gix::index::File, rela: &str) -> bool {
    let rela_bstr: &BStr = rela.as_bytes().as_bstr();
    index
        .entry_by_path_and_stage(rela_bstr, gix::index::entry::Stage::Unconflicted)
        .is_some()
}

fn index_has_prefix(index: &gix::index::File, dir: &str) -> bool {
    if dir.is_empty() {
        return !index.entries().is_empty();
    }
    if index_contains(index, dir) {
        return true;
    }
    let prefix = format!("{dir}/");
    let backing = index.path_backing();
    index.entries().iter().any(|entry| {
        let path = bstr_to_string(entry.path_in(backing));
        path == dir || path.starts_with(&prefix)
    })
}

fn path_is_ignored(
    excludes: &mut gix::AttributeStack<'_>,
    rela: &str,
    is_dir: bool,
) -> bool {
    if rela.is_empty() {
        return false;
    }
    let mode = if is_dir {
        Some(gix::index::entry::Mode::DIR)
    } else {
        Some(gix::index::entry::Mode::FILE)
    };
    match excludes.at_entry(rela.as_bytes().as_bstr(), mode) {
        Ok(platform) => platform.is_excluded(),
        Err(_) => false,
    }
}

fn first_status_under(
    map: &HashMap<String, GitChangeStatus>,
    dir: &str,
) -> Option<GitChangeStatus> {
    if let Some(&status) = map.get(dir) {
        return Some(status);
    }
    map.iter()
        .find(|(path, _)| path_under(dir, path))
        .map(|(_, status)| *status)
}

fn classify_tree_entry(
    workdir: &Path,
    name: &str,
    rela: &str,
    is_dir: bool,
    maps: &StatusMaps,
    index: &gix::index::File,
    excludes: &mut gix::AttributeStack<'_>,
) -> GitTreeEntry {
    let ignored = path_is_ignored(excludes, rela, is_dir);
    let in_index = if is_dir {
        index_has_prefix(index, rela)
    } else {
        index_contains(index, rela)
    };

    let (decoration, status) = if is_dir {
        classify_dir(rela, maps, in_index, ignored)
    } else {
        classify_file(rela, maps, in_index, ignored)
    };

    GitTreeEntry {
        name: name.to_string(),
        path: rela.to_string(),
        absolute_path: path_to_string(&workdir.join(gix::path::from_bstr(rela.as_bytes().as_bstr()))),
        kind: if is_dir {
            GitTreeEntryKind::Dir
        } else {
            GitTreeEntryKind::File
        },
        decoration,
        status,
        ignored,
    }
}

fn classify_file(
    rela: &str,
    maps: &StatusMaps,
    in_index: bool,
    ignored: bool,
) -> (GitTreeDecoration, Option<GitChangeStatus>) {
    if maps.conflicted.contains(rela) {
        return (GitTreeDecoration::Conflict, Some(GitChangeStatus::Conflict));
    }
    if let Some(&status) = maps.staged.get(rela) {
        return (GitTreeDecoration::Staged, Some(status));
    }
    if let Some(&status) = maps.unstaged.get(rela) {
        return (GitTreeDecoration::Unstaged, Some(status));
    }
    if maps.untracked.contains(rela) {
        return (
            GitTreeDecoration::Untracked,
            Some(GitChangeStatus::Untracked),
        );
    }
    if in_index {
        return (GitTreeDecoration::Unchanged, None);
    }
    if ignored {
        return (GitTreeDecoration::Ignored, None);
    }
    (
        GitTreeDecoration::Untracked,
        Some(GitChangeStatus::Untracked),
    )
}

fn classify_dir(
    rela: &str,
    maps: &StatusMaps,
    in_index: bool,
    ignored: bool,
) -> (GitTreeDecoration, Option<GitChangeStatus>) {
    if maps.conflicted.iter().any(|p| path_under(rela, p)) {
        return (GitTreeDecoration::Conflict, Some(GitChangeStatus::Conflict));
    }
    if let Some(status) = first_status_under(&maps.staged, rela) {
        return (GitTreeDecoration::Staged, Some(status));
    }
    if let Some(status) = first_status_under(&maps.unstaged, rela) {
        return (GitTreeDecoration::Unstaged, Some(status));
    }
    if maps.untracked.iter().any(|p| path_under(rela, p)) {
        return (
            GitTreeDecoration::Untracked,
            Some(GitChangeStatus::Untracked),
        );
    }
    if in_index {
        return (GitTreeDecoration::Unchanged, None);
    }
    if ignored {
        return (GitTreeDecoration::Ignored, None);
    }
    (
        GitTreeDecoration::Untracked,
        Some(GitChangeStatus::Untracked),
    )
}

fn inject_missing_status_children(
    workdir: &Path,
    rela_dir: &str,
    maps: &StatusMaps,
    index: &gix::index::File,
    excludes: &mut gix::AttributeStack<'_>,
    seen: &mut HashSet<String>,
    entries: &mut Vec<GitTreeEntry>,
) {
    let mut names: Vec<(String, bool)> = Vec::new();
    let push_child = |path: &str, names: &mut Vec<(String, bool)>| {
        if let Some((name, is_file)) = first_child_segment(rela_dir, path) {
            if !name.is_empty() && name != ".git" {
                names.push((name.to_string(), is_file));
            }
        }
    };

    for path in maps
        .staged
        .iter()
        .filter(|(_, status)| **status == GitChangeStatus::Deleted)
        .map(|(p, _)| p.as_str())
        .chain(
            maps.unstaged
                .iter()
                .filter(|(_, status)| **status == GitChangeStatus::Deleted)
                .map(|(p, _)| p.as_str()),
        )
        .chain(maps.conflicted.iter().map(String::as_str))
    {
        push_child(path, &mut names);
    }

    for (name, is_file) in names {
        let key = name.to_ascii_lowercase();
        if seen.contains(&key) {
            continue;
        }
        let child_rela = join_rela(rela_dir, &name);
        let abs = workdir.join(gix::path::from_bstr(child_rela.as_bytes().as_bstr()));
        if abs.exists() {
            continue;
        }
        seen.insert(key);
        entries.push(classify_tree_entry(
            workdir,
            &name,
            &child_rela,
            !is_file,
            maps,
            index,
            excludes,
        ));
    }
}

fn sort_tree_entries(entries: &mut [GitTreeEntry]) {
    entries.sort_by(|a, b| {
        let dir_a = matches!(a.kind, GitTreeEntryKind::Dir);
        let dir_b = matches!(b.kind, GitTreeEntryKind::Dir);
        match (dir_a, dir_b) {
            (true, false) => Ordering::Less,
            (false, true) => Ordering::Greater,
            _ => a
                .name
                .to_ascii_lowercase()
                .cmp(&b.name.to_ascii_lowercase()),
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "gensource-git-test-{}-{}",
            std::process::id(),
            uuid_lite()
        ));
        fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    fn uuid_lite() -> u64 {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos() as u64)
            .unwrap_or(0)
    }

    fn write_identity(git_dir: &Path) {
        let config = git_dir.join("config");
        let mut existing = fs::read_to_string(&config).unwrap_or_default();
        if !existing.contains("[user]") {
            existing.push_str(
                "\n[user]\n\tname = GenSource Test\n\temail = test@gensource.local\n",
            );
            fs::write(&config, existing).expect("write config");
        }
    }

    #[test]
    fn discover_init_and_status_on_temp_dir() {
        let dir = temp_dir();
        let nested = dir.join("nested").join("deep");
        fs::create_dir_all(&nested).unwrap();

        let open = open_folder(&dir).expect("open non-repo");
        assert!(!open.is_repo);
        assert_eq!(open.root, path_to_string(&dir));

        let init = init_repo(&dir).expect("init");
        assert!(init.is_repo);
        assert_eq!(init.root, path_to_string(&dir));

        let discovered = open_folder(&nested).expect("discover nested");
        assert!(discovered.is_repo);
        assert_eq!(discovered.root, path_to_string(&dir));

        let st = status(&dir).expect("status empty");
        assert!(st.staged.is_empty());
        assert!(st.unstaged.is_empty());
        assert!(st.untracked.is_empty());

        let file = dir.join("readme.txt");
        fs::write(&file, b"hello").unwrap();

        let st = status(&dir).expect("status untracked");
        assert_eq!(st.untracked.len(), 1);
        assert_eq!(st.untracked[0].path, "readme.txt");
        assert_eq!(st.untracked[0].status, GitChangeStatus::Untracked);

        stage(&dir, &["readme.txt".into()]).expect("stage");
        let st = status(&dir).expect("status staged");
        assert_eq!(st.staged.len(), 1);
        assert_eq!(st.staged[0].status, GitChangeStatus::Added);
        assert!(st.untracked.is_empty());

        write_identity(Path::new(&init.root).join(".git").as_path());
        let commit_res = commit(&dir, "initial commit").expect("commit");
        assert!(!commit_res.id.is_empty());

        let st = status(&dir).expect("clean status");
        assert!(st.staged.is_empty());
        assert!(st.unstaged.is_empty());
        assert!(st.untracked.is_empty());

        let br = branches(&dir).expect("branches");
        assert!(!br.is_empty());
        assert!(br.iter().any(|b| b.is_current));

        create_branch(&dir, "feature/x", true).expect("create branch");
        let br = branches(&dir).expect("branches after create");
        assert!(br.iter().any(|b| b.name == "feature/x" && b.is_current));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn open_folder_rejects_missing_path() {
        let missing = std::env::temp_dir().join("gensource-git-missing-path-xyz");
        let _ = fs::remove_dir_all(&missing);
        assert!(open_folder(&missing).is_err());
    }

    #[test]
    fn stage_unstage_discard_roundtrip() {
        let dir = temp_dir();
        let init = init_repo(&dir).unwrap();
        write_identity(Path::new(&init.root).join(".git").as_path());

        fs::write(dir.join("a.txt"), b"one").unwrap();
        stage(&dir, &["a.txt".into()]).unwrap();
        commit(&dir, "add a").unwrap();

        fs::write(dir.join("a.txt"), b"two").unwrap();
        let st = status(&dir).unwrap();
        assert_eq!(st.unstaged.len(), 1);

        stage(&dir, &["a.txt".into()]).unwrap();
        let st = status(&dir).unwrap();
        assert_eq!(st.staged.len(), 1);

        unstage(&dir, &["a.txt".into()]).unwrap();
        let st = status(&dir).unwrap();
        assert!(st.staged.is_empty());
        assert_eq!(st.unstaged.len(), 1);

        discard(&dir, &["a.txt".into()]).unwrap();
        let st = status(&dir).unwrap();
        assert!(st.unstaged.is_empty());
        assert_eq!(fs::read_to_string(dir.join("a.txt")).unwrap(), "one");

        fs::write(dir.join("b.txt"), b"new").unwrap();
        discard(&dir, &["b.txt".into()]).unwrap();
        assert!(!dir.join("b.txt").exists());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn stage_untracked_directory_path() {
        let dir = temp_dir();
        init_repo(&dir).unwrap();

        let agent = dir.join("agent");
        let nested = agent.join("nested");
        fs::create_dir_all(&nested).unwrap();
        fs::write(agent.join("mod.rs"), b"mod nested;").unwrap();
        fs::write(nested.join("tools.rs"), b"pub fn x() {}").unwrap();

        let st = status(&dir).expect("status before stage");
        assert!(
            st.untracked.iter().any(|e| e.path == "agent" || e.path.starts_with("agent/")),
            "expected untracked agent path(s), got {:?}",
            st.untracked.iter().map(|e| &e.path).collect::<Vec<_>>()
        );

        stage(&dir, &["agent".into()]).expect("stage directory");

        let st = status(&dir).expect("status after stage");
        let staged_paths: Vec<&str> = st.staged.iter().map(|e| e.path.as_str()).collect();
        assert!(
            staged_paths.iter().any(|p| *p == "agent/mod.rs"),
            "missing agent/mod.rs in staged: {staged_paths:?}"
        );
        assert!(
            staged_paths.iter().any(|p| *p == "agent/nested/tools.rs"),
            "missing agent/nested/tools.rs in staged: {staged_paths:?}"
        );
        assert!(st.untracked.is_empty(), "untracked should be empty: {:?}", st.untracked);
        assert!(st.staged.iter().all(|e| e.status == GitChangeStatus::Added));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn list_dir_tracked_untracked_ignored_and_deleted() {
        let dir = temp_dir();
        let init = init_repo(&dir).unwrap();
        write_identity(Path::new(&init.root).join(".git").as_path());

        fs::write(dir.join("tracked.txt"), b"keep").unwrap();
        stage(&dir, &["tracked.txt".into()]).unwrap();
        commit(&dir, "add tracked").unwrap();

        fs::write(dir.join("gone.txt"), b"bye").unwrap();
        stage(&dir, &["gone.txt".into()]).unwrap();
        commit(&dir, "add gone").unwrap();
        fs::remove_file(dir.join("gone.txt")).unwrap();

        fs::create_dir_all(dir.join("nested")).unwrap();
        fs::write(dir.join("nested").join("deep.txt"), b"d").unwrap();
        stage(&dir, &["nested/deep.txt".into()]).unwrap();
        commit(&dir, "add nested").unwrap();
        fs::remove_file(dir.join("nested").join("deep.txt")).unwrap();
        fs::remove_dir(dir.join("nested")).unwrap();

        fs::write(dir.join(".gitignore"), b"ignored.txt\nsecret/\n").unwrap();
        fs::write(dir.join("new.txt"), b"u").unwrap();
        fs::write(dir.join("ignored.txt"), b"nope").unwrap();
        fs::create_dir_all(dir.join("secret")).unwrap();
        fs::write(dir.join("secret").join("x.txt"), b"x").unwrap();

        let entries = list_dir(&dir, "").expect("list root");
        assert!(
            !entries.iter().any(|e| e.name == ".git"),
            ".git must be hidden"
        );

        let by_name: HashMap<&str, &GitTreeEntry> =
            entries.iter().map(|e| (e.name.as_str(), e)).collect();

        let tracked = by_name.get("tracked.txt").expect("tracked.txt");
        assert_eq!(tracked.decoration, GitTreeDecoration::Unchanged);
        assert!(!tracked.ignored);
        assert_eq!(tracked.kind, GitTreeEntryKind::File);

        let untracked = by_name.get("new.txt").expect("new.txt");
        assert_eq!(untracked.decoration, GitTreeDecoration::Untracked);
        assert_eq!(untracked.status, Some(GitChangeStatus::Untracked));

        let ignored = by_name.get("ignored.txt").expect("ignored.txt");
        assert_eq!(ignored.decoration, GitTreeDecoration::Ignored);
        assert!(ignored.ignored);

        let secret = by_name.get("secret").expect("secret/");
        assert_eq!(secret.kind, GitTreeEntryKind::Dir);
        assert_eq!(secret.decoration, GitTreeDecoration::Ignored);
        assert!(secret.ignored);

        let gone = by_name.get("gone.txt").expect("deleted gone.txt");
        assert_eq!(gone.decoration, GitTreeDecoration::Unstaged);
        assert_eq!(gone.status, Some(GitChangeStatus::Deleted));
        assert!(!dir.join("gone.txt").exists());

        let nested = by_name.get("nested").expect("deleted nested/");
        assert_eq!(nested.kind, GitTreeEntryKind::Dir);
        assert_eq!(nested.decoration, GitTreeDecoration::Unstaged);

        let secret_kids = list_dir(&dir, "secret").expect("list ignored dir");
        assert_eq!(secret_kids.len(), 1);
        assert_eq!(secret_kids[0].name, "x.txt");
        assert!(secret_kids[0].ignored);
        assert_eq!(secret_kids[0].decoration, GitTreeDecoration::Ignored);

        let nested_kids = list_dir(&dir, "nested").expect("list deleted dir");
        assert_eq!(nested_kids.len(), 1);
        assert_eq!(nested_kids[0].name, "deep.txt");
        assert_eq!(nested_kids[0].status, Some(GitChangeStatus::Deleted));
        assert_eq!(nested_kids[0].decoration, GitTreeDecoration::Unstaged);

        assert!(list_dir(&dir, ".git").is_err());

        let _ = fs::remove_dir_all(&dir);
    }
}
