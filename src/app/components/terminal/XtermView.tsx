import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { Terminal } from "@xterm/xterm";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

import { isE2eMode } from "../../lib/e2e-window";
import { readNordXtermTheme } from "../../lib/terminal/nord-xterm-theme";
import type { CursorStyle } from "../../types";

export interface XtermViewHandle {
  write: (data: string) => void;
  clear: () => void;
  fit: () => { cols: number; rows: number } | null;
  getSelection: () => string;
  getScrollbackText: () => string;
  focus: () => void;
  findNext: (term: string) => void;
  findPrevious: (term: string) => void;
}

export interface XtermViewProps {
  fontFamily: string;
  fontSize: number;
  scrollback: number;
  cursorStyle: CursorStyle;
  cursorBlink: boolean;
  initialScrollback?: string;
  /** Fires once after mount (and after any initialScrollback write completes). */
  onInitialScrollbackReady?: () => void;
  onData: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  visible: boolean;
}

/** Fallback delay when rAF is paused (hidden window) and cannot start init. */
const INIT_FALLBACK_MS = 80;

function normalizeCursorStyle(style: CursorStyle): CursorStyle {
  if (style === "block" || style === "underline" || style === "bar") {
    return style;
  }
  return "bar";
}

const XtermView = forwardRef<XtermViewHandle, XtermViewProps>(
  function XtermView(
    {
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
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const termRef = useRef<Terminal | null>(null);
    const fitRef = useRef<FitAddon | null>(null);
    const searchRef = useRef<SearchAddon | null>(null);
    const onDataRef = useRef(onData);
    const onResizeRef = useRef(onResize);
    const onReadyRef = useRef(onInitialScrollbackReady);
    /** Terminal instance the restore text was written into (StrictMode-safe). */
    const initialWrittenForRef = useRef<Terminal | null>(null);

    useEffect(() => {
      onDataRef.current = onData;
    }, [onData]);
    useEffect(() => {
      onResizeRef.current = onResize;
    }, [onResize]);
    useEffect(() => {
      onReadyRef.current = onInitialScrollbackReady;
    }, [onInitialScrollbackReady]);

    // Empty deps: every method reads through refs, and re-creating the handle
    // would re-run the parent's ref callback on each render.
    useImperativeHandle(
      ref,
      () => ({
        write(data: string) {
          termRef.current?.write(data);
        },
        clear() {
          termRef.current?.clear();
        },
        fit() {
          const term = termRef.current;
          const fit = fitRef.current;
          if (!term || !fit) return null;
          try {
            fit.fit();
          } catch {
            return null;
          }
          return { cols: term.cols, rows: term.rows };
        },
        getSelection() {
          return termRef.current?.getSelection() ?? "";
        },
        getScrollbackText() {
          const term = termRef.current;
          if (!term) return "";
          const buffer = term.buffer.active;
          const lines: string[] = [];
          for (let i = 0; i < buffer.length; i += 1) {
            const line = buffer.getLine(i);
            if (!line) continue;
            lines.push(line.translateToString(true));
          }
          return lines.join("\n").replace(/\s+$/u, "");
        },
        focus() {
          termRef.current?.focus();
        },
        findNext(term: string) {
          if (!term) return;
          searchRef.current?.findNext(term);
        },
        findPrevious(term: string) {
          if (!term) return;
          searchRef.current?.findPrevious(term);
        },
      }),
      [],
    );

    useEffect(() => {
      const host = containerRef.current;
      if (!host) return;

      const term = new Terminal({
        convertEol: true,
        cursorBlink,
        cursorStyle: normalizeCursorStyle(cursorStyle),
        fontFamily,
        fontSize,
        scrollback,
        theme: readNordXtermTheme(),
        allowTransparency: true,
        allowProposedApi: true,
      });
      const fit = new FitAddon();
      const search = new SearchAddon();
      term.loadAddon(fit);
      term.loadAddon(search);
      term.open(host);

      termRef.current = term;
      fitRef.current = fit;
      searchRef.current = search;

      const dataDisposable = term.onData((data) => {
        onDataRef.current(data);
      });

      const resizeDisposable = term.onResize(({ cols, rows }) => {
        onResizeRef.current(cols, rows);
      });

      let disposed = false;
      let initStarted = false;
      const init = () => {
        if (disposed || initStarted) return;
        initStarted = true;
        try {
          fit.fit();
        } catch {
          // Container may not be measurable yet.
        }
        const notifyReady = () => {
          if (disposed) return;
          onReadyRef.current?.();
        };
        // Keyed on the instance: a StrictMode remount gets a fresh, empty
        // Terminal and must replay history into it again.
        if (initialWrittenForRef.current !== term && initialScrollback) {
          initialWrittenForRef.current = term;
          term.write(`${initialScrollback}\r\n`, () => {
            notifyReady();
          });
        } else {
          notifyReady();
        }
      };
      // The window starts hidden while the splash runs, and a hidden WebView2
      // never fires rAF — so a timer has to be able to win the race.
      const initFrame = requestAnimationFrame(init);
      const initTimer = setTimeout(init, INIT_FALLBACK_MS);

      const observer = new ResizeObserver(() => {
        try {
          fit.fit();
        } catch {
          // Ignore fit races while hidden or unmounted.
        }
      });
      observer.observe(host);

      const themeObserver = new MutationObserver(() => {
        term.options.theme = readNordXtermTheme();
      });
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme", "style", "class"],
      });

      return () => {
        disposed = true;
        cancelAnimationFrame(initFrame);
        clearTimeout(initTimer);
        dataDisposable.dispose();
        resizeDisposable.dispose();
        observer.disconnect();
        themeObserver.disconnect();
        term.dispose();
        termRef.current = null;
        fitRef.current = null;
        searchRef.current = null;
      };
      // Mount once; options re-applied below.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      const term = termRef.current;
      if (!term) return;
      term.options.fontFamily = fontFamily;
      term.options.fontSize = fontSize;
      term.options.scrollback = scrollback;
      term.options.cursorStyle = normalizeCursorStyle(cursorStyle);
      term.options.cursorBlink = cursorBlink;
      try {
        fitRef.current?.fit();
      } catch {
        // Ignore.
      }
    }, [fontFamily, fontSize, scrollback, cursorStyle, cursorBlink]);

    useEffect(() => {
      if (!visible) return;
      const frame = requestAnimationFrame(() => {
        try {
          fitRef.current?.fit();
        } catch {
          // Ignore.
        }
        termRef.current?.focus();
      });
      return () => cancelAnimationFrame(frame);
    }, [visible]);

    return (
      <div
        className="terminal-xterm-host"
        data-testid="terminal-xterm"
        aria-hidden={!visible}
      >
        {/* xterm paints to canvas; expose restore text for Vite e2e asserts. */}
        {isE2eMode() && initialScrollback ? (
          <span className="terminal-e2e-scrollback" data-testid="e2e-scrollback">
            {initialScrollback}
          </span>
        ) : null}
        <div ref={containerRef} className="terminal-xterm" />
      </div>
    );
  },
);

export default XtermView;
