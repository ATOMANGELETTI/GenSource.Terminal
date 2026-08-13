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
