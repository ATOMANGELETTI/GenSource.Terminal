/** Source Control / gitoxide IPC types (mirrors `git_*` commands). */

export type GitChangeStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "typeChange"
  | "untracked"
  | "conflict"
  | "intentToAdd";

/** @deprecated Prefer `GitChangeStatus`. */
export type GitChangeKind = GitChangeStatus;

export interface GitOpenFolderResult {
  /** SCM folder the user opened (may be inside a repo). */
  folderPath: string;
  /** Git worktree root when `isRepo`, otherwise the opened folder. */
  root: string;
  isRepo: boolean;
  branch?: string | null;
  /** Short HEAD object id when available. */
  head?: string | null;
  ahead?: number | null;
  behind?: number | null;
}

export interface GitChangeEntry {
  /** Repository-relative path using `/` separators. */
  path: string;
  absolutePath: string;
  status: GitChangeStatus;
}

export interface GitStatusResult {
  staged: GitChangeEntry[];
  unstaged: GitChangeEntry[];
  untracked: GitChangeEntry[];
  conflicted: GitChangeEntry[];
}

export type GitTreeDecoration =
  | "unchanged"
  | "staged"
  | "unstaged"
  | "untracked"
  | "ignored"
  | "conflict";

export type GitTreeEntryKind = "file" | "dir";

export interface GitTreeEntry {
  name: string;
  /** Repository-relative path using `/` separators. */
  path: string;
  absolutePath: string;
  kind: GitTreeEntryKind;
  decoration: GitTreeDecoration;
  status?: GitChangeStatus;
  ignored: boolean;
}

/** SCM change-list / tree context-menu section. */
export type ScmListSection =
  | "staged"
  | "unstaged"
  | "changes"
  | "conflicted"
  | "clean";

export interface GitBranchInfo {
  name: string;
  isCurrent: boolean;
}

export interface GitCommitResult {
  id: string;
}

export type ScmPanelState = "empty" | "init" | "repo";

/** Payload for the `scm-changed` watch event. */
export interface ScmChangedPayload {
  root: string;
}

/** `git_file_diff` comparison side. */
export type GitDiffSide = "staged" | "unstaged";

export type GitDiffLineKind = "equal" | "insert" | "delete";

export interface GitDiffHighlight {
  /** Inclusive Unicode scalar offset into `text` (not UTF-16). */
  start: number;
  /** Exclusive Unicode scalar offset into `text` (not UTF-16). */
  end: number;
}

export interface GitDiffLine {
  kind: GitDiffLineKind;
  oldLine?: number | null;
  newLine?: number | null;
  text: string;
  highlights?: GitDiffHighlight[];
}

/** Unified per-file diff from `git_file_diff`. */
export interface GitFileDiff {
  path: string;
  absolutePath: string;
  status: GitChangeStatus;
  side: GitDiffSide;
  binary: boolean;
  truncated: boolean;
  additions: number;
  deletions: number;
  oldLabel: string;
  newLabel: string;
  lines: GitDiffLine[];
}
