import Editor, { type OnMount } from "@monaco-editor/react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import { useFileIconSet } from "../../../hooks/useFileIconSet";
import {
  GENSOURCE_NORD_THEME,
  cssThemeVar,
  defineGensourceNordTheme,
  monaco,
} from "../../../lib/monaco";
import {
  assembleUnifiedDocument,
  changeHunkStarts,
  diffSideLabel,
  fileEntryFromPath,
  fileNameFromPath,
  formatDiffLineNumber,
  gitFileDiff,
  highlightToMonacoColumns,
  isCleanDiff,
  isMissingDiffError,
  languageFromPath,
  type GitFileDiff,
} from "../../../lib/terminal/git-diff";
import {
  changeStatusLabel,
  scmErrorMessage,
  scmRootsEqual,
  subscribeScmChanged,
} from "../../../lib/terminal/git-scm";
import type { GitChangeStatus, GitDiffSide } from "../../../types/git-scm";
import { renderFileTypeIcon } from "../../icons/fileIconSets/renderFileTypeIcon";
import { ChevronRightIcon } from "../../icons/MenuIcons";

export interface GitDiffPaneMeta {
  additions: number;
  deletions: number;
  language: string;
  binary: boolean;
  empty: boolean;
}

export interface GitDiffPaneHandle {
  openFind: () => void;
}

export interface GitDiffPaneProps {
  repoRoot: string;
  filePath: string;
  absolutePath: string;
  side: GitDiffSide;
  status: GitChangeStatus;
  fontFamily: string;
  fontSize: number;
  visible: boolean;
  onMeta?: (meta: GitDiffPaneMeta) => void;
}

type ViewState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "missing" }
  | { kind: "binary"; diff: GitFileDiff }
  | { kind: "empty"; diff: GitFileDiff }
  | { kind: "ready"; diff: GitFileDiff };

const GitDiffPane = forwardRef<GitDiffPaneHandle, GitDiffPaneProps>(
  function GitDiffPane(
    {
      repoRoot,
      filePath,
      absolutePath,
      side,
      status,
      fontFamily,
      fontSize,
      visible,
      onMeta,
    },
    ref,
  ) {
    const iconSet = useFileIconSet();
    const [view, setView] = useState<ViewState>({ kind: "loading" });
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const decorationsRef =
      useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
    const hunksRef = useRef<number[]>([]);
    const hunkIndexRef = useRef(0);
    const onMetaRef = useRef(onMeta);
    const linesRef = useRef(view.kind === "ready" ? view.diff.lines : []);

    useEffect(() => {
      onMetaRef.current = onMeta;
    }, [onMeta]);

    const language = languageFromPath(filePath);
    const fileName = fileNameFromPath(filePath);
    const fileEntry = useMemo(() => fileEntryFromPath(filePath), [filePath]);

    const loadDiff = useCallback(async () => {
      try {
        const next = await gitFileDiff(repoRoot, filePath, side);
        if (next.binary) {
          setView({ kind: "binary", diff: next });
          onMetaRef.current?.({
            additions: next.additions,
            deletions: next.deletions,
            language,
            binary: true,
            empty: false,
          });
          return;
        }
        if (isCleanDiff(next)) {
          setView({ kind: "empty", diff: next });
          onMetaRef.current?.({
            additions: 0,
            deletions: 0,
            language,
            binary: false,
            empty: true,
          });
          return;
        }
        setView({ kind: "ready", diff: next });
        onMetaRef.current?.({
          additions: next.additions,
          deletions: next.deletions,
          language,
          binary: false,
          empty: false,
        });
      } catch (error) {
        const message = scmErrorMessage(error, "Failed to load diff");
        if (isMissingDiffError(message)) {
          setView({ kind: "missing" });
        } else {
          setView({ kind: "error", message });
        }
        onMetaRef.current?.({
          additions: 0,
          deletions: 0,
          language,
          binary: false,
          empty: true,
        });
      }
    }, [filePath, language, repoRoot, side]);

    useEffect(() => {
      setView({ kind: "loading" });
      void loadDiff();
    }, [loadDiff]);

    useEffect(() => {
      let cancelled = false;
      let unlisten: (() => void) | undefined;

      void subscribeScmChanged((payload) => {
        if (!payload?.root) return;
        if (!scmRootsEqual(payload.root, repoRoot)) return;
        void loadDiff();
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
    }, [loadDiff, repoRoot]);

    const readyDiff = view.kind === "ready" ? view.diff : null;
    const unified = useMemo(
      () => assembleUnifiedDocument(readyDiff?.lines ?? []),
      [readyDiff],
    );

    useEffect(() => {
      linesRef.current = unified.lines;
      hunksRef.current = changeHunkStarts(unified.lines);
      hunkIndexRef.current = 0;
    }, [unified.lines]);

    const applyDecorations = useCallback(
      (editor: monaco.editor.IStandaloneCodeEditor) => {
        const lines = linesRef.current;
        const success = cssThemeVar("--success", "#a3be8c");
        const danger = cssThemeVar("--danger", "#bf616a");
        const next: monaco.editor.IModelDeltaDecoration[] = [];

        lines.forEach((line, index) => {
          const lineNo = index + 1;
          if (line.kind === "insert" || line.kind === "delete") {
            const color = line.kind === "insert" ? success : danger;
            next.push({
              range: new monaco.Range(lineNo, 1, lineNo, 1),
              options: {
                isWholeLine: true,
                className:
                  line.kind === "insert"
                    ? "git-diff-line--insert"
                    : "git-diff-line--delete",
                linesDecorationsClassName:
                  line.kind === "insert"
                    ? "git-diff-gutter--insert"
                    : "git-diff-gutter--delete",
                overviewRuler: {
                  color,
                  position: monaco.editor.OverviewRulerLane.Full,
                },
              },
            });
          }
          for (const highlight of line.highlights ?? []) {
            const { startColumn, endColumn } = highlightToMonacoColumns(
              line.text,
              highlight.start,
              highlight.end,
            );
            if (endColumn <= startColumn) continue;
            next.push({
              range: new monaco.Range(lineNo, startColumn, lineNo, endColumn),
              options: {
                inlineClassName:
                  line.kind === "delete"
                    ? "git-diff-inline--delete"
                    : "git-diff-inline--insert",
              },
            });
          }
        });

        if (decorationsRef.current) {
          decorationsRef.current.set(next);
        } else {
          decorationsRef.current = editor.createDecorationsCollection(next);
        }

        editor.updateOptions({
          lineNumbers: (lineNumber) =>
            formatDiffLineNumber(linesRef.current[lineNumber - 1]),
        });
      },
      [],
    );

    const handleMount: OnMount = (editor) => {
      editorRef.current = editor;
      defineGensourceNordTheme();
      monaco.editor.setTheme(GENSOURCE_NORD_THEME);
      applyDecorations(editor);
    };

    useEffect(() => {
      const editor = editorRef.current;
      if (!editor || view.kind !== "ready") return;
      applyDecorations(editor);
    }, [applyDecorations, unified.text, view.kind]);

    useEffect(() => {
      defineGensourceNordTheme();
      monaco.editor.setTheme(GENSOURCE_NORD_THEME);
      const root = document.documentElement;
      const observer = new MutationObserver(() => {
        defineGensourceNordTheme();
        monaco.editor.setTheme(GENSOURCE_NORD_THEME);
        if (editorRef.current) {
          applyDecorations(editorRef.current);
        }
      });
      observer.observe(root, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
      return () => observer.disconnect();
    }, [applyDecorations]);

    const jumpToHunk = useCallback((direction: 1 | -1) => {
      const hunks = hunksRef.current;
      const editor = editorRef.current;
      if (!editor || hunks.length === 0) return;
      const next =
        (hunkIndexRef.current + direction + hunks.length) % hunks.length;
      hunkIndexRef.current = next;
      const line = hunks[next];
      if (line == null) return;
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column: 1 });
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        openFind: () => {
          editorRef.current?.getAction("actions.find")?.run();
        },
      }),
      [],
    );

    const counts =
      view.kind === "ready" || view.kind === "binary" || view.kind === "empty"
        ? view.diff
        : null;
    const truncated = view.kind === "ready" && view.diff.truncated;
    const conflicted = status === "conflict";

    return (
      <div
        className="git-diff-pane"
        data-testid="git-diff-pane"
        data-side={side}
        aria-hidden={!visible}
      >
        <header className="git-diff-pane__header">
          <div className="git-diff-pane__identity">
            <span className="git-diff-pane__file-icon">
              {renderFileTypeIcon(fileEntry, { iconSet })}
            </span>
            <span className="git-diff-pane__name">{fileName}</span>
            <span className="git-diff-pane__path" title={absolutePath || filePath}>
              {filePath}
            </span>
          </div>
          <div className="git-diff-pane__meta">
            <span
              className={`scm-change__badge scm-change__badge--${status}`}
              aria-hidden
            >
              {changeStatusLabel(status)}
            </span>
            <span className="git-diff-pane__pill">{diffSideLabel(side)}</span>
            {counts ? (
              <span className="git-diff-pane__counts">
                <span className="git-diff-pane__counts-add">
                  +{counts.additions}
                </span>{" "}
                <span className="git-diff-pane__counts-del">
                  −{counts.deletions}
                </span>
              </span>
            ) : null}
            <div className="git-diff-pane__nav">
              <button
                type="button"
                className="git-diff-pane__nav-btn"
                aria-label="Previous change"
                title="Previous change"
                disabled={view.kind !== "ready"}
                onClick={() => jumpToHunk(-1)}
              >
                <ChevronRightIcon className="git-diff-pane__nav-icon--up" />
              </button>
              <button
                type="button"
                className="git-diff-pane__nav-btn"
                aria-label="Next change"
                title="Next change"
                disabled={view.kind !== "ready"}
                onClick={() => jumpToHunk(1)}
              >
                <ChevronRightIcon className="git-diff-pane__nav-icon--down" />
              </button>
            </div>
          </div>
        </header>

        {conflicted ? (
          <div className="git-diff-pane__banner" role="status">
            This file has merge conflicts.
          </div>
        ) : null}
        {truncated ? (
          <div className="git-diff-pane__banner" role="status">
            Diff truncated — file is larger than the preview limit.
          </div>
        ) : null}

        <div className="git-diff-pane__body">
          {view.kind === "loading" ? (
            <p className="git-diff-pane__empty">Loading diff…</p>
          ) : null}
          {view.kind === "error" ? (
            <p className="git-diff-pane__empty">{view.message}</p>
          ) : null}
          {view.kind === "missing" ? (
            <p className="git-diff-pane__empty">File is missing.</p>
          ) : null}
          {view.kind === "binary" ? (
            <p className="git-diff-pane__empty">Binary file — cannot display a text diff.</p>
          ) : null}
          {view.kind === "empty" ? (
            <p className="git-diff-pane__empty">No changes</p>
          ) : null}
          {view.kind === "ready" ? (
            <Editor
              height="100%"
              language={language}
              value={unified.text}
              theme={GENSOURCE_NORD_THEME}
              onMount={handleMount}
              loading={<p className="git-diff-pane__empty">Loading editor…</p>}
              options={{
                readOnly: true,
                domReadOnly: true,
                automaticLayout: true,
                scrollBeyondLastLine: false,
                minimap: { enabled: false },
                folding: false,
                glyphMargin: false,
                renderLineHighlight: "none",
                wordWrap: "off",
                fontFamily,
                fontSize,
                lineNumbersMinChars: 7,
                lineNumbers: (lineNumber) =>
                  formatDiffLineNumber(unified.lines[lineNumber - 1]),
                overviewRulerBorder: false,
                hideCursorInOverviewRuler: true,
                padding: { top: 4, bottom: 4 },
                contextmenu: true,
                find: { addExtraSpaceOnTop: false },
                scrollbar: {
                  verticalScrollbarSize: 10,
                  horizontalScrollbarSize: 10,
                },
              }}
            />
          ) : null}
        </div>
      </div>
    );
  },
);

export default GitDiffPane;
