/**
 * Quit hand-off between Rust and the main webview.
 *
 * Tray "Quit" and the global `app.quit` shortcut call `request_quit`, which
 * emits {@link QUIT_REQUESTED_EVENT} instead of exiting straight away. The
 * main window flushes pinned tabs, then calls `quit_app`. Rust keeps a
 * watchdog timer, so a missing or hung listener still exits.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export const QUIT_REQUESTED_EVENT = "app-quit-requested";

/** Ask the backend to start the flush-then-exit hand-off. */
export async function requestQuit(): Promise<void> {
  await invoke("request_quit");
}

/** Main window only: flush persisted state, then exit. */
export async function listenForQuitRequest(
  flush: () => Promise<void>,
): Promise<UnlistenFn> {
  return listen(QUIT_REQUESTED_EVENT, () => {
    void (async () => {
      try {
        await flush();
      } catch (error) {
        console.warn("Failed to flush state before quit", error);
      }
      try {
        await invoke("quit_app");
      } catch (error) {
        console.warn("quit_app failed", error);
      }
    })();
  });
}
