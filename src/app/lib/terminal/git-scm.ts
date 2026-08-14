import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

import { getStoreValue, setStoreValue } from "../app-store";
import { errorMessage } from "./explorer-fs";
import type { FsEntry } from "../../types/explorer";
import type {
  GitBranchInfo,
  GitChangeEntry,
  GitChangeStatus,
  GitCommitResult,
  GitOpenFolderResult,
  GitStatusResult,
  GitTreeDecoration,
  GitTreeEntry,
  ScmChangedPayload,
  ScmListSection,
  ScmPanelState,
} from "../../types/git-scm";

export type { ScmChangedPayload };

export const SCM_FOLDER_KEY = "scm.folderPath";
export const SCM_CHANGED_EVENT = "scm-changed";

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

export async function gitListDir(
  path: string,
  dir = "",
): Promise<GitTreeEntry[]> {
  return invoke<GitTreeEntry[]>("git_list_dir", { path, dir });
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

export async function gitWatchStart(path: string): Promise<void> {
  return invoke<void>("git_watch_start", { path });
}

export async function gitWatchStop(): Promise<void> {
  return invoke<void>("git_watch_stop");
}

export async function subscribeScmChanged(
  onChange: (payload: ScmChangedPayload) => void,
): Promise<UnlistenFn> {
  return listen<ScmChangedPayload>(SCM_CHANGED_EVENT, (event) => {
    onChange(event.payload);
  });
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

/** Tracked dirty paths for the Unstaged section. */
export function unstagedSectionEntries(
  status: GitStatusResult | null,
): GitChangeEntry[] {
  if (!status) return [];
  return [...status.unstaged];
}

/** Untracked paths for the Changes section. */
export function changesSectionEntries(
  status: GitStatusResult | null,
): GitChangeEntry[] {
  if (!status) return [];
  return [...status.untracked];
}

/** Paths eligible for auto-stage (unstaged + untracked; never conflicted). */
export function autoStagePaths(status: GitStatusResult | null): string[] {
  if (!status) return [];
  return [...status.unstaged, ...status.untracked].map((entry) => entry.path);
}

const TREE_DECORATION_RANK: GitTreeDecoration[] = [
  "conflict",
  "staged",
  "unstaged",
  "untracked",
  "ignored",
  "unchanged",
];

/** Highest-priority folder decoration (conflict > staged/unstaged > untracked > ignored > unchanged). */
export function highestTreeDecoration(
  decorations: GitTreeDecoration[],
): GitTreeDecoration {
  let best: GitTreeDecoration = "unchanged";
  let bestRank = TREE_DECORATION_RANK.indexOf("unchanged");
  for (const decoration of decorations) {
    const rank = TREE_DECORATION_RANK.indexOf(decoration);
    if (rank >= 0 && rank < bestRank) {
      best = decoration;
      bestRank = rank;
    }
  }
  return best;
}

export function treeDecorationLabel(
  decoration: GitTreeDecoration,
  status?: GitChangeStatus | null,
): string | null {
  switch (decoration) {
    case "unchanged":
      return null;
    case "ignored":
      return "I";
    case "untracked":
      return "U";
    case "conflict":
      return "!";
    case "staged":
    case "unstaged":
      return status ? changeStatusLabel(status) : "M";
    default:
      return null;
  }
}

export function treeSectionForEntry(entry: GitTreeEntry): ScmListSection {
  switch (entry.decoration) {
    case "staged":
      return "staged";
    case "unstaged":
      return "unstaged";
    case "untracked":
      return "changes";
    case "conflict":
      return "conflicted";
    default:
      return "clean";
  }
}

export function treeEntryToChangeEntry(entry: GitTreeEntry): GitChangeEntry {
  const status =
    entry.status ??
    (entry.decoration === "conflict"
      ? "conflict"
      : entry.decoration === "untracked"
        ? "untracked"
        : "modified");
  return {
    path: entry.path,
    absolutePath: entry.absolutePath,
    status,
  };
}

export function gitTreeEntryToFsEntry(entry: GitTreeEntry): FsEntry {
  const dot = entry.name.lastIndexOf(".");
  const extension =
    entry.kind === "file" && dot > 0 ? entry.name.slice(dot + 1) : undefined;
  return {
    name: entry.name,
    path: entry.absolutePath,
    kind: entry.kind === "dir" ? "dir" : "file",
    extension,
  };
}

export function treeEntryTooltip(entry: GitTreeEntry): string {
  const parts = [entry.path];
  if (entry.ignored || entry.decoration === "ignored") {
    parts.push("Ignored");
  } else if (entry.decoration === "unchanged") {
    parts.push("Unchanged");
  } else if (entry.decoration === "staged") {
    parts.push("Staged");
  } else if (entry.decoration === "unstaged") {
    parts.push("Unstaged");
  } else if (entry.decoration === "untracked") {
    parts.push("Untracked");
  } else if (entry.decoration === "conflict") {
    parts.push("Conflict");
  }
  if (entry.status && entry.decoration !== "untracked") {
    parts.push(changeStatusLabel(entry.status));
  }
  return parts.join(" · ");
}

export function normGitRela(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

export interface GitTreeVisibleRow {
  entry: GitTreeEntry;
  depth: number;
  expanded: boolean;
  loading: boolean;
  pending: boolean;
  empty: boolean;
  error?: string;
}

export function buildGitTreeRows(options: {
  entries: GitTreeEntry[];
  children: Record<string, GitTreeEntry[]>;
  expanded: Set<string>;
  loadingPaths: Set<string>;
  errors: Record<string, string>;
}): GitTreeVisibleRow[] {
  const rows: GitTreeVisibleRow[] = [];

  const walk = (current: GitTreeEntry[], depth: number) => {
    for (const entry of current) {
      const key = normGitRela(entry.path);
      const isDir = entry.kind === "dir";
      const isExpanded = isDir && options.expanded.has(key);
      const loading = options.loadingPaths.has(key);
      const error = options.errors[key];
      const kids = options.children[key];
      const pending = isDir && isExpanded && loading && !Array.isArray(kids);
      const empty =
        isDir &&
        isExpanded &&
        !loading &&
        !error &&
        Array.isArray(kids) &&
        kids.length === 0;

      rows.push({
        entry,
        depth,
        expanded: Boolean(isExpanded),
        loading,
        pending,
        empty,
        error,
      });

      if (isDir && isExpanded && kids) {
        walk(kids, depth + 1);
      }
    }
  };

  walk(options.entries, 0);
  return rows;
}

export function emptyStatus(): GitStatusResult {
  return { staged: [], unstaged: [], untracked: [], conflicted: [] };
}

export function scmRootsEqual(a: string, b: string): boolean {
  const norm = (value: string) =>
    value.replace(/[\\/]+$/, "").replace(/\\/g, "/").toLowerCase();
  return norm(a) === norm(b);
}
