import {
  CloseTabIcon,
  PinIcon,
  RenameIcon,
} from "../../components/icons/MenuIcons";
import type { ContextMenuPosition } from "../../types";

export interface TabContextMenuProps extends ContextMenuPosition {
  pinned: boolean;
  canCloseAll: boolean;
  onClose: () => void;
  onRename: () => void;
  onTogglePin: () => void;
  onCloseTab: () => void;
  onCloseAllTabs: () => void;
}

export default function TabContextMenu({
  x,
  y,
  pinned,
  canCloseAll,
  onClose,
  onRename,
  onTogglePin,
  onCloseTab,
  onCloseAllTabs,
}: TabContextMenuProps) {
  const run = (action: () => void) => () => {
    action();
    onClose();
  };

  return (
    <nav
      className="context-menu tab-context-menu"
      style={{ left: x, top: y }}
      role="menu"
      data-testid="tab-context-menu"
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        onClick={run(onRename)}
      >
        <RenameIcon className="context-menu__icon" />
        <span className="context-menu__label">Rename</span>
      </button>
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        onClick={run(onTogglePin)}
      >
        <PinIcon className="context-menu__icon" />
        <span className="context-menu__label">{pinned ? "Unpin" : "Pin"}</span>
      </button>
      <div className="context-menu__separator" role="separator" />
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        onClick={run(onCloseTab)}
      >
        <CloseTabIcon className="context-menu__icon" />
        <span className="context-menu__label">Close Tab</span>
      </button>
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        disabled={!canCloseAll}
        onClick={run(onCloseAllTabs)}
      >
        <CloseTabIcon className="context-menu__icon" />
        <span className="context-menu__label">Close All Tabs</span>
      </button>
    </nav>
  );
}
