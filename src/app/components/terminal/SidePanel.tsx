import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  BotIcon,
  FolderIcon,
  PreferencesIcon,
  SourceControlIcon,
} from "../icons/MenuIcons";
import {
  loadScmFolderPath,
  pickScmFolder,
  saveScmFolderPath,
} from "../../lib/terminal/git-scm";
import {
  hideContextMenuPopup,
  listenContextMenuAction,
  openContextMenuPopup,
} from "../../lib/context-menu-popup";
import type { AgentTerminalContext, ContextMenuPosition } from "../../types";
import AgentShell from "./agent/AgentShell";
import ConfigPanel from "./config/ConfigPanel";
import FilesExplorer, { type OpenInTerminalApi } from "./explorer/FilesExplorer";
import SourceControlPanel from "./source-control/SourceControlPanel";
import SourceControlTabContextMenu from "./source-control/SourceControlTabContextMenu";

const MIN_WIDTH = 120;
const MAX_WIDTH = 480;
const SIDE_PANEL_TAB_STORAGE_KEY = "gensource.sidePanel.tab";

const SIDE_PANEL_TABS = [
  { id: "files", label: "Files", iconOnly: true },
  { id: "source", label: "Source Control", iconOnly: true },
  { id: "agent", label: "Agents", iconOnly: true },
  { id: "config", label: "Config", iconOnly: true },
] as const;

type SidePanelTabId = (typeof SIDE_PANEL_TABS)[number]["id"];

function isSidePanelTabId(value: string): value is SidePanelTabId {
  return SIDE_PANEL_TABS.some((tab) => tab.id === value);
}

function readStoredSidePanelTab(): SidePanelTabId {
  try {
    const stored = sessionStorage.getItem(SIDE_PANEL_TAB_STORAGE_KEY);
    if (stored && isSidePanelTabId(stored)) return stored;
  } catch {
    // sessionStorage unavailable
  }
  return "files";
}

interface SidePanelProps {
  open: boolean;
  width: number;
  onResize: (width: number) => void;
  openInTerminal?: OpenInTerminalApi;
  agentTerminal?: AgentTerminalContext | null;
}

export default function SidePanel({
  open,
  width,
  onResize,
  openInTerminal,
  agentTerminal,
}: SidePanelProps) {
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [activeTab, setActiveTab] = useState<SidePanelTabId>(readStoredSidePanelTab);
  const [scmFolderPath, setScmFolderPath] = useState<string | null>(null);
  const [sourceTabMenu, setSourceTabMenu] =
    useState<ContextMenuPosition | null>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(SIDE_PANEL_TAB_STORAGE_KEY, activeTab);
    } catch {
      // sessionStorage unavailable
    }
    // Drop any open explorer/SCM popup when leaving that tab so actions
    // are not emitted after the panel unmounts its listeners.
    void hideContextMenuPopup();
    setSourceTabMenu(null);
  }, [activeTab]);

  useEffect(() => {
    let cancelled = false;
    void loadScmFolderPath().then((path) => {
      if (cancelled) return;
      if (path) setScmFolderPath(path);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const closeSourceTabMenu = useCallback(() => {
    setSourceTabMenu(null);
  }, []);

  useEffect(() => {
    if (!sourceTabMenu) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSourceTabMenu();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        closeSourceTabMenu();
        return;
      }
      if (target.closest(".source-control-tab-context-menu")) return;
      closeSourceTabMenu();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [sourceTabMenu, closeSourceTabMenu]);

  const handleScmFolderPathChange = useCallback((path: string | null) => {
    setScmFolderPath(path);
    void saveScmFolderPath(path);
  }, []);

  const handleOpenInSourceControl = useCallback((path: string) => {
    setScmFolderPath(path);
    void saveScmFolderPath(path);
    setActiveTab("source");
  }, []);

  const handleOpenRepo = useCallback(() => {
    void (async () => {
      try {
        const selected = await pickScmFolder();
        if (!selected) return;
        handleScmFolderPathChange(selected);
        setActiveTab("source");
      } catch {
        // Picker cancel/failure — leave SCM state unchanged.
      }
    })();
  }, [handleScmFolderPathChange]);

  const handleCloseRepo = useCallback(() => {
    handleScmFolderPathChange(null);
  }, [handleScmFolderPathChange]);

  const handleSourceTabContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const { clientX, clientY } = event;
      const hasRepoOpen = scmFolderPath != null;
      void (async () => {
        const opened = await openContextMenuPopup(clientX, clientY, {
          kind: "scm-tab",
          hasRepoOpen,
        });
        if (!opened) {
          setSourceTabMenu({ x: clientX, y: clientY });
        }
      })();
    },
    [scmFolderPath],
  );

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void listenContextMenuAction((event) => {
      if (event.kind !== "scm-tab") return;
      switch (event.action) {
        case "openRepo":
          handleOpenRepo();
          break;
        case "closeRepo":
          handleCloseRepo();
          break;
        default:
          break;
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
  }, [handleCloseRepo, handleOpenRepo]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();

      const handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);
      dragRef.current = { startX: event.clientX, startWidth: width };

      const prevUserSelect = document.body.style.userSelect;
      const prevCursor = document.body.style.cursor;
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";

      const onMove = (ev: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        const next = Math.min(
          MAX_WIDTH,
          Math.max(MIN_WIDTH, drag.startWidth + (ev.clientX - drag.startX)),
        );
        onResize(next);
      };

      const onUp = (ev: PointerEvent) => {
        dragRef.current = null;
        if (handle.hasPointerCapture(ev.pointerId)) {
          handle.releasePointerCapture(ev.pointerId);
        }
        document.body.style.userSelect = prevUserSelect;
        document.body.style.cursor = prevCursor;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [onResize, width],
  );

  const flushContent =
    activeTab === "files" ||
    activeTab === "source" ||
    activeTab === "agent" ||
    activeTab === "config";

  const openAgentsConfig = useCallback(() => {
    try {
      sessionStorage.setItem("gensource.config.category", "agents");
    } catch {
      // sessionStorage unavailable
    }
    setActiveTab("config");
  }, []);

  return (
    <aside
      className={open ? "side-panel" : "side-panel side-panel--closed"}
      style={{ width: open ? width : 0 }}
      data-testid="side-panel"
      aria-hidden={!open}
    >
      <div className="side-panel__body">
        <div
          className={
            flushContent
              ? "side-panel__content side-panel__content--flush"
              : "side-panel__content"
          }
          role="tabpanel"
        >
          {activeTab === "files" ? (
            <FilesExplorer
              openInTerminal={openInTerminal}
              onOpenInSourceControl={handleOpenInSourceControl}
            />
          ) : activeTab === "source" ? (
            <SourceControlPanel
              folderPath={scmFolderPath}
              onFolderPathChange={handleScmFolderPathChange}
            />
          ) : activeTab === "agent" ? (
            <AgentShell
              terminal={agentTerminal}
              onOpenAgentsConfig={openAgentsConfig}
            />
          ) : activeTab === "config" ? (
            <ConfigPanel />
          ) : null}
        </div>
        <div className="side-panel__tabs" role="tablist" aria-label="Side panel">
          {SIDE_PANEL_TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={tab.iconOnly ? tab.label : undefined}
                title={tab.iconOnly ? tab.label : undefined}
                className={
                  isActive
                    ? "side-panel__tab side-panel__tab--active"
                    : "side-panel__tab"
                }
                onClick={() => setActiveTab(tab.id)}
                onContextMenu={
                  tab.id === "source" ? handleSourceTabContextMenu : undefined
                }
              >
                {tab.id === "files" ? (
                  <FolderIcon className="side-panel__tab-icon" />
                ) : tab.id === "source" ? (
                  <SourceControlIcon className="side-panel__tab-icon" />
                ) : tab.id === "agent" ? (
                  <BotIcon className="side-panel__tab-icon" />
                ) : (
                  <PreferencesIcon className="side-panel__tab-icon" />
                )}
              </button>
            );
          })}
        </div>
      </div>
      {open ? (
        <div
          className="side-panel__resizer"
          data-testid="side-panel-resizer"
          onPointerDown={handlePointerDown}
        />
      ) : null}
      {sourceTabMenu ? (
        <SourceControlTabContextMenu
          x={sourceTabMenu.x}
          y={sourceTabMenu.y}
          hasRepoOpen={scmFolderPath != null}
          onClose={closeSourceTabMenu}
          onOpenRepo={handleOpenRepo}
          onCloseRepo={handleCloseRepo}
        />
      ) : null}
    </aside>
  );
}
