import { useEffect, useLayoutEffect, useRef, useState } from "react";

import ChangeRowContextMenu from "../../components/terminal/source-control/ChangeRowContextMenu";
import SourceControlTabContextMenu from "../../components/terminal/source-control/SourceControlTabContextMenu";
import FileTreeContextMenu from "../../components/terminal/explorer/FileTreeContextMenu";
import ContentAreaMenu from "../content-menus/content-area-menu";
import TabContextMenu from "../content-menus/tab-context-menu";
import TitlebarMenu from "../content-menus/titlebar-menu";
import {
  applySettingsToDom,
  initSettingsFromBackend,
  subscribeSettingsChanges,
} from "../../lib/settings";
import {
  E2E_DEFAULT_SETTINGS,
  isE2eMode,
} from "../../lib/e2e-window";
import {
  emitContextMenuAction,
  hideContextMenuPopup,
  listenContextMenuOpen,
  positionAndShowContextMenu,
  type ContextMenuOpenRequest,
  type ContextMenuPayload,
} from "../../lib/context-menu-popup";

/**
 * Dedicated `context-menu` Tauri window host. Receives open requests from
 * main, paints the same flat Nord menus, then emits actions back to main.
 */
export default function ContextMenuWindow() {
  const [request, setRequest] = useState<ContextMenuOpenRequest | null>(null);
  const menuHostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unlistenSettings: (() => void) | undefined;
    let unlistenOpen: (() => void) | undefined;

    void (async () => {
      if (isE2eMode()) {
        applySettingsToDom(E2E_DEFAULT_SETTINGS);
      } else {
        try {
          const stop = await subscribeSettingsChanges();
          if (cancelled) {
            stop();
          } else {
            unlistenSettings = stop;
          }
          await initSettingsFromBackend();
        } catch (error) {
          console.warn("Failed to initialize context-menu settings", error);
        }
      }

      try {
        const stopOpen = await listenContextMenuOpen((next) => {
          setRequest(next);
        });
        if (cancelled) {
          stopOpen();
        } else {
          unlistenOpen = stopOpen;
        }
      } catch (error) {
        console.warn("Failed to listen for context-menu open", error);
      }
    })();

    return () => {
      cancelled = true;
      unlistenSettings?.();
      unlistenOpen?.();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        void hideContextMenuPopup();
        setRequest(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useLayoutEffect(() => {
    if (!request) return;
    const host = menuHostRef.current;
    const menuEl = host?.querySelector<HTMLElement>(".context-menu");
    if (!menuEl) return;

    let cancelled = false;
    void (async () => {
      try {
        await positionAndShowContextMenu(
          menuEl,
          request.screenX,
          request.screenY,
        );
        if (cancelled) {
          await hideContextMenuPopup();
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to position context-menu popup", error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [request]);

  const dismiss = () => {
    setRequest(null);
    void hideContextMenuPopup();
  };

  const runAction = (action: string, payload: ContextMenuPayload) => () => {
    void emitContextMenuAction({
      kind: payload.kind,
      action,
      payload,
    });
    setRequest(null);
  };

  const payload = request?.payload ?? null;

  return (
    <div className="context-menu-window" ref={menuHostRef}>
      {payload?.kind === "titlebar" ? (
        <TitlebarMenu
          x={0}
          y={0}
          maximized={payload.maximized}
          onClose={dismiss}
          onRestore={runAction("restore", payload)}
          onMove={runAction("move", payload)}
          onMinimize={runAction("minimize", payload)}
          onToggleMaximize={runAction("toggleMaximize", payload)}
          onCloseWindow={runAction("close", payload)}
        />
      ) : null}

      {payload?.kind === "content" ? (
        <ContentAreaMenu
          x={0}
          y={0}
          productName={payload.productName}
          onClose={dismiss}
          onReload={runAction("reload", payload)}
          onZoomIn={runAction("zoomIn", payload)}
          onZoomOut={runAction("zoomOut", payload)}
          onZoomReset={runAction("zoomReset", payload)}
          onPreferences={runAction("preferences", payload)}
          onAbout={runAction("about", payload)}
          onCopy={runAction("copy", payload)}
          onPaste={runAction("paste", payload)}
          terminal={
            payload.hasTerminal
              ? {
                  onNewTab: runAction("newTab", payload),
                  onCloseTab: runAction("closeTab", payload),
                  onTogglePin: runAction("togglePin", payload),
                  onSearch: runAction("search", payload),
                  onClear: runAction("clear", payload),
                }
              : undefined
          }
        />
      ) : null}

      {payload?.kind === "tab" ? (
        <TabContextMenu
          x={0}
          y={0}
          pinned={payload.pinned}
          canCloseAll={payload.canCloseAll}
          tabKind={payload.tabKind ?? "terminal"}
          onClose={dismiss}
          onRename={runAction("rename", payload)}
          onTogglePin={runAction("togglePin", payload)}
          onCloseTab={runAction("closeTab", payload)}
          onCloseAllTabs={runAction("closeAllTabs", payload)}
        />
      ) : null}

      {payload?.kind === "file-tree" ? (
        <FileTreeContextMenu
          x={0}
          y={0}
          entry={payload.entry}
          onClose={dismiss}
          onOpen={runAction("open", payload)}
          onOpenInTerminal={runAction("openInTerminal", payload)}
          onOpenInSourceControl={runAction("openInSourceControl", payload)}
          onReveal={runAction("reveal", payload)}
          onCopyPath={runAction("copyPath", payload)}
          onNewFile={runAction("newFile", payload)}
          onNewFolder={runAction("newFolder", payload)}
          onRename={runAction("rename", payload)}
          onDelete={runAction("delete", payload)}
          onAbout={runAction("about", payload)}
        />
      ) : null}

      {payload?.kind === "scm-change" ? (
        <ChangeRowContextMenu
          x={0}
          y={0}
          entry={payload.entry}
          section={payload.section}
          onClose={dismiss}
          onStage={runAction("stage", payload)}
          onUnstage={runAction("unstage", payload)}
          onDiscard={runAction("discard", payload)}
          onOpenDiff={runAction("openDiff", payload)}
          onOpen={runAction("open", payload)}
          onCopyPath={runAction("copyPath", payload)}
          onReveal={runAction("reveal", payload)}
        />
      ) : null}

      {payload?.kind === "scm-tab" ? (
        <SourceControlTabContextMenu
          x={0}
          y={0}
          hasRepoOpen={payload.hasRepoOpen}
          onClose={dismiss}
          onOpenRepo={runAction("openRepo", payload)}
          onCloseRepo={runAction("closeRepo", payload)}
        />
      ) : null}
    </div>
  );
}
