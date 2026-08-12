import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow, type Window } from "@tauri-apps/api/window";

/**
 * Current Tauri window, or `null` when running outside a WebView (Vite e2e).
 */
export function getWindow(): Window | null {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

async function getMainWindow(): Promise<WebviewWindow | null> {
  try {
    return await WebviewWindow.getByLabel("main");
  } catch {
    return null;
  }
}

/** Whether the `main` window is currently visible (used by the tray flyout). */
export async function isMainWindowVisible(): Promise<boolean> {
  const main = await getMainWindow();
  if (!main) {
    return false;
  }
  try {
    return await main.isVisible();
  } catch {
    return false;
  }
}

export async function showMainWindow(): Promise<void> {
  const main = await getMainWindow();
  if (!main) {
    return;
  }
  await main.show();
  await main.setFocus();
}

export async function hideMainWindow(): Promise<void> {
  const main = await getMainWindow();
  if (!main) {
    return;
  }
  await main.hide();
}

export async function closeWindow(): Promise<void> {
  const win = getWindow();
  if (!win) {
    return;
  }
  // Main window: hide so the tray can restore it. Explicit Quit still exits.
  try {
    if (win.label === "main") {
      await win.hide();
      return;
    }
  } catch {
    // Outside Tauri or label unavailable — fall through to close.
  }
  await win.close();
}

export async function minimizeWindow(): Promise<void> {
  const win = getWindow();
  if (!win) {
    return;
  }
  await win.minimize();
}

export async function toggleMaximize(): Promise<void> {
  const win = getWindow();
  if (!win) {
    return;
  }
  await win.toggleMaximize();
}

export async function isWindowMaximized(): Promise<boolean> {
  const win = getWindow();
  if (!win) {
    return false;
  }
  try {
    return await win.isMaximized();
  } catch {
    return false;
  }
}

/** Starts an OS-native window drag, used by the titlebar menu's "Move" row. */
export async function moveWindow(): Promise<void> {
  const win = getWindow();
  if (!win) {
    return;
  }
  await win.startDragging();
}
