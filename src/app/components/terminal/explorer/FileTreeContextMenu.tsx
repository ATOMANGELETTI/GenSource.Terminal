import {
  AboutIcon,
  CopyIcon,
  DeleteIcon,
  NewFileIcon,
  NewFolderIcon,
  OpenExternalIcon,
  RenameIcon,
  RevealIcon,
} from "../../icons/MenuIcons";
import type { ContextMenuPosition, FsEntry } from "../../../types";

export interface FileTreeContextMenuProps extends ContextMenuPosition {
  entry: FsEntry;
  onClose: () => void;
  onOpen: () => void;
  onReveal: () => void;
  onCopyPath: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
  onAbout: () => void;
}

export default function FileTreeContextMenu({
  x,
  y,
  entry,
  onClose,
  onOpen,
  onReveal,
  onCopyPath,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
  onAbout,
}: FileTreeContextMenuProps) {
  const run = (action: () => void) => () => {
    action();
    onClose();
  };

  const isDrive = entry.kind === "drive";
  const isDir = entry.kind === "dir" || isDrive;
  const isFile = entry.kind === "file";

  return (
    <nav
      className="context-menu file-tree-context-menu"
      style={{ left: x, top: y }}
      role="menu"
      data-testid="file-tree-context-menu"
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {isFile ? (
        <button
          type="button"
          className="context-menu__item"
          role="menuitem"
          onClick={run(onOpen)}
        >
          <OpenExternalIcon className="context-menu__icon" />
          <span className="context-menu__label">Open</span>
        </button>
      ) : null}
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        onClick={run(onReveal)}
      >
        <RevealIcon className="context-menu__icon" />
        <span className="context-menu__label">Reveal in Explorer</span>
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
      {!isDrive ? <div className="context-menu__separator" role="separator" /> : null}
      {isDir && !isDrive ? (
        <>
          <button
            type="button"
            className="context-menu__item"
            role="menuitem"
            onClick={run(onNewFile)}
          >
            <NewFileIcon className="context-menu__icon" />
            <span className="context-menu__label">New File</span>
          </button>
          <button
            type="button"
            className="context-menu__item"
            role="menuitem"
            onClick={run(onNewFolder)}
          >
            <NewFolderIcon className="context-menu__icon" />
            <span className="context-menu__label">New Folder</span>
          </button>
        </>
      ) : null}
      {!isDrive ? (
        <button
          type="button"
          className="context-menu__item"
          role="menuitem"
          onClick={run(onRename)}
        >
          <RenameIcon className="context-menu__icon" />
          <span className="context-menu__label">Rename</span>
        </button>
      ) : null}
      {!isDrive ? (
        <button
          type="button"
          className="context-menu__item context-menu__item--destructive"
          role="menuitem"
          onClick={run(onDelete)}
        >
          <DeleteIcon className="context-menu__icon" />
          <span className="context-menu__label">Delete</span>
        </button>
      ) : null}
      <div className="context-menu__separator" role="separator" />
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        onClick={run(onAbout)}
      >
        <AboutIcon className="context-menu__icon" />
        <span className="context-menu__label">About…</span>
      </button>
    </nav>
  );
}
