import { invoke } from "@tauri-apps/api/core";

import { createTabId } from "./session-manager";
import type { FsEntry } from "../../types";
import type {
  GitChangeStatus,
  GitDiffLine,
  GitDiffSide,
  GitFileDiff,
} from "../../types/git-scm";

export type { GitDiffLine, GitDiffSide, GitFileDiff };

export type DiffListSection =
  | "staged"
  | "unstaged"
  | "changes"
  | "conflicted"
  | "clean";

export interface OpenDiffRequest {
  repoRoot: string;
  path: string;
  absolutePath: string;
  side: GitDiffSide;
  status: GitChangeStatus;
}

export interface DiffTabState {
  tabId: string;
  repoRoot: string;
  path: string;
  absolutePath: string;
  side: GitDiffSide;
  status: GitChangeStatus;
  title: string;
}

export interface UnifiedDocument {
  text: string;
  lines: GitDiffLine[];
}

const LANGUAGE_BY_EXT: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  rs: "rust",
  json: "json",
  jsonc: "json",
  md: "markdown",
  markdown: "markdown",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  htm: "html",
  xml: "xml",
  py: "python",
  toml: "ini",
  yml: "yaml",
  yaml: "yaml",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  ps1: "powershell",
  psm1: "powershell",
  go: "go",
  java: "java",
  kt: "kotlin",
  cs: "csharp",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  h: "cpp",
  hpp: "cpp",
  c: "c",
  rb: "ruby",
  php: "php",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
  svelte: "html",
  vue: "html",
  txt: "plaintext",
};

export async function gitFileDiff(
  path: string,
  filePath: string,
  side: GitDiffSide,
): Promise<GitFileDiff> {
  return invoke<GitFileDiff>("git_file_diff", { path, filePath, side });
}

export function diffSideFromSection(section: DiffListSection): GitDiffSide {
  return section === "staged" ? "staged" : "unstaged";
}

export function diffSideLabel(side: GitDiffSide): string {
  return side === "staged" ? "Staged" : "Working Tree";
}

export function fileNameFromPath(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, "");
  if (!trimmed) return path;
  const slash = Math.max(trimmed.lastIndexOf("\\"), trimmed.lastIndexOf("/"));
  if (slash < 0) return trimmed;
  return trimmed.slice(slash + 1) || trimmed;
}

export function fileEntryFromPath(filePath: string): FsEntry {
  const name = fileNameFromPath(filePath);
  const dot = name.lastIndexOf(".");
  const extension = dot > 0 ? name.slice(dot + 1) : undefined;
  return { name, path: filePath, kind: "file", extension };
}

export function languageFromPath(path: string): string {
  const name = fileNameFromPath(path).toLowerCase();
  if (name === "dockerfile" || name.startsWith("dockerfile.")) {
    return "dockerfile";
  }
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "plaintext";
  return LANGUAGE_BY_EXT[name.slice(dot + 1)] ?? "plaintext";
}

export function assembleUnifiedDocument(lines: GitDiffLine[]): UnifiedDocument {
  return {
    text: lines.map((line) => line.text).join("\n"),
    lines,
  };
}

/**
 * Convert a Unicode scalar (char) offset into a 0-based UTF-16 code unit
 * offset. Rust `git_file_diff` highlights use scalar indices; Monaco columns
 * use UTF-16.
 */
export function charOffsetToUtf16(text: string, charOffset: number): number {
  if (charOffset <= 0) return 0;
  let chars = 0;
  let utf16 = 0;
  for (const ch of text) {
    if (chars >= charOffset) break;
    utf16 += ch.length;
    chars += 1;
  }
  return utf16;
}

/** Monaco columns are 1-based UTF-16; highlights are 0-based [start, end). */
export function highlightToMonacoColumns(
  text: string,
  start: number,
  end: number,
): { startColumn: number; endColumn: number } {
  const from = Math.max(0, start);
  const to = Math.max(from, end);
  return {
    startColumn: charOffsetToUtf16(text, from) + 1,
    endColumn: charOffsetToUtf16(text, to) + 1,
  };
}

/** True for the Rust `file not found: …` string (and close variants). */
export function isMissingDiffError(message: string): boolean {
  return /not found|no such file|missing|does not exist/i.test(message);
}

export function isCleanDiff(diff: GitFileDiff | null | undefined): boolean {
  if (!diff || diff.binary) return false;
  if (diff.lines.length === 0) return true;
  return !diff.lines.some(
    (line) => line.kind === "insert" || line.kind === "delete",
  );
}

export function formatDiffLineNumber(line: GitDiffLine | undefined): string {
  if (!line) return "";
  if (line.kind === "delete") {
    return line.oldLine != null ? String(line.oldLine) : "";
  }
  if (line.kind === "insert") {
    return line.newLine != null ? String(line.newLine) : "";
  }
  const oldNum = line.oldLine != null ? String(line.oldLine) : "";
  const newNum = line.newLine != null ? String(line.newLine) : "";
  if (oldNum && newNum && oldNum !== newNum) {
    return `${oldNum} ${newNum}`;
  }
  return newNum || oldNum;
}

/** 1-based document line numbers where a change hunk starts. */
export function changeHunkStarts(lines: GitDiffLine[]): number[] {
  const starts: number[] = [];
  let inHunk = false;
  for (let i = 0; i < lines.length; i += 1) {
    const changed =
      lines[i]?.kind === "insert" || lines[i]?.kind === "delete";
    if (changed && !inHunk) {
      starts.push(i + 1);
    }
    inHunk = changed;
  }
  return starts;
}

export function normalizeRepoRoot(root: string): string {
  return root.replace(/[\\/]+$/, "").replace(/\\/g, "/").toLowerCase();
}

export function normalizeRepoPath(path: string): string {
  return path.replace(/\\/g, "/");
}

export function diffTabKey(
  repoRoot: string,
  path: string,
  side: GitDiffSide,
): string {
  return `${normalizeRepoRoot(repoRoot)}\0${normalizeRepoPath(path)}\0${side}`;
}

export function findDiffTab(
  tabs: DiffTabState[],
  repoRoot: string,
  path: string,
  side: GitDiffSide,
): DiffTabState | undefined {
  const key = diffTabKey(repoRoot, path, side);
  return tabs.find(
    (tab) => diffTabKey(tab.repoRoot, tab.path, tab.side) === key,
  );
}

export function createDiffTabState(
  input: OpenDiffRequest & { tabId?: string },
): DiffTabState {
  return {
    tabId: input.tabId ?? createTabId(),
    repoRoot: input.repoRoot,
    path: input.path,
    absolutePath: input.absolutePath,
    side: input.side,
    status: input.status,
    title: fileNameFromPath(input.path),
  };
}

export function ensureActiveWorkspaceTab(
  terminalTabs: { tabId: string }[],
  diffTabs: { tabId: string }[],
  activeTabId: string | null,
): string | null {
  if (activeTabId && terminalTabs.some((tab) => tab.tabId === activeTabId)) {
    return activeTabId;
  }
  if (activeTabId && diffTabs.some((tab) => tab.tabId === activeTabId)) {
    return activeTabId;
  }
  return terminalTabs[0]?.tabId ?? diffTabs[0]?.tabId ?? null;
}
