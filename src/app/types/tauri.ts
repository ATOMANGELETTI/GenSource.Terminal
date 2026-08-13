export interface AppInfo {
  name: string;
  version: string;
  description?: string;
  productName?: string;
  identifier?: string;
  publisher?: string;
  codename?: string;
  edition?: number;
}

export type CursorStyle = "block" | "underline" | "bar";

/** Terminal particle background mode (`settings.json` `particleEffect`). */
export type ParticleEffect = "dust" | "constellation" | "orbs";

/** File explorer icon set (`settings.json` `fileIconSet`). */
export type FileIconSet = "material" | "catppuccin" | "nord";

export interface TerminalProfile {
  id: string;
  name: string;
  command: string;
  args?: string[];
  startingDirectory?: string | null;
}

export interface AppSettings {
  theme: string;
  fontFamily: string;
  fontSize: number;
  particleEffect: ParticleEffect | string;
  startMinimized: boolean;
  autostart: boolean;
  alwaysOnTop: boolean;
  defaultProfile: string;
  terminalFontFamily?: string | null;
  terminalFontSize?: number | null;
  scrollbackLines: number;
  cursorStyle: CursorStyle | string;
  cursorBlink: boolean;
  fileIconSet: FileIconSet | string;
  profiles: TerminalProfile[];
}

export interface PtyCreateArgs {
  profileId: string;
  cols: number;
  rows: number;
  /** Optional one-shot working directory (overrides profile startingDirectory). */
  cwd?: string | null;
}

export interface PtyCreateResult {
  sessionId: string;
}

export interface PtyWriteArgs {
  sessionId: string;
  data: string;
}

export interface PtyResizeArgs {
  sessionId: string;
  cols: number;
  rows: number;
}

export interface PtyKillArgs {
  sessionId: string;
}

export interface PtyOutputEvent {
  sessionId: string;
  data: string;
}

export interface PtyExitEvent {
  sessionId: string;
  code: number | null;
}

export interface PinnedTabRecord {
  tabId: string;
  profileId: string;
  title: string;
  scrollback: string;
  wasActive: boolean;
}

export interface PinnedTabsState {
  version: 1;
  tabs: PinnedTabRecord[];
}

export type KeybindingScope = "global" | "local";

export interface Keybinding {
  id: string;
  shortcut: string;
  enabled: boolean;
  scope: KeybindingScope;
}

/** On-disk `other/configs/keybindings.json` shape (`save_keybindings`). */
export interface KeybindingsFile {
  bindings: Keybinding[];
}

/** On-disk `other/configs/logging.json` shape (`get_logging` / `save_logging`). */
export interface LoggingSettings {
  error: boolean;
  warn: boolean;
  info: boolean;
  debug: boolean;
  trace: boolean;
  fatal: boolean;
}

/** Matches `commands::greet` which returns a bare `String`. */
export type GreetResponse = string;

export interface GreetArgs {
  name: string;
}

/** Snapshot from `get_system_metrics`. */
export interface SystemMetrics {
  cpuPercent: number;
  /** Omitted when GPU counters are unavailable. */
  gpuPercent?: number;
  ramUsedBytes: number;
  ramTotalBytes: number;
  netUpBps: number;
  netDownBps: number;
  /** Omitted when thermal sensors are unavailable. */
  cpuTempCelsius?: number;
  gpuTempCelsius?: number;
  ramTempCelsius?: number;
}

/** Source Control / git command types — see `./git-scm`. */
export type {
  GitBranchInfo,
  GitChangeEntry,
  GitChangeKind,
  GitChangeStatus,
  GitCommitResult,
  GitOpenFolderResult,
  GitStatusResult,
  ScmPanelState,
} from "./git-scm";
