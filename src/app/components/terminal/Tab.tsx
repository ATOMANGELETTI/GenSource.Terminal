import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
} from "react";

import type { WorkspaceTabKind } from "../../lib/context-menu-popup";
import { fileEntryFromPath } from "../../lib/terminal/git-diff";
import { changeStatusLabel } from "../../lib/terminal/git-scm";
import type { TabStatus } from "../../lib/terminal/session-manager";
import type { GitChangeStatus } from "../../types/git-scm";
import { useFileIconSet } from "../../hooks/useFileIconSet";
import { renderFileTypeIcon } from "../icons/fileIconSets/renderFileTypeIcon";
import { PinIcon } from "../icons/MenuIcons";

function DiffTabChrome({
  filePath,
  changeStatus,
}: {
  filePath: string;
  changeStatus?: GitChangeStatus;
}) {
  const iconSet = useFileIconSet();
  const fileEntry = fileEntryFromPath(filePath);
  return (
    <>
      <span className="tab-bar__file-icon" aria-hidden>
        {renderFileTypeIcon(fileEntry, { iconSet })}
      </span>
      {changeStatus ? (
        <span
          className={`tab-bar__diff-badge scm-change__badge scm-change__badge--${changeStatus}`}
          aria-hidden
        >
          {changeStatusLabel(changeStatus)}
        </span>
      ) : null}
    </>
  );
}

export interface TabProps {
  tabId: string;
  title: string;
  active: boolean;
  pinned: boolean;
  status: TabStatus;
  renaming?: boolean;
  kind?: WorkspaceTabKind;
  filePath?: string;
  changeStatus?: GitChangeStatus;
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
  kind = "terminal",
  filePath,
  changeStatus,
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
      data-testid={kind === "diff" ? "diff-tab" : "terminal-tab"}
      data-tab-kind={kind}
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
      {kind === "diff" && filePath ? (
        <DiffTabChrome filePath={filePath} changeStatus={changeStatus} />
      ) : null}
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
