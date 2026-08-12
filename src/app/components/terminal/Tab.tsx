import type { MouseEvent } from "react";

import { PinIcon } from "../icons/MenuIcons";
import type { TabStatus } from "../../lib/terminal/session-manager";

export interface TabProps {
  tabId: string;
  title: string;
  active: boolean;
  pinned: boolean;
  status: TabStatus;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onTogglePin: (tabId: string) => void;
}

export default function Tab({
  tabId,
  title,
  active,
  pinned,
  status,
  onSelect,
  onClose,
  onTogglePin,
}: TabProps) {
  const statusClass =
    status === "error"
      ? "tab-bar__tab--error"
      : status === "exited"
        ? "tab-bar__tab--exited"
        : "";

  const handleClose = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onClose(tabId);
  };

  const handlePin = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onTogglePin(tabId);
  };

  return (
    <div
      role="tab"
      tabIndex={0}
      className={[
        "tab-bar__tab",
        "terminal-tab-enter",
        active ? "tab-bar__tab--active" : "",
        pinned ? "tab-bar__tab--pinned" : "",
        statusClass,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-selected={active}
      data-testid="terminal-tab"
      data-pinned={pinned ? "true" : "false"}
      data-tab-id={tabId}
      onClick={() => onSelect(tabId)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(tabId);
        }
      }}
    >
      <span className="tab-bar__title" title={title}>
        {title}
      </span>
      <button
        type="button"
        className="tab-bar__action tab-bar__action--pin"
        aria-label={pinned ? "Unpin tab" : "Pin tab"}
        aria-pressed={pinned}
        title={pinned ? "Unpin" : "Pin"}
        onClick={handlePin}
      >
        <PinIcon className="tab-bar__action-icon" aria-hidden />
      </button>
      <button
        type="button"
        className="tab-bar__action tab-bar__action--close"
        aria-label={`Close ${title}`}
        title="Close"
        onClick={handleClose}
      >
        <span className="tab-bar__close-glyph" aria-hidden>
          ×
        </span>
      </button>
    </div>
  );
}
