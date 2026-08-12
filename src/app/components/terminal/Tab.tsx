import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
} from "react";

import { PinIcon } from "../icons/MenuIcons";
import type { TabStatus } from "../../lib/terminal/session-manager";

export interface TabProps {
  tabId: string;
  title: string;
  active: boolean;
  pinned: boolean;
  status: TabStatus;
  renaming?: boolean;
  onSelect: (tabId: string) => void;
  onContextMenu: (tabId: string, x: number, y: number) => void;
  onRenameCommit: (tabId: string, title: string) => void;
  onRenameCancel: () => void;
}

export default function Tab({
  tabId,
  title,
  active,
  pinned,
  status,
  renaming = false,
  onSelect,
  onContextMenu,
  onRenameCommit,
  onRenameCancel,
}: TabProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(title);
  const skipBlurCommit = useRef(false);

  useEffect(() => {
    if (!renaming) return;
    setDraft(title);
    skipBlurCommit.current = false;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [renaming, title]);

  const statusClass =
    status === "error"
      ? "tab-bar__tab--error"
      : status === "exited"
        ? "tab-bar__tab--exited"
        : "";

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onContextMenu(tabId, event.clientX, event.clientY);
  };

  const commitRename = () => {
    const next = draft.trim();
    onRenameCommit(tabId, next.length > 0 ? next : title);
  };

  const handleRenameKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      commitRename();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      skipBlurCommit.current = true;
      onRenameCancel();
    }
  };

  const handleRenameBlur = () => {
    if (skipBlurCommit.current) {
      skipBlurCommit.current = false;
      return;
    }
    commitRename();
  };

  return (
    <div
      role="tab"
      tabIndex={renaming ? -1 : 0}
      className={[
        "tab-bar__tab",
        "terminal-tab-enter",
        active ? "tab-bar__tab--active" : "",
        pinned ? "tab-bar__tab--pinned" : "",
        renaming ? "tab-bar__tab--renaming" : "",
        statusClass,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-selected={active}
      data-testid="terminal-tab"
      data-pinned={pinned ? "true" : "false"}
      data-tab-id={tabId}
      onClick={() => {
        if (!renaming) onSelect(tabId);
      }}
      onContextMenu={handleContextMenu}
      onKeyDown={(event) => {
        if (renaming) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(tabId);
        }
      }}
    >
      {pinned && (
        <span className="tab-bar__pin-badge" aria-hidden title="Pinned">
          <PinIcon className="tab-bar__pin-badge-icon" />
        </span>
      )}
      {renaming ? (
        <input
          ref={inputRef}
          className="tab-bar__rename-input"
          value={draft}
          aria-label="Rename tab"
          data-testid="tab-rename-input"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleRenameKeyDown}
          onBlur={handleRenameBlur}
          onClick={(event) => event.stopPropagation()}
        />
      ) : (
        <span className="tab-bar__title" title={title}>
          {title}
        </span>
      )}
    </div>
  );
}
