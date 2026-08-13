import { CloseTabIcon, FolderIcon } from "../../icons/MenuIcons";
import type { ContextMenuPosition } from "../../../types";

export interface SourceControlTabContextMenuProps extends ContextMenuPosition {
  hasRepoOpen: boolean;
  onClose: () => void;
  onOpenRepo: () => void;
  onCloseRepo: () => void;
}

export default function SourceControlTabContextMenu({
  x,
  y,
  hasRepoOpen,
  onClose,
  onOpenRepo,
  onCloseRepo,
}: SourceControlTabContextMenuProps) {
  const run = (action: () => void) => () => {
    action();
    onClose();
  };

  return (
    <nav
      className="context-menu source-control-tab-context-menu"
      style={{ left: x, top: y }}
      role="menu"
      data-testid="source-control-tab-context-menu"
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {hasRepoOpen ? (
        <button
          type="button"
          className="context-menu__item context-menu__item--destructive"
          role="menuitem"
          onClick={run(onCloseRepo)}
        >
          <CloseTabIcon className="context-menu__icon" />
          <span className="context-menu__label">Close repo</span>
        </button>
      ) : (
        <button
          type="button"
          className="context-menu__item"
          role="menuitem"
          onClick={run(onOpenRepo)}
        >
          <FolderIcon className="context-menu__icon" />
          <span className="context-menu__label">Open repo</span>
        </button>
      )}
    </nav>
  );
}
