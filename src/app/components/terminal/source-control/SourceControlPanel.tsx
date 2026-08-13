import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { confirm } from "@tauri-apps/plugin-dialog";

import {
  listenContextMenuAction,
  openContextMenuPopup,
} from "../../../lib/context-menu-popup";
import { fsOpenPath, fsRevealPath } from "../../../lib/terminal/explorer-fs";
import {
  autoStagePaths,
  canCommit,
  changesSectionEntries,
  emptyStatus,
  folderDisplayName,
  gitBranches,
  gitCheckout,
  gitCommit,
  gitCreateBranch,
  gitDiscard,
  gitInit,
  gitOpenFolder,
  gitStage,
  gitStatus,
  gitUnstage,
  gitWatchStart,
  gitWatchStop,
  pickScmFolder,
  resolveScmPanelState,
  scmErrorMessage,
  subscribeScmChanged,
} from "../../../lib/terminal/git-scm";
import type {
  GitBranchInfo,
  GitChangeEntry,
  GitOpenFolderResult,
  GitStatusResult,
} from "../../../types/git-scm";
import {
  ChevronRightIcon,
  CloseIcon,
  FolderIcon,
  ReloadIcon,
  SourceControlIcon,
} from "../../icons/MenuIcons";
import ChangeRowContextMenu, {
  ChangeStatusBadge,
  type ChangeListSection,
  type ChangeRowMenuState,
} from "./ChangeRowContextMenu";

interface SourceControlPanelProps {
  folderPath: string | null;
  onFolderPathChange: (path: string | null) => void;
}

function scmRootsEqual(a: string, b: string): boolean {
  const norm = (value: string) =>
    value.replace(/[\\/]+$/, "").replace(/\\/g, "/").toLowerCase();
  return norm(a) === norm(b);
}

/** Keep intentional Unstage from fighting auto-stage / watch refresh briefly. */
const SKIP_AUTO_STAGE_MS = 1500;

export default function SourceControlPanel({
  folderPath,
  onFolderPathChange,
}: SourceControlPanelProps) {
  const messageId = useId();
  const [openResult, setOpenResult] = useState<GitOpenFolderResult | null>(null);
  const [status, setStatus] = useState<GitStatusResult>(emptyStatus());
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [branches, setBranches] = useState<GitBranchInfo[]>([]);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [createBranchOpen, setCreateBranchOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [rowMenu, setRowMenu] = useState<ChangeRowMenuState | null>(null);
  const branchMenuRef = useRef<HTMLDivElement | null>(null);
  const skipAutoStageUntilRef = useRef(0);
  const refreshGenRef = useRef(0);
  const loadingOwnerRef = useRef(0);
  const gitRootRef = useRef("");
  const folderPathRef = useRef(folderPath);

  const panelState = resolveScmPanelState(folderPath, openResult);
  const gitRoot = openResult?.isRepo
    ? openResult.root
    : (folderPath ?? "");
  const displayRoot = openResult?.root ?? folderPath ?? "";
  const staged = status.staged;
  const changes = changesSectionEntries(status);
  const conflicts = status.conflicted;

  gitRootRef.current = gitRoot;
  folderPathRef.current = folderPath;

  const armSkipAutoStage = useCallback(() => {
    skipAutoStageUntilRef.current = Date.now() + SKIP_AUTO_STAGE_MS;
  }, []);

  const clearSkipAutoStage = useCallback(() => {
    skipAutoStageUntilRef.current = 0;
  }, []);

  const applyAutoStage = useCallback(
    async (root: string, nextStatus: GitStatusResult): Promise<GitStatusResult> => {
      if (Date.now() < skipAutoStageUntilRef.current) {
        return nextStatus;
      }
      const paths = autoStagePaths(nextStatus);
      if (!paths.length) return nextStatus;
      await gitStage(root, paths);
      return gitStatus(root);
    },
    [],
  );

  const refresh = useCallback(
    async (path: string, options?: { quiet?: boolean }) => {
      const quiet = options?.quiet === true;
      const gen = ++refreshGenRef.current;
      const isStale = () => gen !== refreshGenRef.current;

      if (!quiet) {
        setLoading(true);
        setError(null);
        loadingOwnerRef.current = gen;
      }
      try {
        const discovered = await gitOpenFolder(path);
        if (isStale()) return;
        setOpenResult(discovered);
        if (!discovered.isRepo) {
          setStatus(emptyStatus());
          setBranches([]);
          return;
        }
        const [initialStatus, nextBranches] = await Promise.all([
          gitStatus(discovered.root),
          gitBranches(discovered.root).catch(() => [] as GitBranchInfo[]),
        ]);
        if (isStale()) return;
        let nextStatus = initialStatus;
        try {
          nextStatus = await applyAutoStage(discovered.root, initialStatus);
        } catch (err) {
          if (!quiet) {
            setError(scmErrorMessage(err, "Failed to auto-stage changes"));
          }
        }
        if (isStale()) return;
        setStatus(nextStatus);
        setBranches(nextBranches);
      } catch (err) {
        if (isStale()) return;
        if (quiet) return;
        setOpenResult(null);
        setStatus(emptyStatus());
        setBranches([]);
        setError(scmErrorMessage(err, "Failed to open folder"));
      } finally {
        if (!quiet && loadingOwnerRef.current === gen) {
          setLoading(false);
        }
      }
    },
    [applyAutoStage],
  );

  useEffect(() => {
    if (!folderPath) {
      refreshGenRef.current += 1;
      setOpenResult(null);
      setStatus(emptyStatus());
      setBranches([]);
      setError(null);
      setMessage("");
      setBranchMenuOpen(false);
      setCreateBranchOpen(false);
      setNewBranchName("");
      setRowMenu(null);
      clearSkipAutoStage();
      return;
    }
    void refresh(folderPath);
  }, [folderPath, refresh, clearSkipAutoStage]);

  useEffect(() => {
    if (panelState !== "repo" || !gitRoot) {
      void gitWatchStop().catch(() => undefined);
      return;
    }
    void gitWatchStart(gitRoot).catch(() => undefined);
    return () => {
      void gitWatchStop().catch(() => undefined);
    };
  }, [panelState, gitRoot]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void subscribeScmChanged((payload) => {
      const currentRoot = gitRootRef.current;
      if (!payload?.root || !currentRoot) return;
      if (!scmRootsEqual(payload.root, currentRoot)) return;
      const path = folderPathRef.current ?? currentRoot;
      void refresh(path, { quiet: true });
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
  }, [refresh]);

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

  useEffect(() => {
    if (!branchMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setBranchMenuOpen(false);
        setCreateBranchOpen(false);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        setBranchMenuOpen(false);
        return;
      }
      if (branchMenuRef.current?.contains(target)) return;
      setBranchMenuOpen(false);
      setCreateBranchOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [branchMenuOpen]);

  const handleOpenFolder = useCallback(async () => {
    try {
      const selected = await pickScmFolder();
      if (!selected) return;
      onFolderPathChange(selected);
    } catch (err) {
      setError(scmErrorMessage(err, "Failed to open folder picker"));
    }
  }, [onFolderPathChange]);

  const handleInit = useCallback(async () => {
    if (!folderPath) return;
    setBusy(true);
    setError(null);
    try {
      const result = await gitInit(folderPath);
      setOpenResult(result);
      await refresh(folderPath);
    } catch (err) {
      setError(scmErrorMessage(err, "Failed to initialize repository"));
    } finally {
      setBusy(false);
    }
  }, [folderPath, refresh]);

  const runMutation = useCallback(
    async (action: () => Promise<void>, fallback: string): Promise<boolean> => {
      if (!gitRoot) return false;
      setBusy(true);
      setError(null);
      try {
        await action();
        await refresh(folderPath ?? gitRoot);
        return true;
      } catch (err) {
        setError(scmErrorMessage(err, fallback));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [folderPath, gitRoot, refresh],
  );

  const handleCommit = useCallback(() => {
    if (!canCommit(message, staged.length) || !gitRoot) return;
    void runMutation(async () => {
      await gitCommit(gitRoot, message.trim());
    }, "Failed to commit").then((ok) => {
      if (ok) setMessage("");
    });
  }, [gitRoot, message, runMutation, staged.length]);

  const handleStage = useCallback(
    (paths: string[]) => {
      if (!paths.length) return;
      void runMutation(() => gitStage(gitRoot, paths), "Failed to stage");
    },
    [gitRoot, runMutation],
  );

  const handleUnstage = useCallback(
    (paths: string[]) => {
      if (!paths.length) return;
      armSkipAutoStage();
      void runMutation(() => gitUnstage(gitRoot, paths), "Failed to unstage").then(
        (ok) => {
          if (ok) armSkipAutoStage();
          else clearSkipAutoStage();
        },
      );
    },
    [armSkipAutoStage, clearSkipAutoStage, gitRoot, runMutation],
  );

  const handleDiscard = useCallback(
    async (paths: string[]) => {
      if (!paths.length || !gitRoot) return;
      const ok = await confirm(
        paths.length === 1
          ? `Discard changes in ${paths[0]}? This cannot be undone.`
          : `Discard changes in ${paths.length} files? This cannot be undone.`,
        { title: "Discard Changes", kind: "warning" },
      );
      if (!ok) return;
      void runMutation(() => gitDiscard(gitRoot, paths), "Failed to discard");
    },
    [gitRoot, runMutation],
  );

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void listenContextMenuAction((event) => {
      if (event.kind !== "scm-change" || event.payload.kind !== "scm-change") {
        return;
      }
      const { entry } = event.payload;
      switch (event.action) {
        case "stage":
          handleStage([entry.path]);
          break;
        case "unstage":
          handleUnstage([entry.path]);
          break;
        case "discard":
          void handleDiscard([entry.path]);
          break;
        case "open":
          void fsOpenPath(entry.absolutePath);
          break;
        case "copyPath":
          void writeText(entry.absolutePath);
          break;
        case "reveal":
          void fsRevealPath(entry.absolutePath);
          break;
        default:
          break;
      }
    }).then((stop) => {
      if (cancelled) {
        stop();
      } else {
        unlisten = stop;
      }
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [handleDiscard, handleStage, handleUnstage]);

  const handleCheckout = useCallback(
    (branch: string) => {
      setBranchMenuOpen(false);
      void runMutation(
        () => gitCheckout(gitRoot, branch),
        "Failed to checkout branch",
      );
    },
    [gitRoot, runMutation],
  );

  const handleCreateBranch = useCallback(() => {
    const name = newBranchName.trim();
    if (!name) return;
    setCreateBranchOpen(false);
    setBranchMenuOpen(false);
    setNewBranchName("");
    void runMutation(
      () => gitCreateBranch(gitRoot, name, true),
      "Failed to create branch",
    );
  }, [gitRoot, newBranchName, runMutation]);

  const openChangeContext = (
    entry: GitChangeEntry,
    section: ChangeListSection,
    event: ReactMouseEvent,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const { clientX, clientY } = event;
    void (async () => {
      const opened = await openContextMenuPopup(clientX, clientY, {
        kind: "scm-change",
        entry,
        section,
      });
      if (!opened) {
        setRowMenu({ entry, section, x: clientX, y: clientY });
      }
    })();
  };

  const renderChangeRow = (
    entry: GitChangeEntry,
    section: ChangeListSection,
  ) => {
    const key = `${section}:${entry.path}:${entry.status}`;
    return (
      <li key={key} className="scm-change">
        <button
          type="button"
          className="scm-change__row"
          title={entry.absolutePath}
          onContextMenu={(event) => openChangeContext(entry, section, event)}
        >
          <ChangeStatusBadge status={entry.status} />
          <span className="scm-change__path">{entry.path}</span>
        </button>
        <div className="scm-change__actions">
          {section === "staged" ? (
            <button
              type="button"
              className="scm-change__action"
              title="Unstage"
              aria-label={`Unstage ${entry.path}`}
              disabled={busy}
              onClick={() => handleUnstage([entry.path])}
            >
              −
            </button>
          ) : (
            <button
              type="button"
              className="scm-change__action"
              title="Stage"
              aria-label={`Stage ${entry.path}`}
              disabled={busy}
              onClick={() => handleStage([entry.path])}
            >
              +
            </button>
          )}
          {section !== "staged" ? (
            <button
              type="button"
              className="scm-change__action scm-change__action--danger"
              title="Discard"
              aria-label={`Discard ${entry.path}`}
              disabled={busy}
              onClick={() => void handleDiscard([entry.path])}
            >
              ↺
            </button>
          ) : null}
        </div>
      </li>
    );
  };

  if (panelState === "empty") {
    return (
      <div className="source-control" data-testid="source-control">
        <div className="scm-empty">
          <SourceControlIcon className="scm-empty__icon" />
          <p className="scm-empty__title">You have not yet opened a folder.</p>
          <p className="scm-empty__hint">
            Open a folder to view source control for a local Git repository.
          </p>
          <button
            type="button"
            className="scm-btn scm-btn--primary"
            onClick={() => void handleOpenFolder()}
          >
            Open Folder…
          </button>
          {error ? <p className="scm-error">{error}</p> : null}
        </div>
      </div>
    );
  }

  if (panelState === "init") {
    return (
      <div className="source-control" data-testid="source-control">
        <header className="scm-header">
          <div className="scm-header__title" title={folderPath ?? undefined}>
            <FolderIcon className="scm-header__icon" />
            <span className="scm-header__name">
              {folderDisplayName(folderPath ?? "")}
            </span>
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
              disabled={loading || busy}
              onClick={() => folderPath && void refresh(folderPath)}
            >
              <ReloadIcon />
            </button>
          </div>
        </header>
        <div className="scm-empty scm-empty--init">
          <p className="scm-empty__title">The folder is not a Git repository.</p>
          <p className="scm-empty__hint" title={folderPath ?? undefined}>
            {folderPath}
          </p>
          <div className="scm-empty__actions">
            <button
              type="button"
              className="scm-btn scm-btn--primary"
              disabled={busy || loading}
              onClick={() => void handleInit()}
            >
              Initialize Repository
            </button>
            <button
              type="button"
              className="scm-btn"
              onClick={() => void handleOpenFolder()}
            >
              Open Folder…
            </button>
          </div>
          {error ? <p className="scm-error">{error}</p> : null}
        </div>
      </div>
    );
  }

  const branchLabel = openResult?.branch ?? "HEAD";
  const ahead = openResult?.ahead ?? null;
  const behind = openResult?.behind ?? null;
  const head = openResult?.head ?? null;
  const commitEnabled = canCommit(message, staged.length) && !busy;

  return (
    <div className="source-control" data-testid="source-control">
      <header className="scm-header">
        <div className="scm-header__title" title={displayRoot}>
          <SourceControlIcon className="scm-header__icon" />
          <span className="scm-header__name">{folderDisplayName(displayRoot)}</span>
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
            disabled={loading || busy}
            onClick={() => folderPath && void refresh(folderPath)}
          >
            <ReloadIcon />
          </button>
        </div>
      </header>

      <div className="scm-meta">
        <div className="scm-branch" ref={branchMenuRef}>
          <button
            type="button"
            className="scm-branch__btn"
            aria-haspopup="menu"
            aria-expanded={branchMenuOpen}
            disabled={busy}
            onClick={() => {
              setBranchMenuOpen((open) => !open);
              setCreateBranchOpen(false);
            }}
          >
            <ChevronRightIcon
              className={
                branchMenuOpen
                  ? "scm-branch__chevron scm-branch__chevron--open"
                  : "scm-branch__chevron"
              }
            />
            <span className="scm-branch__name">{branchLabel}</span>
            {ahead != null || behind != null ? (
              <span className="scm-branch__sync">
                {ahead != null ? `↑${ahead}` : null}
                {behind != null ? ` ↓${behind}` : null}
              </span>
            ) : null}
          </button>
          {branchMenuOpen ? (
            <div className="scm-branch-menu" role="menu">
              {branches.map((branch) => (
                <button
                  key={branch.name}
                  type="button"
                  role="menuitem"
                  className={
                    branch.isCurrent
                      ? "scm-branch-menu__item scm-branch-menu__item--current"
                      : "scm-branch-menu__item"
                  }
                  disabled={branch.isCurrent || busy}
                  onClick={() => handleCheckout(branch.name)}
                >
                  {branch.name}
                </button>
              ))}
              <div className="scm-branch-menu__separator" role="separator" />
              {createBranchOpen ? (
                <div className="scm-branch-menu__create">
                  <input
                    className="scm-branch-menu__input"
                    value={newBranchName}
                    placeholder="Branch name"
                    aria-label="New branch name"
                    autoFocus
                    onChange={(event) => setNewBranchName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleCreateBranch();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="scm-btn scm-btn--primary scm-btn--small"
                    disabled={!newBranchName.trim() || busy}
                    onClick={handleCreateBranch}
                  >
                    Create
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  className="scm-branch-menu__item"
                  onClick={() => setCreateBranchOpen(true)}
                >
                  Create Branch…
                </button>
              )}
            </div>
          ) : null}
        </div>
        {head ? (
          <button
            type="button"
            className="scm-head"
            title="Copy HEAD"
            onClick={() => void writeText(head)}
          >
            {head.slice(0, 7)}
          </button>
        ) : null}
      </div>

      <div className="scm-commit">
        <label className="scm-commit__label" htmlFor={messageId}>
          Message
        </label>
        <textarea
          id={messageId}
          className="scm-commit__input"
          rows={3}
          value={message}
          placeholder="Message (Ctrl+Enter to commit)"
          disabled={busy}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              handleCommit();
            }
          }}
        />
        <button
          type="button"
          className="scm-btn scm-btn--primary scm-btn--block"
          disabled={!commitEnabled}
          onClick={handleCommit}
        >
          Commit
        </button>
      </div>

      {error ? <p className="scm-error scm-error--inline">{error}</p> : null}

      <div className="scm-sections">
        {conflicts.length > 0 ? (
          <section className="scm-section">
            <div className="scm-section__header">
              <h3 className="scm-section__title">
                Merge Changes
                <span className="scm-section__count">{conflicts.length}</span>
              </h3>
            </div>
            <ul className="scm-section__list">
              {conflicts.map((entry) => renderChangeRow(entry, "conflicted"))}
            </ul>
          </section>
        ) : null}

        <section className="scm-section">
          <div className="scm-section__header">
            <h3 className="scm-section__title">
              Staged Changes
              <span className="scm-section__count">{staged.length}</span>
            </h3>
            {staged.length > 0 ? (
              <button
                type="button"
                className="scm-section__action"
                disabled={busy}
                onClick={() => handleUnstage(staged.map((e) => e.path))}
              >
                Unstage All
              </button>
            ) : null}
          </div>
          {staged.length === 0 ? (
            <p className="scm-section__empty">No staged changes</p>
          ) : (
            <ul className="scm-section__list">
              {staged.map((entry) => renderChangeRow(entry, "staged"))}
            </ul>
          )}
        </section>

        <section className="scm-section">
          <div className="scm-section__header">
            <h3 className="scm-section__title">
              Changes
              <span className="scm-section__count">{changes.length}</span>
            </h3>
            {changes.length > 0 ? (
              <button
                type="button"
                className="scm-section__action"
                disabled={busy}
                onClick={() => handleStage(changes.map((e) => e.path))}
              >
                Stage All
              </button>
            ) : null}
          </div>
          {changes.length === 0 ? (
            <p className="scm-section__empty">No changes</p>
          ) : (
            <ul className="scm-section__list">
              {changes.map((entry) => renderChangeRow(entry, "changes"))}
            </ul>
          )}
        </section>
      </div>

      {rowMenu ? (
        <ChangeRowContextMenu
          {...rowMenu}
          onClose={() => setRowMenu(null)}
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
