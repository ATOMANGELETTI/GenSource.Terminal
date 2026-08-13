/**
 * In-app context menus live in a dedicated transparent `context-menu`
 * WebviewWindow (same idea as `tray-menu`) so they can paint outside the
 * main OS window while keeping the shared flat `.context-menu` CSS.
 *
 * Outside Tauri (Vite e2e) {@link openContextMenuPopup} returns false and
 * callers fall back to an in-webview overlay.
 */

import { emit, emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  LogicalSize,
  PhysicalPosition,
  getCurrentWindow,
  monitorFromPoint,
} from "@tauri-apps/api/window";

import { isE2eMode } from "./e2e-window";
import type { FsEntry } from "../types";
import type { GitChangeEntry } from "../types/git-scm";

export type ScmChangeListSection = "staged" | "changes" | "conflicted";

export const CONTEXT_MENU_WINDOW_LABEL = "context-menu";

export const CONTEXT_MENU_OPEN_EVENT = "context-menu-open";
export const CONTEXT_MENU_ACTION_EVENT = "context-menu-action";

export type ContextMenuKind =
  | "titlebar"
  | "content"
  | "tab"
  | "file-tree"
  | "scm-change"
  | "scm-tab";

export interface TitlebarMenuPayload {
  kind: "titlebar";
  maximized: boolean;
}

export interface ContentMenuPayload {
  kind: "content";
  productName: string;
  /** Terminal actions are available when the workspace is mounted. */
  hasTerminal: boolean;
}

export interface TabMenuPayload {
  kind: "tab";
  tabId: string;
  pinned: boolean;
  canCloseAll: boolean;
}

export interface FileTreeMenuPayload {
  kind: "file-tree";
  entry: FsEntry;
}

export interface ScmChangeMenuPayload {
  kind: "scm-change";
  entry: GitChangeEntry;
  section: ScmChangeListSection;
}

export interface ScmTabMenuPayload {
  kind: "scm-tab";
  hasRepoOpen: boolean;
}

export type ContextMenuPayload =
  | TitlebarMenuPayload
  | ContentMenuPayload
  | TabMenuPayload
  | FileTreeMenuPayload
  | ScmChangeMenuPayload
  | ScmTabMenuPayload;

export interface ContextMenuOpenRequest {
  screenX: number;
  screenY: number;
  payload: ContextMenuPayload;
}

export interface ContextMenuActionEvent {
  kind: ContextMenuKind;
  action: string;
  /** Echo of the open payload for handlers that need entry/tab ids. */
  payload: ContextMenuPayload;
}

const WINDOW_PAD_PX = 12;

/** True when the dedicated popup window can be used. */
export function canUseContextMenuPopup(): boolean {
  if (isE2eMode()) {
    return false;
  }
  try {
    getCurrentWindow();
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert client (CSS) coords inside the main webview to physical screen
 * pixels using the main window's inner (client-area) position and DPI scale.
 */
export async function clientToScreen(
  clientX: number,
  clientY: number,
): Promise<{ x: number; y: number } | null> {
  try {
    const win = getCurrentWindow();
    const [inner, scale] = await Promise.all([
      win.innerPosition(),
      win.scaleFactor(),
    ]);
    return {
      x: Math.round(inner.x + clientX * scale),
      y: Math.round(inner.y + clientY * scale),
    };
  } catch (error) {
    console.warn("clientToScreen failed", error);
    return null;
  }
}

async function getContextMenuWindow(): Promise<WebviewWindow | null> {
  try {
    const win = await WebviewWindow.getByLabel(CONTEXT_MENU_WINDOW_LABEL);
    return win ?? null;
  } catch {
    return null;
  }
}

/**
 * Ask the popup to render `payload` at the cursor. Returns false when the
 * caller should fall back to an in-webview overlay (e2e / no Tauri).
 */
export async function openContextMenuPopup(
  clientX: number,
  clientY: number,
  payload: ContextMenuPayload,
): Promise<boolean> {
  if (!canUseContextMenuPopup()) {
    return false;
  }

  const screen = await clientToScreen(clientX, clientY);
  if (!screen) {
    return false;
  }

  const popup = await getContextMenuWindow();
  if (!popup) {
    return false;
  }

  const request: ContextMenuOpenRequest = {
    screenX: screen.x,
    screenY: screen.y,
    payload,
  };

  try {
    await emitTo(CONTEXT_MENU_WINDOW_LABEL, CONTEXT_MENU_OPEN_EVENT, request);
  } catch (error) {
    console.warn("Failed to open context-menu popup", error);
    return false;
  }

  return true;
}

/** Hide the popup window (blur handler also hides it). */
export async function hideContextMenuPopup(): Promise<void> {
  const popup = await getContextMenuWindow();
  if (!popup) {
    try {
      const current = getCurrentWindow();
      if (current.label === CONTEXT_MENU_WINDOW_LABEL) {
        await current.hide();
      }
    } catch {
      // Outside Tauri.
    }
    return;
  }
  try {
    await popup.hide();
  } catch (error) {
    console.warn("Failed to hide context-menu popup", error);
  }
}

/** Emit an action from the popup back to main (and any other listeners). */
export async function emitContextMenuAction(
  event: ContextMenuActionEvent,
): Promise<void> {
  try {
    await emit(CONTEXT_MENU_ACTION_EVENT, event);
  } catch (error) {
    console.warn("Failed to emit context-menu action", error);
  }
  await hideContextMenuPopup();
}

export async function listenContextMenuOpen(
  handler: (request: ContextMenuOpenRequest) => void,
): Promise<UnlistenFn> {
  return listen<ContextMenuOpenRequest>(CONTEXT_MENU_OPEN_EVENT, (event) => {
    handler(event.payload);
  });
}

export async function listenContextMenuAction(
  handler: (event: ContextMenuActionEvent) => void,
): Promise<UnlistenFn> {
  return listen<ContextMenuActionEvent>(CONTEXT_MENU_ACTION_EVENT, (event) => {
    handler(event.payload);
  });
}

/**
 * Resize + edge-clamp + show the current (popup) window around a measured
 * menu element. Coordinates are physical screen pixels.
 */
export async function positionAndShowContextMenu(
  menuEl: HTMLElement,
  screenX: number,
  screenY: number,
): Promise<void> {
  const win = getCurrentWindow();
  const rect = menuEl.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width) + WINDOW_PAD_PX);
  const height = Math.max(1, Math.ceil(rect.height) + WINDOW_PAD_PX);

  await win.setSize(new LogicalSize(width, height));

  const scale = await win.scaleFactor();
  let physX = screenX;
  let physY = screenY;

  try {
    const monitor = await monitorFromPoint(screenX, screenY);
    if (monitor) {
      const maxX = monitor.position.x + monitor.size.width - width * scale;
      const maxY = monitor.position.y + monitor.size.height - height * scale;
      physX = Math.min(Math.max(physX, monitor.position.x), Math.max(monitor.position.x, maxX));
      physY = Math.min(Math.max(physY, monitor.position.y), Math.max(monitor.position.y, maxY));
    }
  } catch {
    // Clamp is best-effort; still show at the cursor.
  }

  await win.setPosition(new PhysicalPosition(Math.round(physX), Math.round(physY)));
  await win.show();
  await win.setFocus();
}
