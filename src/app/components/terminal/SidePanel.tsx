import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { FolderIcon } from "../icons/MenuIcons";
import FilesExplorer from "./explorer/FilesExplorer";

const MIN_WIDTH = 120;
const MAX_WIDTH = 480;

const SIDE_PANEL_TABS = [
  { id: "files", label: "Files", iconOnly: true },
  { id: "tab-2", label: "Tab 2", iconOnly: false },
  { id: "tab-3", label: "Tab 3", iconOnly: false },
  { id: "tab-4", label: "Tab 4", iconOnly: false },
] as const;

type SidePanelTabId = (typeof SIDE_PANEL_TABS)[number]["id"];

interface SidePanelProps {
  open: boolean;
  width: number;
  onResize: (width: number) => void;
}

export default function SidePanel({ open, width, onResize }: SidePanelProps) {
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [activeTab, setActiveTab] = useState<SidePanelTabId>("files");

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

  const activeMeta = SIDE_PANEL_TABS.find((tab) => tab.id === activeTab);

  return (
    <aside
      className={
        open ? "side-panel" : "side-panel side-panel--closed"
      }
      style={{ width: open ? width : 0 }}
      data-testid="side-panel"
      aria-hidden={!open}
    >
      <div className="side-panel__body">
        <div
          className={
            activeTab === "files"
              ? "side-panel__content side-panel__content--flush"
              : "side-panel__content"
          }
          role="tabpanel"
        >
          {activeTab === "files" ? (
            <FilesExplorer />
          ) : (
            <p className="side-panel__placeholder">
              {activeMeta?.label ?? "Tab"} content
            </p>
          )}
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
              >
                {tab.iconOnly ? (
                  <FolderIcon className="side-panel__tab-icon" />
                ) : (
                  <span className="side-panel__tab-label">{tab.label}</span>
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
    </aside>
  );
}
