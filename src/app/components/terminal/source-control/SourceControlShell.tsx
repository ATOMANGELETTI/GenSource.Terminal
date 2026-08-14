import { useEffect, useState } from "react";

import type { OpenDiffRequest } from "../../../lib/terminal/git-diff";
import type { ScmPanelState } from "../../../types/git-scm";
import { GitTreeIcon, SourceControlIcon } from "../../icons/MenuIcons";
import GitRepoTree from "./GitRepoTree";
import SourceControlPanel from "./SourceControlPanel";

const SCM_VIEW_STORAGE_KEY = "gensource.scm.view";

type ScmView = "changes" | "tree";

interface SourceControlShellProps {
  folderPath: string | null;
  onFolderPathChange: (path: string | null) => void;
  onOpenDiff?: (request: OpenDiffRequest) => void;
}

function isScmView(value: string): value is ScmView {
  return value === "changes" || value === "tree";
}

function readStoredView(): ScmView {
  try {
    const stored = sessionStorage.getItem(SCM_VIEW_STORAGE_KEY);
    if (stored && isScmView(stored)) return stored;
  } catch {
    // sessionStorage unavailable
  }
  return "changes";
}

export default function SourceControlShell({
  folderPath,
  onFolderPathChange,
  onOpenDiff,
}: SourceControlShellProps) {
  const [view, setView] = useState<ScmView>(readStoredView);
  const [panelState, setPanelState] = useState<ScmPanelState>(
    folderPath ? "init" : "empty",
  );

  useEffect(() => {
    try {
      sessionStorage.setItem(SCM_VIEW_STORAGE_KEY, view);
    } catch {
      // sessionStorage unavailable
    }
  }, [view]);

  useEffect(() => {
    if (!folderPath) setPanelState("empty");
  }, [folderPath]);

  const showRail = panelState === "repo";

  return (
    <div
      className={showRail ? "scm-shell" : "scm-shell scm-shell--solo"}
      data-testid="scm-shell"
    >
      {showRail ? (
        <nav className="scm-shell__rail" aria-label="Source Control views">
          <button
            type="button"
            className={
              view === "changes"
                ? "scm-shell__rail-btn scm-shell__rail-btn--active"
                : "scm-shell__rail-btn"
            }
            aria-label="Changes"
            title="Changes"
            aria-current={view === "changes" ? "page" : undefined}
            onClick={() => setView("changes")}
          >
            <SourceControlIcon className="scm-shell__rail-icon" />
          </button>
          <button
            type="button"
            className={
              view === "tree"
                ? "scm-shell__rail-btn scm-shell__rail-btn--active"
                : "scm-shell__rail-btn"
            }
            aria-label="Git tree"
            title="Git tree"
            aria-current={view === "tree" ? "page" : undefined}
            onClick={() => setView("tree")}
          >
            <GitTreeIcon className="scm-shell__rail-icon" />
          </button>
        </nav>
      ) : null}
      <div className="scm-shell__main">
        <div
          className={
            showRail && view !== "changes"
              ? "scm-shell__pane scm-shell__pane--hidden"
              : "scm-shell__pane"
          }
          aria-hidden={showRail && view !== "changes"}
        >
          <SourceControlPanel
            folderPath={folderPath}
            onFolderPathChange={onFolderPathChange}
            onPanelStateChange={setPanelState}
            onOpenDiff={onOpenDiff}
          />
        </div>
        {showRail && view === "tree" && folderPath ? (
          <GitRepoTree
            repoPath={folderPath}
            onFolderPathChange={onFolderPathChange}
            onOpenDiff={onOpenDiff}
          />
        ) : null}
      </div>
    </div>
  );
}
