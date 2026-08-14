import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { confirm } from "@tauri-apps/plugin-dialog";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { useFileIconSet } from "../../../hooks/useFileIconSet";
import { openContextMenuPopup } from "../../../lib/context-menu-popup";
import { fsOpenPath, fsRevealPath } from "../../../lib/terminal/explorer-fs";
import type { OpenDiffRequest } from "../../../lib/terminal/git-diff";
import {
  buildGitTreeRows,
  folderDisplayName,
  gitDiscard,
  gitListDir,
  gitOpenFolder,
  gitStage,
  gitTreeEntryToFsEntry,
  gitUnstage,
  normGitRela,
  pickScmFolder,
  scmErrorMessage,
  scmRootsEqual,
  subscribeScmChanged,
  treeDecorationLabel,
  treeEntryToChangeEntry,
  treeEntryTooltip,
  treeSectionForEntry,
} from "../../../lib/terminal/git-scm";
import type { GitTreeEntry } from "../../../types/git-scm";
import { fileTypeIcon } from "../explorer/fileTypeIcon";
import {
  ChevronRightIcon,
  CloseIcon,
  FolderIcon,
  ReloadIcon,
} from "../../icons/MenuIcons";
import ChangeRowContextMenu, {
  type ChangeRowMenuState,
} from "./ChangeRowContextMenu";

const ROOT_KEY = "";

interface GitRepoTreeProps {
  repoPath: string;
  onFolderPathChange: (path: string | null) => void;
  onOpenDiff?: (request: OpenDiffRequest) => void;
}

export default function GitRepoTree({
  repoPath,
  onFolderPathChange,
  onOpenDiff,
}: GitRepoTreeProps) {
  const iconSet = useFileIconSet();
  const [rootLabel, setRootLabel] = useState(folderDisplayName(repoPath));
  const [entries, setEntries] = useState<GitTreeEntry[]>([]);
  const [children, setChildren] = useState<Record<string, GitTreeEntry[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rootLoading, setRootLoading] = useState(false);
  const [rootError, setRootError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [rowMenu, setRowMenu] = useState<ChangeRowMenuState | null>(null);
  const [busy, setBusy] = useState(false);

  const childrenRef = useRef(children);
  const expandedRef = useRef(expanded);
  const entriesRef = useRef(entries);
  const repoPathRef = useRef(repoPath);
  childrenRef.current = children;
  expandedRef.current = expanded;
  entriesRef.current = entries;
  repoPathRef.current = repoPath;

  const markLoading = useCallback((key: string, on: boolean) => {
    setLoadingPaths((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const loadDir = useCallback(
    async (dir: string, opts?: { force?: boolean }) => {
      const key = normGitRela(dir);
      if (!opts?.force && childrenRef.current[key]) {
        return childrenRef.current[key];
      }
      markLoading(key, true);
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      try {
        const listed = await gitListDir(repoPathRef.current, dir);
        if (key === ROOT_KEY) {
          setEntries(listed);
        }
        setChildren((prev) => ({ ...prev, [key]: listed }));
        return listed;
      } catch (error) {
        const msg = scmErrorMessage(error, "Unable to list folder");
        setErrors((prev) => ({ ...prev, [key]: msg }));
        if (key === ROOT_KEY) {
          setRootError(msg);
          setEntries([]);
        }
        setChildren((prev) => ({ ...prev, [key]: [] }));
        return [];
      } finally {
        markLoading(key, false);
      }
    },
    [markLoading],
  );

  const refreshExpanded = useCallback(async () => {
    setRootLoading(true);
    setRootError(null);
    try {
      const discovered = await gitOpenFolder(repoPathRef.current);
      if (discovered.isRepo) {
        setRootLabel(folderDisplayName(discovered.root));
      }
      const jobs = [loadDir("", { force: true })];
      for (const key of expandedRef.current) {
        if (!key) continue;
        const entry = findTreeEntry(
          key,
          entriesRef.current,
          childrenRef.current,
        );
        jobs.push(loadDir(entry?.path ?? key, { force: true }));
      }
      await Promise.all(jobs);
    } catch (error) {
      setRootError(scmErrorMessage(error, "Unable to refresh git tree"));
    } finally {
      setRootLoading(false);
    }
  }, [loadDir]);

  useEffect(() => {
    setChildren({});
    setExpanded(new Set());
    setSelectedPath(null);
    setRootLabel(folderDisplayName(repoPath));
    void refreshExpanded();
  }, [repoPath, refreshExpanded]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void subscribeScmChanged((payload) => {
      if (!payload?.root) return;
      if (!scmRootsEqual(payload.root, repoPathRef.current)) return;
      void refreshExpanded();
    }).then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [refreshExpanded]);

  useEffect(() => {
    if (!rowMenu) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRowMenu(null);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        setRowMenu(null);
        return;
      }
      if (target.closest(".scm-change-context-menu")) return;
      setRowMenu(null);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [rowMenu]);

  const toggleExpand = useCallback(
    (entry: GitTreeEntry) => {
      if (entry.kind !== "dir") return;
      const key = normGitRela(entry.path);
      const willExpand = !expandedRef.current.has(key);
      setExpanded((prev) => {
        const next = new Set(prev);
        if (willExpand) next.add(key);
        else next.delete(key);
        return next;
      });
      if (willExpand) void loadDir(entry.path);
    },
    [loadDir],
  );

  const handleOpenFolder = useCallback(async () => {
    try {
      const selected = await pickScmFolder();
      if (!selected) return;
      onFolderPathChange(selected);
    } catch {
      // picker cancel
    }
  }, [onFolderPathChange]);

  const runMutation = useCallback(
    async (action: () => Promise<void>, fallback: string) => {
      setBusy(true);
      try {
        await action();
        await refreshExpanded();
      } catch (error) {
        setRootError(scmErrorMessage(error, fallback));
      } finally {
        setBusy(false);
      }
    },
    [refreshExpanded],
  );

  const handleStage = useCallback(
    (paths: string[]) => {
      if (!paths.length) return;
      void runMutation(() => gitStage(repoPath, paths), "Failed to stage");
    },
    [repoPath, runMutation],
  );

  const handleUnstage = useCallback(
    (paths: string[]) => {
      if (!paths.length) return;
      void runMutation(() => gitUnstage(repoPath, paths), "Failed to unstage");
    },
    [repoPath, runMutation],
  );

  const handleDiscard = useCallback(
    async (paths: string[]) => {
      if (!paths.length) return;
      const ok = await confirm(
        paths.length === 1
          ? `Discard changes in ${paths[0]}? This cannot be undone.`
          : `Discard changes in ${paths.length} files? This cannot be undone.`,
        { title: "Discard Changes", kind: "warning" },
      );
      if (!ok) return;
      void runMutation(() => gitDiscard(repoPath, paths), "Failed to discard");
    },
    [repoPath, runMutation],
  );

  const openDiff = useCallback(
    (entry: GitTreeEntry) => {
      if (!onOpenDiff) return;
      const section = treeSectionForEntry(entry);
      if (section === "clean") return;
      onOpenDiff({
        repoRoot: repoPath,
        path: entry.path,
        absolutePath: entry.absolutePath,
        side: section === "staged" ? "staged" : "unstaged",
        status: treeEntryToChangeEntry(entry).status,
      });
    },
    [onOpenDiff, repoPath],
  );

  const openTreeContext = (
    entry: GitTreeEntry,
    event: ReactMouseEvent,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const section = treeSectionForEntry(entry);
    const change = treeEntryToChangeEntry(entry);
    const { clientX, clientY } = event;
    void (async () => {
      const opened = await openContextMenuPopup(clientX, clientY, {
        kind: "scm-change",
        entry: change,
        section,
      });
      if (!opened) {
        setRowMenu({ entry: change, section, x: clientX, y: clientY });
      }
    })();
  };

  const rows = buildGitTreeRows({
    entries,
    children,
    expanded,
    loadingPaths,
    errors,
  });

  return (
    <div className="scm-tree" data-testid="scm-git-tree">
      <header className="scm-header">
        <div className="scm-header__title" title={repoPath}>
          <FolderIcon className="scm-header__icon" />
          <span className="scm-header__name">{rootLabel}</span>
        </div>
        <div className="scm-header__actions">
          <button
            type="button"
            className="scm-icon-btn scm-icon-btn--danger"
            title="Close"
            aria-label="Close repo"
            onClick={() => onFolderPathChange(null)}
          >
            <CloseIcon />
          </button>
          <button
            type="button"
            className="scm-icon-btn"
            title="Open Folder"
            aria-label="Open Folder"
            onClick={() => void handleOpenFolder()}
          >
            <FolderIcon />
          </button>
          <button
            type="button"
            className="scm-icon-btn"
            title="Refresh"
            aria-label="Refresh"
            disabled={rootLoading || busy}
            onClick={() => void refreshExpanded()}
          >
            <ReloadIcon />
          </button>
        </div>
      </header>
      {rootError ? <p className="scm-error scm-error--inline">{rootError}</p> : null}
      <div className="scm-tree__body" role="tree">
        {rootLoading && entries.length === 0 ? (
          <div className="file-tree-node__status">Loading…</div>
        ) : null}
        {rows.map((row) => {
          const { entry, depth, expanded: isExpanded, pending, empty, error } =
            row;
          const selected = selectedPath === entry.path;
          const isDir = entry.kind === "dir";
          const ignored = entry.ignored || entry.decoration === "ignored";
          const badge = treeDecorationLabel(entry.decoration, entry.status);
          return (
            <div key={entry.path}>
              <div
                className={[
                  "file-tree-node",
                  "scm-tree-node",
                  selected ? "file-tree-node--selected" : "",
                  ignored ? "scm-tree-node--ignored" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ paddingLeft: `${0.35 + depth * 0.75}rem` }}
                role="treeitem"
                aria-selected={selected}
                aria-expanded={isDir ? isExpanded : undefined}
                data-path={entry.path}
                title={treeEntryTooltip(entry)}
                onClick={() => {
                  setSelectedPath(entry.path);
                  if (isDir) toggleExpand(entry);
                  else void fsOpenPath(entry.absolutePath);
                }}
                onContextMenu={(event) => {
                  setSelectedPath(entry.path);
                  openTreeContext(entry, event);
                }}
              >
                <span
                  className={
                    isDir
                      ? isExpanded
                        ? "file-tree-node__chevron file-tree-node__chevron--open"
                        : "file-tree-node__chevron"
                      : "file-tree-node__chevron file-tree-node__chevron--hidden"
                  }
                  aria-hidden
                >
                  <ChevronRightIcon />
                </span>
                {fileTypeIcon(gitTreeEntryToFsEntry(entry), {
                  expanded: isExpanded,
                  iconSet,
                })}
                <span className="file-tree-node__name">{entry.name}</span>
                {badge ? (
                  <span
                    className={`scm-change__badge scm-change__badge--${
                      entry.status ?? entry.decoration
                    }`}
                    aria-hidden
                  >
                    {badge}
                  </span>
                ) : null}
              </div>
              {isExpanded && pending ? (
                <div
                  className="file-tree-node__status"
                  style={{ paddingLeft: `${1.1 + (depth + 1) * 0.75}rem` }}
                >
                  Loading…
                </div>
              ) : null}
              {isExpanded && error ? (
                <div
                  className="file-tree-node__status file-tree-node__status--error"
                  style={{ paddingLeft: `${1.1 + (depth + 1) * 0.75}rem` }}
                >
                  {error}
                </div>
              ) : null}
              {isExpanded && empty ? (
                <div
                  className="file-tree-node__status"
                  style={{ paddingLeft: `${1.1 + (depth + 1) * 0.75}rem` }}
                >
                  Empty
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {rowMenu ? (
        <ChangeRowContextMenu
          {...rowMenu}
          onClose={() => setRowMenu(null)}
          onOpenDiff={
            rowMenu.section === "clean"
              ? undefined
              : () => {
                  const match = findTreeEntry(
                    rowMenu.entry.path,
                    entries,
                    children,
                  );
                  if (match) openDiff(match);
                }
          }
          onStage={() => handleStage([rowMenu.entry.path])}
          onUnstage={() => handleUnstage([rowMenu.entry.path])}
          onDiscard={() => void handleDiscard([rowMenu.entry.path])}
          onOpen={() => void fsOpenPath(rowMenu.entry.absolutePath)}
          onCopyPath={() => void writeText(rowMenu.entry.absolutePath)}
          onReveal={() => void fsRevealPath(rowMenu.entry.absolutePath)}
        />
      ) : null}
    </div>
  );
}

function findTreeEntry(
  path: string,
  root: GitTreeEntry[],
  children: Record<string, GitTreeEntry[]>,
): GitTreeEntry | undefined {
  const key = normGitRela(path);
  const hit = root.find((entry) => normGitRela(entry.path) === key);
  if (hit) return hit;
  for (const list of Object.values(children)) {
    const nested = list.find((entry) => normGitRela(entry.path) === key);
    if (nested) return nested;
  }
  return undefined;
}
