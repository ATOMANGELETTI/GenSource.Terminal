export type {
  AppInfo,
  AppSettings,
  CursorStyle,
  FileIconSet,
  GreetArgs,
  GreetResponse,
  Keybinding,
  KeybindingScope,
  KeybindingsFile,
  LoggingSettings,
  ParticleEffect,
  PinnedTabRecord,
  PinnedTabsState,
  PtyCreateArgs,
  PtyCreateResult,
  PtyExitEvent,
  PtyKillArgs,
  PtyOutputEvent,
  PtyResizeArgs,
  PtyWriteArgs,
  TerminalProfile,
  SystemMetrics,
} from "./tauri";

export type {
  ExplorerDraft,
  ExplorerDraftMode,
  FsCreateArgs,
  FsEntry,
  FsEntryInfo,
  FsEntryKind,
  FsListDirArgs,
  FsPathArgs,
  FsRenameArgs,
  FsUsernameResponse,
} from "./explorer";

export type {
  GitBranchInfo,
  GitChangeEntry,
  GitChangeKind,
  GitChangeStatus,
  GitCommitResult,
  GitOpenFolderResult,
  GitStatusResult,
  ScmChangedPayload,
  ScmPanelState,
} from "./git-scm";

export type {
  AgentChatMessage,
  AgentChatSendArgs,
  AgentChunkEvent,
  AgentConfig,
  AgentConfirmDecision,
  AgentConfirmEvent,
  AgentDevEnvSecrets,
  AgentConversation,
  AgentDoneEvent,
  AgentErrorEvent,
  AgentMessageRole,
  AgentProviderConfig,
  AgentStoredMessage,
  AgentTerminalContext,
  AgentToolEvent,
  PortableDataPaths,
} from "./agent";

export interface ContextMenuPosition {
  x: number;
  y: number;
}

// In-app context menus (titlebar, content, tabs, file tree, SCM) render in a
// dedicated `context-menu` Tauri window (see pages/context-menu/). The tray
// flyout stays on its own `tray-menu` window and is not part of this union.
export type ContextMenuTarget = "titlebar" | "content";

export interface ContextMenuState extends ContextMenuPosition {
  target: ContextMenuTarget | null;
}
