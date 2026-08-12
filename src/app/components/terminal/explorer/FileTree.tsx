import {
  useCallback,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';

import type { ExplorerDraft, FsEntry } from '../../../types';
import FileTreeNode from './FileTreeNode';
import type { VisibleRow } from './useFileTree';

interface FileTreeProps {
  rows: VisibleRow[];
  selectedPath: string | null;
  draft: ExplorerDraft | null;
  rootLoading: boolean;
  rootError: string | null;
  filtering: boolean;
  onSelect: (entry: FsEntry) => void;
  onToggle: (entry: FsEntry) => void;
  onOpenFile: (entry: FsEntry) => void;
  onContextMenu: (entry: FsEntry, x: number, y: number) => void;
  onDraftChange: (name: string) => void;
  onDraftCommit: () => void;
  onDraftCancel: () => void;
  onStartRename: (entry: FsEntry) => void;
  onDelete: (entry: FsEntry) => void;
  onMoveSelection: (delta: number) => void;
  onCollapseOrParent: () => void;
  onExpandOrChild: () => void;
  onEnter: () => void;
}

function pathsEqual(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  return a.replace(/\\+$/, '').toLowerCase() === b.replace(/\\+$/, '').toLowerCase();
}

export default function FileTree({
  rows,
  selectedPath,
  draft,
  rootLoading,
  rootError,
  filtering,
  onSelect,
  onToggle,
  onOpenFile,
  onContextMenu,
  onDraftChange,
  onDraftCommit,
  onDraftCancel,
  onStartRename,
  onDelete,
  onMoveSelection,
  onCollapseOrParent,
  onExpandOrChild,
  onEnter,
}: FileTreeProps) {
  const treeRef = useRef<HTMLDivElement>(null);

  const focusTree = useCallback(() => {
    treeRef.current?.focus({ preventScroll: true });
  }, []);

  const handleActivate = useCallback(
    (entry: FsEntry) => {
      if (entry.kind === 'file') {
        void onOpenFile(entry);
        return;
      }
      onToggle(entry);
    },
    [onOpenFile, onToggle],
  );

  const handleSelect = useCallback(
    (entry: FsEntry) => {
      onSelect(entry);
      focusTree();
    },
    [focusTree, onSelect],
  );

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (draft) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        onMoveSelection(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        onMoveSelection(-1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        onCollapseOrParent();
        break;
      case 'ArrowRight':
        event.preventDefault();
        onExpandOrChild();
        break;
      case 'Enter':
        event.preventDefault();
        onEnter();
        break;
      case 'F2':
        event.preventDefault();
        {
          const row = rows.find((r) => pathsEqual(r.entry.path, selectedPath));
          if (row) onStartRename(row.entry);
        }
        break;
      case 'Delete':
        event.preventDefault();
        {
          const row = rows.find((r) => pathsEqual(r.entry.path, selectedPath));
          if (row) void onDelete(row.entry);
        }
        break;
      default:
        break;
    }
  };

  const handleTreeContextMenu = (event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      ref={treeRef}
      className="file-tree"
      role="tree"
      aria-label="Files"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onContextMenu={handleTreeContextMenu}
      onMouseDown={(event) => {
        if (event.button === 0) focusTree();
      }}
    >
      {rootLoading && rows.length === 0 ? (
        <div className="file-tree__status">Loading drives…</div>
      ) : null}
      {rootError ? (
        <div className="file-tree__status file-tree__status--error">{rootError}</div>
      ) : null}
      {!rootLoading && !rootError && rows.length === 0 ? (
        <div className="file-tree__status">
          {filtering ? 'No matching files' : 'No drives found'}
        </div>
      ) : null}
      {rows.map((row) => (
        <FileTreeNode
          key={row.entry.path}
          row={row}
          selected={pathsEqual(row.entry.path, selectedPath)}
          draft={draft}
          onSelect={handleSelect}
          onActivate={handleActivate}
          onContextMenu={onContextMenu}
          onDraftChange={onDraftChange}
          onDraftCommit={onDraftCommit}
          onDraftCancel={onDraftCancel}
        />
      ))}
    </div>
  );
}
