//! Pure-Rust gitoxide (`gix`) helpers for the Source Control panel.
//! No system `git.exe` — local discover/init/status/index/commit/branch ops.

use std::fs;
use std::path::{Path, PathBuf};

use gix::bstr::{BStr, BString, ByteSlice};
use gix::diff::index::Change as TreeIndexChange;
use gix::objs::tree::EntryKind;
use gix::refs::transaction::{Change, LogChange, PreviousValue, RefEdit, RefLog};
use gix::refs::{FullName, Target};
use gix::status::index_worktree::iter::Summary as IwSummary;
use gix::{ObjectId, Repository};

use crate::mdoels::{
    GitBranchInfo, GitChangeStatus, GitCommitResult, GitOpenResult, GitStatusEntry, GitStatusResult,
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

/// Stage paths (repo-relative `/` or absolute under the worktree).
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

        let Some((id, kind, _md)) = pipeline
            .worktree_file_to_object(rela_bstr, &index)
            .map_err(|err| format!("stage {rela}: {err}"))?
        else {
            return Err(format!("cannot stage {rela}: unsupported type"));
        };

        let fs_meta = gix::index::fs::Metadata::from_path_no_follow(&abs)
            .map_err(|err| format!("stat {}: {err}", abs.display()))?;
        let stat = gix::index::entry::Stat::from_fs(&fs_meta)
            .map_err(|err| format!("index stat {rela}: {err}"))?;
        let mode = mode_from_kind(kind);

        remove_path_from_index(&mut index, rela_bstr);
        index.dangerously_push_entry(
            stat,
            id,
            gix::index::entry::Flags::empty(),
            mode,
            rela_bstr,
        );
    }

    index.sort_entries();
    write_index(&mut index)
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

fn open_repo(path: impl AsRef<Path>) -> Result<Repository, String> {
    let path = path.as_ref();
    if path.as_os_str().is_empty() {
        return Err("path is required".into());
    }
    gix::discover(path).map_err(|err| format!("not a git repository: {err}"))
}

fn workdir(repo: &Repository) -> Result<PathBuf, String> {
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

fn mutable_index(repo: &Repository) -> Result<gix::index::File, String> {
    match repo.open_index() {
        Ok(index) => Ok(index),
        Err(_) => Ok(gix::index::File::from_state(
            gix::index::State::new(repo.object_hash()),
            repo.index_path(),
        )),
    }
}

fn head_tree_index(repo: &Repository) -> Result<Option<gix::index::File>, String> {
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

fn normalize_paths(workdir: &Path, paths: &[String]) -> Result<Vec<String>, String> {
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

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
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
}
