import { useEffect, useRef, type WheelEvent } from "react";

import Tab, { type TabProps } from "./Tab";

export interface TabBarTab
  extends Omit<
    TabProps,
    | "onSelect"
    | "onContextMenu"
    | "onRenameCommit"
    | "onRenameCancel"
    | "active"
    | "renaming"
  > {
  active: boolean;
  renaming?: boolean;
}

export interface TabBarProps {
  tabs: TabBarTab[];
  onSelect: (tabId: string) => void;
  onAdd: () => void;
  onContextMenu: (tabId: string, x: number, y: number) => void;
  onRenameCommit: (tabId: string, title: string) => void;
  onRenameCancel: () => void;
}

export default function TabBar({
  tabs,
  onSelect,
  onAdd,
  onContextMenu,
  onRenameCommit,
  onRenameCancel,
}: TabBarProps) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const activeTabId = tabs.find((tab) => tab.active)?.tabId;

  useEffect(() => {
    if (!activeTabId || !tabsRef.current) return;
    const activeEl = tabsRef.current.querySelector<HTMLElement>(
      `[data-tab-id="${CSS.escape(activeTabId)}"]`,
    );
    activeEl?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [activeTabId]);

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    const el = tabsRef.current;
    if (!el) return;
    if (el.scrollWidth <= el.clientWidth) return;

    const delta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;
    if (delta === 0) return;

    event.preventDefault();
    el.scrollLeft += delta;
  };

  return (
    <div className="tab-bar" data-testid="tab-bar" role="tablist">
      <div
        ref={tabsRef}
        className="tab-bar__tabs"
        onWheel={handleWheel}
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.tabId}
            tabId={tab.tabId}
            title={tab.title}
            active={tab.active}
            pinned={tab.pinned}
            status={tab.status}
            renaming={tab.renaming}
            kind={tab.kind}
            filePath={tab.filePath}
            changeStatus={tab.changeStatus}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
            onRenameCommit={onRenameCommit}
            onRenameCancel={onRenameCancel}
          />
        ))}
      </div>
      <button
        type="button"
        className="tab-bar__add"
        aria-label="New tab"
        title="New tab"
        onClick={onAdd}
      >
        +
      </button>
    </div>
  );
}
