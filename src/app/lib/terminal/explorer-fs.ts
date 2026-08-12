import { invoke } from "@tauri-apps/api/core";

import type { FsEntry, FsEntryInfo, FsUsernameResponse } from "../../types";

/**
 * Thin wrappers around Rust explorer commands.
 * Handlers take flat params (`path`, `parent`/`name`, `newName`) — not an `args` bag.
 */
export async function fsListDrives(): Promise<FsEntry[]> {
  return invoke<FsEntry[]>("fs_list_drives");
}

export async function fsListDir(path: string): Promise<FsEntry[]> {
  return invoke<FsEntry[]>("fs_list_dir", { path });
}

export async function fsCreateFile(
  parent: string,
  name: string,
): Promise<FsEntry> {
  return invoke<FsEntry>("fs_create_file", { parent, name });
}

export async function fsCreateDir(
  parent: string,
  name: string,
): Promise<FsEntry> {
  return invoke<FsEntry>("fs_create_dir", { parent, name });
}

export async function fsRename(
  path: string,
  newName: string,
): Promise<FsEntry> {
  return invoke<FsEntry>("fs_rename", { path, newName });
}

export async function fsRemove(path: string): Promise<void> {
  return invoke<void>("fs_remove", { path });
}

export async function fsEntryInfo(path: string): Promise<FsEntryInfo> {
  return invoke<FsEntryInfo>("fs_entry_info", { path });
}

export async function fsOpenPath(path: string): Promise<void> {
  return invoke<void>("fs_open_path", { path });
}

export async function fsRevealPath(path: string): Promise<void> {
  return invoke<void>("fs_reveal_path", { path });
}

export async function fsUsername(): Promise<FsUsernameResponse> {
  return invoke<FsUsernameResponse>("fs_username");
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const record = error as { message?: unknown; error?: unknown };
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message;
    }
    if (typeof record.error === "string" && record.error.trim()) {
      return record.error;
    }
  }
  return fallback;
}

/** Soften common Windows/OS permission failures for muted tree status rows. */
export function formatFsError(error: unknown, fallback: string): string {
  const raw = errorMessage(error, fallback);
  if (/access is denied|permission denied|os error 5/i.test(raw)) {
    return "Permission denied";
  }
  return raw;
}
