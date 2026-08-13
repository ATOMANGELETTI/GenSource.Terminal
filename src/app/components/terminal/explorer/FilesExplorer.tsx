import { useCallback, useEffect, useState } from 'react';

import { useFileIconSet } from '../../../hooks/useFileIconSet';
import { targetDirForEntry } from '../../../lib/terminal/explorer-fs';
import type { ContextMenuPosition, FsEntry } from '../../../types';
import ExplorerHeader from './ExplorerHeader';
import FileAboutModal from './FileAboutModal';
import FileTree from './FileTree';
import FileTreeContextMenu from './FileTreeContextMenu';
import OpenInTerminalModal from './OpenInTerminalModal';
import { useFileTree } from './useFileTree';

export interface OpenInTerminalApi {
  hasReadyTab: () => boolean;
  /** Respawn active tab shell at path (no typed `cd`). */
  cdActive: (path: string) => boolean;
  /** Optional cwd starts the new shell in that directory. */
  newTab: (cwd?: string) => void;
}

interface FilesExplorerProps {
  openInTerminal?: OpenInTerminalApi;
  onOpenInSourceControl?: (path: string) => void;
}

interface MenuState extends ContextMenuPosition {
  entry: FsEntry;
}

function pathsEqual(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  return a.replace(/\\+$/, '').toLowerCase() === b.replace(/\\+$/, '').toLowerCase();
}

export default function FilesExplorer({
  openInTerminal,
  onOpenInSourceControl,
}: FilesExplorerProps) {
  const tree = useFileTree();
  const iconSet = useFileIconSet();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [pendingCdPath, setPendingCdPath] = useState<string | null>(null);

  const closeMenu = useCallback(() => setMenu(null), []);
  const closeOpenInTerminalModal = useCallback(() => setPendingCdPath(null), []);

  useEffect(() => {
    if (!menu) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        closeMenu();
        return;
      }
      if (target.closest('.file-tree-context-menu')) return;
      closeMenu();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [menu, closeMenu]);

  useEffect(() => {
    if (!pendingCdPath) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeOpenInTerminalModal();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pendingCdPath, closeOpenInTerminalModal]);

  const handleOpenInTerminal = useCallback(
    (entry: FsEntry) => {
      if (!openInTerminal) return;
      const path = targetDirForEntry(entry);
      if (openInTerminal.cdActive(path)) return;
      setPendingCdPath(path);
    },
    [openInTerminal],
  );

  const handleOpenTerminalTab = useCallback(() => {
    if (!openInTerminal || !pendingCdPath) {
      closeOpenInTerminalModal();
      return;
    }
    const path = pendingCdPath;
    closeOpenInTerminalModal();
    openInTerminal.newTab(path);
  }, [closeOpenInTerminalModal, openInTerminal, pendingCdPath]);

  const moveSelection = useCallback(
    (delta: number) => {
      const rows = tree.visibleRows;
      if (rows.length === 0) return;
      const idx = rows.findIndex((r) => pathsEqual(r.entry.path, tree.selectedPath));
      const next =
        idx < 0
          ? delta > 0
            ? 0
            : rows.length - 1
          : Math.min(rows.length - 1, Math.max(0, idx + delta));
      tree.selectPath(rows[next].entry.path);
    },
    [tree],
  );

  const collapseOrParent = useCallback(() => {
    const entry = tree.selectedEntry;
    if (!entry) return;
    const row = tree.visibleRows.find((r) => pathsEqual(r.entry.path, entry.path));
    if (row && (entry.kind === 'dir' || entry.kind === 'drive') && row.expanded) {
      tree.toggleExpand(entry);
      return;
    }
    const parentPath = entry.path.replace(/[\\/]+$/, '');
    const slash = Math.max(parentPath.lastIndexOf('\\'), parentPath.lastIndexOf('/'));
    if (slash <= 0) return;
    const parent =
      slash === 2 && parentPath[1] === ':' ? parentPath.slice(0, 3) : parentPath.slice(0, slash);
    if (tree.findEntry(parent)) {
      tree.selectPath(parent);
    }
  }, [tree]);

  const expandOrChild = useCallback(() => {
    const entry = tree.selectedEntry;
    if (!entry) return;
    if (entry.kind === 'dir' || entry.kind === 'drive') {
      const row = tree.visibleRows.find((r) => pathsEqual(r.entry.path, entry.path));
      if (row && !row.expanded) {
        tree.toggleExpand(entry);
        return;
      }
      const child = tree.visibleRows.find(
        (r, i, arr) =>
          i > 0 &&
          pathsEqual(arr[i - 1]?.entry.path, entry.path) &&
          r.depth > (arr[i - 1]?.depth ?? 0),
      );
      if (child) tree.selectPath(child.entry.path);
    }
  }, [tree]);

  const handleEnter = useCallback(() => {
    const entry = tree.selectedEntry;
    if (!entry) return;
    if (entry.kind === 'file') {
      void tree.openEntry(entry);
      return;
    }
    tree.toggleExpand(entry);
  }, [tree]);

  return (
    <div
      className="files-explorer"
      data-testid="files-explorer"
      onContextMenu={(event) => {
        // Block native + content-area menus over explorer chrome.
        // Tree rows stopPropagation first when opening the file menu.
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <ExplorerHeader
        username={tree.username}
        searchOpen={tree.searchOpen}
        searchQuery={tree.searchQuery}
        onToggleSearch={() => {
          tree.setSearchOpen(!tree.searchOpen);
          if (tree.searchOpen) tree.setSearchQuery('');
        }}
        onSearchChange={tree.setSearchQuery}
        onNewFile={() => tree.startCreate('create-file')}
        onNewFolder={() => tree.startCreate('create-dir')}
        onRefresh={() => void tree.refresh()}
      />
      <FileTree
        rows={tree.visibleRows}
        selectedPath={tree.selectedPath}
        draft={tree.draft}
        iconSet={iconSet}
        rootLoading={tree.rootLoading}
        rootError={tree.rootError}
        filtering={tree.searchQuery.trim().length > 0}
        onSelect={(entry) => tree.selectPath(entry.path)}
        onToggle={tree.toggleExpand}
        onOpenFile={(entry) => void tree.openEntry(entry)}
        onContextMenu={(entry, x, y) => setMenu({ entry, x, y })}
        onDraftChange={tree.setDraftName}
        onDraftCommit={() => void tree.commitDraft()}
        onDraftCancel={tree.cancelDraft}
        onStartRename={tree.startRename}
        onDelete={(entry) => void tree.deleteEntry(entry)}
        onMoveSelection={moveSelection}
        onCollapseOrParent={collapseOrParent}
        onExpandOrChild={expandOrChild}
        onEnter={handleEnter}
      />
      {menu ? (
        <FileTreeContextMenu
          x={menu.x}
          y={menu.y}
          entry={menu.entry}
          onClose={closeMenu}
          onOpen={() => void tree.openEntry(menu.entry)}
          onOpenInTerminal={() => handleOpenInTerminal(menu.entry)}
          onOpenInSourceControl={() =>
            onOpenInSourceControl?.(menu.entry.path)
          }
          onReveal={() => void tree.revealEntry(menu.entry)}
          onCopyPath={() => void tree.copyPath(menu.entry)}
          onNewFile={() => tree.startCreate('create-file', menu.entry)}
          onNewFolder={() => tree.startCreate('create-dir', menu.entry)}
          onRename={() => tree.startRename(menu.entry)}
          onDelete={() => void tree.deleteEntry(menu.entry)}
          onAbout={() => void tree.openAbout(menu.entry)}
        />
      ) : null}
      {tree.aboutInfo ? (
        <FileAboutModal
          info={tree.aboutInfo}
          loading={tree.aboutLoading}
          error={tree.aboutError}
          onClose={tree.closeAbout}
        />
      ) : null}
      {pendingCdPath ? (
        <OpenInTerminalModal
          onClose={closeOpenInTerminalModal}
          onOpenTerminalTab={handleOpenTerminalTab}
        />
      ) : null}
    </div>
  );
}
