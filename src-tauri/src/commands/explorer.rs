//! Files Explorer IPC: list drives/dirs, create/rename/remove, open/reveal,
//! and username for the side-panel header.

use std::fs::{self, File};
use std::path::{Component, Path, PathBuf, Prefix};
use std::time::SystemTime;

use time::OffsetDateTime;

use crate::mdoels::{FsEntry, FsEntryKind};

/// Windows logical drives (`GetLogicalDrives`), sorted A→Z.
#[tauri::command]
pub fn fs_list_drives() -> Result<Vec<FsEntry>, String> {
    list_logical_drives()
}

/// Directory entries for `path`. Directories first, then files (case-insensitive
/// name order). Inaccessible children are soft-skipped; a missing/unreadable
/// directory itself returns `Err`.
#[tauri::command]
pub fn fs_list_dir(path: String) -> Result<Vec<FsEntry>, String> {
    let root = PathBuf::from(path.trim());
    if root.as_os_str().is_empty() {
        return Err("path is required".into());
    }

    let read_dir = fs::read_dir(&root)
        .map_err(|err| format!("failed to list {}: {err}", root.display()))?;

    let mut dirs: Vec<FsEntry> = Vec::new();
    let mut files: Vec<FsEntry> = Vec::new();

    for entry in read_dir {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.is_empty() {
            continue;
        }
        let full = entry.path();
        let path_str = path_to_string(&full);

        if meta.is_dir() {
            dirs.push(FsEntry {
                name,
                path: path_str,
                kind: FsEntryKind::Dir,
                extension: None,
                size: None,
                modified: modified_rfc3339(&meta),
            });
        } else if meta.is_file() || meta.is_symlink() {
            let extension = file_extension(&name);
            files.push(FsEntry {
                name,
                path: path_str,
                kind: FsEntryKind::File,
                extension,
                size: Some(meta.len()),
                modified: modified_rfc3339(&meta),
            });
        }
    }

    dirs.sort_by(|a, b| {
        a.name
            .to_ascii_lowercase()
            .cmp(&b.name.to_ascii_lowercase())
    });
    files.sort_by(|a, b| {
        a.name
            .to_ascii_lowercase()
            .cmp(&b.name.to_ascii_lowercase())
    });
    dirs.append(&mut files);
    Ok(dirs)
}

/// Creates an empty file named `name` under `parent`.
#[tauri::command]
pub fn fs_create_file(parent: String, name: String) -> Result<FsEntry, String> {
    let target = join_child(&parent, &name)?;
    if target.exists() {
        return Err(format!("{} already exists", target.display()));
    }
    File::create_new(&target)
        .map_err(|err| format!("failed to create file {}: {err}", target.display()))?;
    entry_from_path(&target)
}

/// Creates a directory named `name` under `parent`.
#[tauri::command]
pub fn fs_create_dir(parent: String, name: String) -> Result<FsEntry, String> {
    let target = join_child(&parent, &name)?;
    if target.exists() {
        return Err(format!("{} already exists", target.display()));
    }
    fs::create_dir(&target)
        .map_err(|err| format!("failed to create directory {}: {err}", target.display()))?;
    entry_from_path(&target)
}

/// Renames the last path component of `path` to `new_name` (same parent).
#[tauri::command]
pub fn fs_rename(path: String, new_name: String) -> Result<FsEntry, String> {
    let src = PathBuf::from(path.trim());
    if src.as_os_str().is_empty() {
        return Err("path is required".into());
    }
    let new_name = sanitize_leaf_name(&new_name)?;
    let parent = src
        .parent()
        .ok_or_else(|| format!("cannot rename root path {}", src.display()))?;
    let dest = parent.join(&new_name);
    if dest.exists() {
        return Err(format!("{} already exists", dest.display()));
    }
    fs::rename(&src, &dest)
        .map_err(|err| format!("failed to rename {}: {err}", src.display()))?;
    entry_from_path(&dest)
}

/// Removes a file or directory. Directories are removed recursively (UI must
/// confirm before calling).
#[tauri::command]
pub fn fs_remove(path: String) -> Result<(), String> {
    let target = PathBuf::from(path.trim());
    if target.as_os_str().is_empty() {
        return Err("path is required".into());
    }
    if !target.exists() {
        return Err(format!("{} does not exist", target.display()));
    }
    let meta = fs::symlink_metadata(&target)
        .map_err(|err| format!("failed to stat {}: {err}", target.display()))?;
    if meta.is_dir() {
        fs::remove_dir_all(&target)
            .map_err(|err| format!("failed to remove {}: {err}", target.display()))?;
    } else {
        fs::remove_file(&target)
            .map_err(|err| format!("failed to remove {}: {err}", target.display()))?;
    }
    Ok(())
}

/// Metadata for the About modal (drive / dir / file).
#[tauri::command]
pub fn fs_entry_info(path: String) -> Result<FsEntry, String> {
    let target = PathBuf::from(path.trim());
    if target.as_os_str().is_empty() {
        return Err("path is required".into());
    }
    entry_from_path(&target)
}

/// Opens `path` with the OS default application.
#[tauri::command]
pub fn fs_open_path(path: String) -> Result<(), String> {
    let target = PathBuf::from(path.trim());
    if target.as_os_str().is_empty() {
        return Err("path is required".into());
    }
    tauri_plugin_opener::open_path(&target, None::<&str>)
        .map_err(|err| format!("failed to open {}: {err}", target.display()))
}

/// Reveals `path` in Explorer (same opener plugin as `open_configs_folder`).
#[tauri::command]
pub fn fs_reveal_path(path: String) -> Result<(), String> {
    let target = PathBuf::from(path.trim());
    if target.as_os_str().is_empty() {
        return Err("path is required".into());
    }
    tauri_plugin_opener::reveal_item_in_dir(&target)
        .map_err(|err| format!("failed to reveal {}: {err}", target.display()))
}

/// Windows username for the explorer header (`USERNAME`, then `USER`).
#[tauri::command]
pub fn fs_username() -> Result<String, String> {
    if let Ok(name) = std::env::var("USERNAME") {
        let trimmed = name.trim();
        if !trimmed.is_empty() {
            return Ok(trimmed.to_string());
        }
    }
    if let Ok(name) = std::env::var("USER") {
        let trimmed = name.trim();
        if !trimmed.is_empty() {
            return Ok(trimmed.to_string());
        }
    }
    Err("could not determine username".into())
}

fn list_logical_drives() -> Result<Vec<FsEntry>, String> {
    #[cfg(windows)]
    {
        #[link(name = "kernel32")]
        extern "system" {
            fn GetLogicalDrives() -> u32;
        }

        let mask = unsafe { GetLogicalDrives() };
        if mask == 0 {
            return Err("GetLogicalDrives returned no drives".into());
        }

        let mut drives = Vec::new();
        for i in 0..26u32 {
            if mask & (1 << i) == 0 {
                continue;
            }
            let letter = (b'A' + i as u8) as char;
            let path = format!("{letter}:\\");
            let name = format!("{letter}:");
            drives.push(FsEntry {
                name,
                path,
                kind: FsEntryKind::Drive,
                extension: None,
                size: None,
                modified: None,
            });
        }
        Ok(drives)
    }

    #[cfg(not(windows))]
    {
        let mut drives = Vec::new();
        for root in ["/", "/home", "/tmp"] {
            let p = Path::new(root);
            if p.exists() {
                drives.push(FsEntry {
                    name: root.to_string(),
                    path: root.to_string(),
                    kind: FsEntryKind::Drive,
                    extension: None,
                    size: None,
                    modified: None,
                });
            }
        }
        if drives.is_empty() {
            Err("no filesystem roots found".into())
        } else {
            Ok(drives)
        }
    }
}

fn join_child(parent: &str, name: &str) -> Result<PathBuf, String> {
    let parent = PathBuf::from(parent.trim());
    if parent.as_os_str().is_empty() {
        return Err("parent path is required".into());
    }
    let name = sanitize_leaf_name(name)?;
    Ok(parent.join(name))
}

fn sanitize_leaf_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("name is required".into());
    }
    if trimmed.contains(['/', '\\']) || trimmed == "." || trimmed == ".." {
        return Err("invalid name".into());
    }
    #[cfg(windows)]
    {
        if trimmed.contains(['<', '>', ':', '"', '|', '?', '*']) {
            return Err("invalid name".into());
        }
    }
    Ok(trimmed.to_string())
}

fn entry_from_path(path: &Path) -> Result<FsEntry, String> {
    let path_str = path_to_string(path);

    if is_windows_drive_root(path) {
        return Ok(FsEntry {
            name: drive_display_name(path),
            path: path_str,
            kind: FsEntryKind::Drive,
            extension: None,
            size: None,
            modified: None,
        });
    }

    let meta = fs::symlink_metadata(path)
        .map_err(|err| format!("failed to stat {}: {err}", path.display()))?;
    let name = path
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| path_str.clone());

    if meta.is_dir() {
        Ok(FsEntry {
            name,
            path: path_str,
            kind: FsEntryKind::Dir,
            extension: None,
            size: None,
            modified: modified_rfc3339(&meta),
        })
    } else {
        let extension = file_extension(&name);
        Ok(FsEntry {
            name,
            path: path_str,
            kind: FsEntryKind::File,
            extension,
            size: Some(meta.len()),
            modified: modified_rfc3339(&meta),
        })
    }
}

fn is_windows_drive_root(path: &Path) -> bool {
    #[cfg(windows)]
    {
        let mut components = path.components();
        match (components.next(), components.next()) {
            (Some(Component::Prefix(prefix)), Some(Component::RootDir)) => {
                matches!(
                    prefix.kind(),
                    Prefix::Disk(_) | Prefix::VerbatimDisk(_)
                ) && components.next().is_none()
            }
            (Some(Component::Prefix(prefix)), None) => {
                matches!(prefix.kind(), Prefix::Disk(_) | Prefix::VerbatimDisk(_))
            }
            _ => false,
        }
    }
    #[cfg(not(windows))]
    {
        let _ = path;
        false
    }
}

fn drive_display_name(path: &Path) -> String {
    #[cfg(windows)]
    {
        for component in path.components() {
            if let Component::Prefix(prefix) = component {
                if let Prefix::Disk(letter) | Prefix::VerbatimDisk(letter) = prefix.kind() {
                    return format!("{}:", (letter as char).to_ascii_uppercase());
                }
            }
        }
    }
    path_to_string(path)
}

fn file_extension(name: &str) -> Option<String> {
    Path::new(name)
        .extension()
        .and_then(|e| e.to_str())
        .filter(|e| !e.is_empty())
        .map(|e| e.to_ascii_lowercase())
}

fn modified_rfc3339(meta: &fs::Metadata) -> Option<String> {
    let modified: SystemTime = meta.modified().ok()?;
    let duration = modified.duration_since(SystemTime::UNIX_EPOCH).ok()?;
    let secs = i64::try_from(duration.as_secs()).ok()?;
    let datetime = OffsetDateTime::from_unix_timestamp(secs).ok()?;
    datetime
        .format(&time::format_description::well_known::Rfc3339)
        .ok()
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}
