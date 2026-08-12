export type {
  AppInfo,
  AppSettings,
  CursorStyle,
  GreetArgs,
  GreetResponse,
  Keybinding,
  KeybindingScope,
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
} from "./tauri";

export interface ContextMenuPosition {
  x: number;
  y: number;
}

// The tray's right-click menu is its own Tauri window (see
// pages/tray-menu/TrayMenuWindow.tsx), not an overlay inside the main
// window, so it isn't a member of this union.
export type ContextMenuTarget = "titlebar" | "content";

export interface ContextMenuState extends ContextMenuPosition {
  target: ContextMenuTarget | null;
}
