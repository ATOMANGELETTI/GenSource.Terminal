import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

import Titlebar from "./components/layout/Titlebar";
import AboutDialog from "./components/dialogs/AboutDialog";
import ContentAreaMenu from "./pages/content-menus/content-area-menu";
import TitlebarMenu from "./pages/content-menus/titlebar-menu";
import TerminalWorkspace, {
  type TerminalWorkspaceHandle,
} from "./components/terminal/TerminalWorkspace";
import type { OpenInTerminalApi } from "./components/terminal/explorer/FilesExplorer";
import { copySelection, pasteAtFocus } from "./lib/clipboard";
import {
  listenContextMenuAction,
  openContextMenuPopup,
} from "./lib/context-menu-popup";
import { useLocalShortcuts } from "./lib/keybindings";
import {
  closeWindow,
  isWindowMaximized,
  minimizeWindow,
  moveWindow,
  toggleMaximize,
} from "./lib/window";
import { zoomIn, zoomOut, zoomReset } from "./lib/zoom";
import { isE2eMode, E2E_APP_INFO, E2E_DEFAULT_SETTINGS } from "./lib/e2e-window";
import {
  applySettingsToDom,
  fetchAppInfo,
  initSettingsFromBackend,
  subscribeSettingsChanges,
} from "./lib/settings";
import { invoke } from "@tauri-apps/api/core";
import type { AppInfo, ContextMenuState, ContextMenuTarget } from "./types";

const CLOSED_MENU: ContextMenuState = { target: null, x: 0, y: 0 };

export default function App() {
  const [menu, setMenu] = useState<ContextMenuState>(CLOSED_MENU);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const terminalRef = useRef<TerminalWorkspaceHandle>(null);

  const openInTerminalApi = useMemo<OpenInTerminalApi>(
    () => ({
      hasReadyTab: () => terminalRef.current?.hasReadyTab() ?? false,
      cdActive: (path: string) => terminalRef.current?.cdActive(path) ?? false,
      newTab: (cwd?: string) => {
        terminalRef.current?.newTab(cwd);
      },
    }),
    [],
  );

  const title = appInfo?.productName ?? appInfo?.name ?? "GenSource Terminal";

  const closeMenu = useCallback(() => {
    setMenu(CLOSED_MENU);
  }, []);

  const openMenu = useCallback(
    (target: ContextMenuTarget, event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      const { clientX, clientY } = event;

      void (async () => {
        if (target === "titlebar") {
          let maximized = false;
          try {
            maximized = await isWindowMaximized();
          } catch {
            maximized = false;
          }
          const opened = await openContextMenuPopup(clientX, clientY, {
            kind: "titlebar",
            maximized,
          });
          if (!opened) {
            setMenu({ target, x: clientX, y: clientY });
          }
          return;
        }

        const opened = await openContextMenuPopup(clientX, clientY, {
          kind: "content",
          productName: title,
          hasTerminal: true,
        });
        if (!opened) {
          setMenu({ target, x: clientX, y: clientY });
        }
      })();
    },
    [title],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
        setAboutOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeMenu]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void (async () => {
      if (isE2eMode()) {
        applySettingsToDom(E2E_DEFAULT_SETTINGS);
        setAppInfo(E2E_APP_INFO);
        return;
      }

      try {
        // Subscribe before fetch so a setup-time `settings-changed` emit is
        // not missed if this window boots before `.setup` finishes.
        const stop = await subscribeSettingsChanges();
        if (cancelled) {
          stop();
        } else {
          unlisten = stop;
        }
        await initSettingsFromBackend();
      } catch (error) {
        console.warn("Failed to initialize settings from backend", error);
      }

      try {
        const info = await fetchAppInfo();
        if (!cancelled) {
          setAppInfo(info);
        }
      } catch (error) {
        console.warn("Failed to load app info", error);
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const handleTerminalCopy = useCallback(() => {
    const terminal = terminalRef.current;
    if (terminal?.hasSelection()) {
      void terminal.copySelection();
      return;
    }
    if (terminal?.isFocused()) {
      terminal.sendKeys("\u0003");
      return;
    }
    void copySelection();
  }, []);

  const handleTerminalPaste = useCallback(() => {
    const terminal = terminalRef.current;
    if (terminal?.isFocused()) {
      void terminal.pasteClipboard();
      return;
    }
    void pasteAtFocus();
  }, []);

  // Popup menu actions that need main-window state/APIs.
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void listenContextMenuAction((event) => {
      if (event.kind === "titlebar") {
        switch (event.action) {
          case "restore":
          case "toggleMaximize":
            void toggleMaximize();
            break;
          case "move":
            void moveWindow();
            break;
          case "minimize":
            void minimizeWindow();
            break;
          case "close":
            void closeWindow();
            break;
          default:
            break;
        }
        return;
      }

      if (event.kind === "content") {
        switch (event.action) {
          case "reload":
            window.location.reload();
            break;
          case "zoomIn":
            void zoomIn();
            break;
          case "zoomOut":
            void zoomOut();
            break;
          case "zoomReset":
            void zoomReset();
            break;
          case "preferences":
            void invoke("open_configs_folder");
            break;
          case "about":
            setAboutOpen(true);
            break;
          case "copy":
            handleTerminalCopy();
            break;
          case "paste":
            handleTerminalPaste();
            break;
          case "newTab":
            terminalRef.current?.newTab();
            break;
          case "closeTab":
            terminalRef.current?.closeActiveTab();
            break;
          case "togglePin":
            terminalRef.current?.togglePinActive();
            break;
          case "search":
            terminalRef.current?.openFind();
            break;
          case "clear":
            terminalRef.current?.clearActive();
            break;
          default:
            break;
        }
      }
    }).then((stop) => {
      if (cancelled) {
        stop();
      } else {
        unlisten = stop;
      }
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [handleTerminalCopy, handleTerminalPaste]);

  // Every `local`-scope id in other/configs/keybindings.json is mapped here
  // so pressing the shortcut does exactly what clicking the matching menu
  // row does. Global-scope ids (window.show/hide, app.quit) are handled
  // entirely in Rust and never reach the frontend.
  useLocalShortcuts({
    "content.reload": () => window.location.reload(),
    "content.zoomIn": () => void zoomIn(),
    "content.zoomOut": () => void zoomOut(),
    "content.zoomReset": () => void zoomReset(),
    "content.copy": handleTerminalCopy,
    "content.paste": handleTerminalPaste,
    "content.preferences": () => void invoke("open_configs_folder"),
    "titlebar.toggleWindow": () => void minimizeWindow(),
    "titlebar.toggleMaximize": () => void toggleMaximize(),
    "titlebar.close": () => void closeWindow(),
    "terminal.newTab": () => terminalRef.current?.newTab(),
    "terminal.closeTab": () => terminalRef.current?.closeActiveTab(),
    "terminal.togglePin": () => terminalRef.current?.togglePinActive(),
    "terminal.search": () => terminalRef.current?.openFind(),
    "terminal.clear": () => terminalRef.current?.clearActive(),
  });

  return (
    <div className="app-shell" onClick={closeMenu}>
      <Titlebar
        title={title}
        onContextMenu={(event) => openMenu("titlebar", event)}
      />
      <main
        className="app-shell__main app-shell__main--terminal"
        onContextMenu={(event) => openMenu("content", event)}
      >
        <TerminalWorkspace ref={terminalRef} openInTerminal={openInTerminalApi} />
      </main>

      {menu.target === "titlebar" && (
        <TitlebarMenu x={menu.x} y={menu.y} onClose={closeMenu} />
      )}
      {menu.target === "content" && (
        <ContentAreaMenu
          x={menu.x}
          y={menu.y}
          productName={title}
          onClose={closeMenu}
          onAbout={() => setAboutOpen(true)}
          terminal={{
            onNewTab: () => terminalRef.current?.newTab(),
            onCloseTab: () => terminalRef.current?.closeActiveTab(),
            onTogglePin: () => terminalRef.current?.togglePinActive(),
            onSearch: () => terminalRef.current?.openFind(),
            onClear: () => terminalRef.current?.clearActive(),
            onCopy: handleTerminalCopy,
            onPaste: handleTerminalPaste,
          }}
        />
      )}

      {aboutOpen && appInfo && (
        <AboutDialog info={appInfo} onClose={() => setAboutOpen(false)} />
      )}
    </div>
  );
}
