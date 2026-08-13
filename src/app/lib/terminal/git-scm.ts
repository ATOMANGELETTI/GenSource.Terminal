import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

import { getStoreValue, setStoreValue } from "../app-store";
import { errorMessage } from "./explorer-fs";
import type {
  GitBranchInfo,
  GitChangeEntry,
  GitChangeStatus,
  GitCommitResult,
  GitOpenFolderResult,
  GitStatusResult,
  ScmPanelState,
} from "../../types/git-scm";

export const SCM_FOLDER_KEY = "scm.folderPath";

export async function loadScmFolderPath(): Promise<string | null> {
  const raw = await getStoreValue<unknown>(SCM_FOLDER_KEY);
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function saveScmFolderPath(path: string | null): Promise<void> {
  if (!path || !path.trim()) {
    await setStoreValue(SCM_FOLDER_KEY, null);
    return;
  }
  await setStoreValue(SCM_FOLDER_KEY, path);
}

/** Directory picker for SCM workspace root. */
export async function pickScmFolder(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Open Folder",
  });
  if (typeof selected === "string" && selected.trim()) {
    return selected;
  }
  return null;
}

export async function gitOpenFolder(path: string): Promise<GitOpenFolderResult> {
  return invoke<GitOpenFolderResult>("git_open_folder", { path });
}

export async function gitInit(path: string): Promise<GitOpenFolderResult> {
  return invoke<GitOpenFolderResult>("git_init", { path });
}

export async function gitStatus(path: string): Promise<GitStatusResult> {
  return invoke<GitStatusResult>("git_status", { path });
}

export async function gitStage(path: string, paths: string[]): Promise<void> {
  return invoke<void>("git_stage", { path, paths });
}

export async function gitUnstage(path: string, paths: string[]): Promise<void> {
  return invoke<void>("git_unstage", { path, paths });
}

export async function gitDiscard(path: string, paths: string[]): Promise<void> {
  return invoke<void>("git_discard", { path, paths });
}

export async function gitCommit(
  path: string,
  message: string,
): Promise<GitCommitResult> {
  return invoke<GitCommitResult>("git_commit", { path, message });
}

export async function gitBranches(path: string): Promise<GitBranchInfo[]> {
  return invoke<GitBranchInfo[]>("git_branches", { path });
}

export async function gitCheckout(path: string, branch: string): Promise<void> {
  return invoke<void>("git_checkout", { path, branch });
}

export async function gitCreateBranch(
  path: string,
  name: string,
  checkout = true,
): Promise<void> {
  return invoke<void>("git_create_branch", { path, name, checkout });
}

export function scmErrorMessage(error: unknown, fallback: string): string {
  return errorMessage(error, fallback);
}

/** Last path segment for headers (handles `C:\\foo\\bar` and `/foo/bar`). */
export function folderDisplayName(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, "");
  if (!trimmed) return path;
  if (/^[A-Za-z]:$/.test(trimmed)) {
    return `${trimmed}\\`;
  }
  const slash = Math.max(trimmed.lastIndexOf("\\"), trimmed.lastIndexOf("/"));
  if (slash < 0) return trimmed;
  return trimmed.slice(slash + 1) || trimmed;
}

export function resolveScmPanelState(
  folderPath: string | null,
  openResult: GitOpenFolderResult | null,
): ScmPanelState {
  if (!folderPath) return "empty";
  if (!openResult || !openResult.isRepo) return "init";
  return "repo";
}

export function canCommit(message: string, stagedCount: number): boolean {
  return stagedCount > 0 && message.trim().length > 0;
}

export function changeStatusLabel(status: GitChangeStatus): string {
  switch (status) {
    case "modified":
      return "M";
    case "added":
    case "intentToAdd":
      return "A";
    case "deleted":
      return "D";
    case "renamed":
      return "R";
    case "copied":
      return "C";
    case "untracked":
      return "U";
    case "conflict":
      return "!";
    case "typeChange":
      return "T";
    default:
      return "?";
  }
}

/** Merge unstaged + untracked for the Changes section (VS Code-like). */
export function changesSectionEntries(
  status: GitStatusResult | null,
): GitChangeEntry[] {
  if (!status) return [];
  return [...status.unstaged, ...status.untracked];
}

export function emptyStatus(): GitStatusResult {
  return { staged: [], unstaged: [], untracked: [], conflicted: [] };
}
