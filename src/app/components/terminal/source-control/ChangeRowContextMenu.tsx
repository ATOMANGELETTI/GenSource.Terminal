import type { GitChangeEntry, GitChangeStatus } from "../../../types/git-scm";
import {
  CopyIcon,
  DeleteIcon,
  OpenExternalIcon,
  RevealIcon,
} from "../../icons/MenuIcons";
import { changeStatusLabel } from "../../../lib/terminal/git-scm";
import type { ContextMenuPosition } from "../../../types";

export type ChangeListSection = "staged" | "changes" | "conflicted";

export interface ChangeRowMenuState extends ContextMenuPosition {
  entry: GitChangeEntry;
  section: ChangeListSection;
}

interface ChangeRowContextMenuProps extends ChangeRowMenuState {
  onClose: () => void;
  onStage: () => void;
  onUnstage: () => void;
  onDiscard: () => void;
  onOpen: () => void;
  onCopyPath: () => void;
  onReveal: () => void;
}

export default function ChangeRowContextMenu({
  x,
  y,
  section,
  onClose,
  onStage,
  onUnstage,
  onDiscard,
  onOpen,
  onCopyPath,
  onReveal,
}: ChangeRowContextMenuProps) {
  const run = (action: () => void) => () => {
    action();
    onClose();
  };

  const canStage = section === "changes" || section === "conflicted";
  const canUnstage = section === "staged";
  const canDiscard = section === "changes" || section === "conflicted";

  return (
    <nav
      className="context-menu scm-change-context-menu"
      style={{ left: x, top: y }}
      role="menu"
      data-testid="scm-change-context-menu"
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {canStage ? (
        <button
          type="button"
          className="context-menu__item"
          role="menuitem"
          onClick={run(onStage)}
        >
          <span className="context-menu__label">Stage</span>
        </button>
      ) : null}
      {canUnstage ? (
        <button
          type="button"
          className="context-menu__item"
          role="menuitem"
          onClick={run(onUnstage)}
        >
          <span className="context-menu__label">Unstage</span>
        </button>
      ) : null}
      {canDiscard ? (
        <button
          type="button"
          className="context-menu__item context-menu__item--destructive"
          role="menuitem"
          onClick={run(onDiscard)}
        >
          <DeleteIcon className="context-menu__icon" />
          <span className="context-menu__label">Discard</span>
        </button>
      ) : null}
      <div className="context-menu__separator" role="separator" />
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        onClick={run(onOpen)}
      >
        <OpenExternalIcon className="context-menu__icon" />
        <span className="context-menu__label">Open File</span>
      </button>
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        onClick={run(onCopyPath)}
      >
        <CopyIcon className="context-menu__icon" />
        <span className="context-menu__label">Copy Path</span>
      </button>
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        onClick={run(onReveal)}
      >
        <RevealIcon className="context-menu__icon" />
        <span className="context-menu__label">Reveal</span>
      </button>
    </nav>
  );
}

export function ChangeStatusBadge({
  status,
}: {
  status: GitChangeStatus;
}) {
  return (
    <span
      className={`scm-change__badge scm-change__badge--${status}`}
      aria-hidden
    >
      {changeStatusLabel(status)}
    </span>
  );
}
