/** Files Explorer IPC types (mirrors `mdoels::FsEntry` / explorer commands). */

export type FsEntryKind = "drive" | "dir" | "file";

export interface FsEntry {
  name: string;
  path: string;
  kind: FsEntryKind;
  extension?: string;
  size?: number;
  /** RFC3339 timestamp when available. */
  modified?: string;
}

/** Metadata payload for the About modal (`fs_entry_info`). */
export type FsEntryInfo = FsEntry;

export interface FsListDirArgs {
  path: string;
}

export interface FsCreateArgs {
  parent: string;
  name: string;
}

export interface FsRenameArgs {
  path: string;
  newName: string;
}

export interface FsPathArgs {
  path: string;
}

/** Matches `fs_username` which returns a bare `String`. */
export type FsUsernameResponse = string;

export type ExplorerDraftMode = "create-file" | "create-dir" | "rename";

export interface ExplorerDraft {
  mode: ExplorerDraftMode;
  /** Directory that owns the new/renamed row. */
  parentPath: string;
  /** Existing path when renaming. */
  path?: string;
  draftName: string;
}
