import type { Ref } from "react";

import type { CursorStyle } from "../../types";
import type { TabStatus } from "../../lib/terminal/session-manager";
import FindBar from "./FindBar";
import XtermView, { type XtermViewHandle } from "./XtermView";

export interface TerminalPaneProps {
  fontFamily: string;
  fontSize: number;
  scrollback: number;
  cursorStyle: CursorStyle;
  cursorBlink: boolean;
  initialScrollback?: string;
  onInitialScrollbackReady?: () => void;
  onData: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  visible: boolean;
  status: TabStatus;
  exitCode?: number | null;
  errorMessage?: string;
  onRetry: () => void;
  onRestart: () => void;
  xtermRef: Ref<XtermViewHandle>;
  findOpen: boolean;
  findQuery: string;
  onFindQueryChange: (query: string) => void;
  onFindNext: () => void;
  onFindPrev: () => void;
  onFindClose: () => void;
}

export default function TerminalPane({
  fontFamily,
  fontSize,
  scrollback,
  cursorStyle,
  cursorBlink,
  initialScrollback,
  onInitialScrollbackReady,
  onData,
  onResize,
  visible,
  status,
  exitCode,
  errorMessage,
  onRetry,
  onRestart,
  xtermRef,
  findOpen,
  findQuery,
  onFindQueryChange,
  onFindNext,
  onFindPrev,
  onFindClose,
}: TerminalPaneProps) {
  const showError = status === "error";
  const showExited = status === "exited";

  return (
    <div className="terminal-pane" data-testid="terminal-pane">
      {showError && (
        <div className="terminal-banner terminal-banner--error" role="alert">
          <span className="terminal-banner__message">
            {errorMessage ?? "Failed to start session"}
          </span>
          <button
            type="button"
            className="terminal-banner__action"
            onClick={onRetry}
          >
            Retry
          </button>
        </div>
      )}
      {showExited && (
        <div className="terminal-banner" role="status">
          <span className="terminal-banner__message">
            Process exited ·{" "}
            {exitCode === null || exitCode === undefined
              ? "unknown"
              : `code ${exitCode}`}
          </span>
          <button
            type="button"
            className="terminal-banner__action"
            onClick={onRestart}
          >
            Restart
          </button>
        </div>
      )}
      <div className="terminal-pane__xterm">
        <XtermView
          ref={xtermRef}
          fontFamily={fontFamily}
          fontSize={fontSize}
          scrollback={scrollback}
          cursorStyle={cursorStyle}
          cursorBlink={cursorBlink}
          initialScrollback={initialScrollback}
          onInitialScrollbackReady={onInitialScrollbackReady}
          onData={onData}
          onResize={onResize}
          visible={visible}
        />
      </div>
      {findOpen && visible && (
        <FindBar
          query={findQuery}
          onQueryChange={onFindQueryChange}
          onNext={onFindNext}
          onPrev={onFindPrev}
          onClose={onFindClose}
        />
      )}
    </div>
  );
}
