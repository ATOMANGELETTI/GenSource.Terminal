import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import { usePinnedTabs } from "../../hooks/usePinnedTabs";
import { usePtySession } from "../../hooks/usePtySession";
import { useTerminalSettings } from "../../hooks/useTerminalSettings";
import {
  createTabState,
  ensureActiveTab,
  type TabState,
} from "../../lib/terminal/session-manager";
import { toPinnedRecords } from "../../lib/terminal/pinned-tabs";
import type { CursorStyle, TerminalProfile } from "../../types";
import TabBar from "./TabBar";
import TerminalPane from "./TerminalPane";
import type { XtermViewHandle } from "./XtermView";

/** Imperative API for App.tsx local shortcuts (Track D). */
export interface TerminalWorkspaceHandle {
  newTab: () => void;
  closeActiveTab: () => void;
  togglePinActive: () => void;
  openFind: () => void;
  clearActive: () => void;
  hasSelection: () => boolean;
  copySelection: () => Promise<void>;
  isFocused: () => boolean;
  sendKeys: (data: string) => void;
  pasteClipboard: () => Promise<void>;
}

interface TerminalSettingsSlice {
  fontFamily: string;
  fontSize: number;
  scrollbackLines: number;
  cursorStyle: CursorStyle;
  cursorBlink: boolean;
  defaultProfile: string;
  profiles: TerminalProfile[];
}

function profileTitle(profileId: string, profiles: TerminalProfile[]): string {
  return profiles.find((p) => p.id === profileId)?.name ?? profileId;
}

interface TabHostProps {
  tab: TabState;
  active: boolean;
  settings: TerminalSettingsSlice;
  findOpen: boolean;
  findQuery: string;
  onFindQueryChange: (query: string) => void;
  onFindClose: () => void;
  onSessionId: (tabId: string, sessionId: string | null) => void;
  onStatus: (
    tabId: string,
    patch: Partial<
      Pick<TabState, "status" | "exitCode" | "errorMessage" | "sessionId">
    >,
  ) => void;
  xtermRef: (tabId: string, handle: XtermViewHandle | null) => void;
  writeRef: (tabId: string, write: ((data: string) => void) | null) => void;
}

function TerminalTabHost({
  tab,
  active,
  settings,
  findOpen,
  findQuery,
  onFindQueryChange,
  onFindClose,
  onSessionId,
  onStatus,
  xtermRef,
  writeRef,
}: TabHostProps) {
  const localXtermRef = useRef<XtermViewHandle | null>(null);
  const [size, setSize] = useState({ cols: 80, rows: 24 });

  const pty = usePtySession({
    enabled: true,
    profileId: tab.profileId,
    cols: size.cols,
    rows: size.rows,
    onOutput: (_sessionId, data) => {
      localXtermRef.current?.write(data);
    },
    onExit: (_sessionId, code) => {
      onStatus(tab.tabId, {
        status: "exited",
        exitCode: code,
        sessionId: null,
      });
    },
    onError: (message) => {
      onStatus(tab.tabId, {
        status: "error",
        errorMessage: message,
        sessionId: null,
      });
    },
  });

  useEffect(() => {
    onSessionId(tab.tabId, pty.sessionId);
  }, [onSessionId, pty.sessionId, tab.tabId]);

  useEffect(() => {
    writeRef(tab.tabId, pty.write);
    return () => writeRef(tab.tabId, null);
  }, [pty.write, tab.tabId, writeRef]);

  const setXterm = useCallback(
    (handle: XtermViewHandle | null) => {
      localXtermRef.current = handle;
      xtermRef(tab.tabId, handle);
    },
    [tab.tabId, xtermRef],
  );

  const handleData = useCallback(
    (data: string) => {
      if (tab.status === "running") {
        pty.write(data);
      }
    },
    [pty, tab.status],
  );

  const handleResize = useCallback(
    (cols: number, rows: number) => {
      setSize({ cols, rows });
      pty.resize(cols, rows);
    },
    [pty],
  );

  const handleRetry = useCallback(() => {
    onStatus(tab.tabId, {
      status: "running",
      errorMessage: undefined,
      exitCode: null,
    });
    void pty.recreate();
  }, [onStatus, pty, tab.tabId]);

  const handleRestart = useCallback(() => {
    onStatus(tab.tabId, {
      status: "running",
      errorMessage: undefined,
      exitCode: null,
    });
    void pty.recreate();
  }, [onStatus, pty, tab.tabId]);

  const handleFindNext = useCallback(() => {
    localXtermRef.current?.findNext(findQuery);
  }, [findQuery]);

  const handleFindPrev = useCallback(() => {
    localXtermRef.current?.findPrevious(findQuery);
  }, [findQuery]);

  return (
    <div
      className="terminal-workspace__pane-slot"
      aria-hidden={!active}
      data-tab-id={tab.tabId}
    >
      <TerminalPane
        fontFamily={settings.fontFamily}
        fontSize={settings.fontSize}
        scrollback={settings.scrollbackLines}
        cursorStyle={settings.cursorStyle}
        cursorBlink={settings.cursorBlink}
        initialScrollback={tab.initialScrollback}
        onData={handleData}
        onResize={handleResize}
        visible={active}
        status={tab.status}
        exitCode={tab.exitCode}
        errorMessage={tab.errorMessage}
        onRetry={handleRetry}
        onRestart={handleRestart}
        xtermRef={setXterm}
        findOpen={findOpen && active}
        findQuery={findQuery}
        onFindQueryChange={onFindQueryChange}
        onFindNext={handleFindNext}
        onFindPrev={handleFindPrev}
        onFindClose={onFindClose}
      />
    </div>
  );
}

const TerminalWorkspace = forwardRef<TerminalWorkspaceHandle>(
  function TerminalWorkspace(_props, ref) {
    const { loadPinnedTabs, savePinnedTabs } = usePinnedTabs();
    const terminalSettings = useTerminalSettings();
    const settings: TerminalSettingsSlice = useMemo(
      () => ({
        fontFamily: terminalSettings.fontFamily,
        fontSize: terminalSettings.fontSize,
        scrollbackLines: terminalSettings.scrollbackLines,
        cursorStyle: terminalSettings.cursorStyle,
        cursorBlink: terminalSettings.cursorBlink,
        defaultProfile: terminalSettings.defaultProfile,
        profiles: terminalSettings.profiles,
      }),
      [terminalSettings],
    );
    const [tabs, setTabs] = useState<TabState[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [ready, setReady] = useState(false);
    const [findOpen, setFindOpen] = useState(false);
    const [findQuery, setFindQuery] = useState("");

    const xtermHandles = useRef(new Map<string, XtermViewHandle>());
    const writeFns = useRef(new Map<string, (data: string) => void>());
    const tabsRef = useRef(tabs);
    const activeTabIdRef = useRef(activeTabId);
    const settingsRef = useRef(settings);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
      tabsRef.current = tabs;
    }, [tabs]);
    useEffect(() => {
      activeTabIdRef.current = activeTabId;
    }, [activeTabId]);
    useEffect(() => {
      settingsRef.current = settings;
    }, [settings]);

    const resolvedActiveId = ensureActiveTab(tabs, activeTabId);

    useEffect(() => {
      let cancelled = false;

      void (async () => {
        const pins = await loadPinnedTabs();
        if (cancelled) return;

        const slice = settingsRef.current;
        if (pins.tabs.length > 0) {
          const restored = pins.tabs.map((pin) =>
            createTabState({
              tabId: pin.tabId,
              profileId: pin.profileId,
              title: pin.title || profileTitle(pin.profileId, slice.profiles),
              pinned: true,
              initialScrollback: pin.scrollback || undefined,
            }),
          );
          const activePin =
            pins.tabs.find((p) => p.wasActive)?.tabId ??
            restored[0]?.tabId ??
            null;
          setTabs(restored);
          setActiveTabId(activePin);
        } else {
          const tab = createTabState({
            profileId: slice.defaultProfile,
            title: profileTitle(slice.defaultProfile, slice.profiles),
          });
          setTabs([tab]);
          setActiveTabId(tab.tabId);
        }
        setReady(true);
      })();

      return () => {
        cancelled = true;
      };
    }, [loadPinnedTabs]);

    const persistPins = useCallback(() => {
      const current = tabsRef.current;
      const active = activeTabIdRef.current;
      const scrollbackLimit = settingsRef.current.scrollbackLines;
      const scrollbacks = new Map<string, string>();
      for (const t of current) {
        if (!t.pinned) continue;
        scrollbacks.set(
          t.tabId,
          xtermHandles.current.get(t.tabId)?.getScrollbackText() ?? "",
        );
      }
      const state = toPinnedRecords(
        current,
        active,
        scrollbacks,
        scrollbackLimit,
      );
      // Prefer last pinned as active when none of the pinned tabs were active.
      if (
        state.tabs.length > 0 &&
        !state.tabs.some((t) => t.wasActive)
      ) {
        state.tabs[state.tabs.length - 1].wasActive = true;
      }
      void savePinnedTabs(state);
    }, [savePinnedTabs]);

    const schedulePersist = useCallback(() => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        persistPins();
      }, 300);
    }, [persistPins]);

    useEffect(() => {
      if (!ready) return;
      schedulePersist();
    }, [tabs, activeTabId, ready, schedulePersist]);

    useEffect(() => {
      const flush = () => {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        persistPins();
      };
      const onVisibility = () => {
        if (document.visibilityState === "hidden") {
          flush();
        }
      };
      window.addEventListener("beforeunload", flush);
      document.addEventListener("visibilitychange", onVisibility);
      return () => {
        window.removeEventListener("beforeunload", flush);
        document.removeEventListener("visibilitychange", onVisibility);
        flush();
      };
    }, [persistPins]);

    const handleSelect = useCallback((tabId: string) => {
      setActiveTabId(tabId);
      setFindOpen(false);
    }, []);

    const handleAdd = useCallback(() => {
      const slice = settingsRef.current;
      const tab = createTabState({
        profileId: slice.defaultProfile,
        title: profileTitle(slice.defaultProfile, slice.profiles),
      });
      setTabs((prev) => [...prev, tab]);
      setActiveTabId(tab.tabId);
    }, []);

    const handleClose = useCallback((tabId: string) => {
      setTabs((prev) => {
        const next = prev.filter((t) => t.tabId !== tabId);
        xtermHandles.current.delete(tabId);
        writeFns.current.delete(tabId);
        if (next.length === 0) {
          const slice = settingsRef.current;
          const replacement = createTabState({
            profileId: slice.defaultProfile,
            title: profileTitle(slice.defaultProfile, slice.profiles),
          });
          setActiveTabId(replacement.tabId);
          return [replacement];
        }
        setActiveTabId((current) =>
          current === tabId ? (next[0]?.tabId ?? null) : current,
        );
        return next;
      });
    }, []);

    const handleTogglePin = useCallback((tabId: string) => {
      setTabs((prev) =>
        prev.map((t) =>
          t.tabId === tabId ? { ...t, pinned: !t.pinned } : t,
        ),
      );
    }, []);

    const handleSessionId = useCallback(
      (tabId: string, sessionId: string | null) => {
        setTabs((prev) =>
          prev.map((t) =>
            t.tabId === tabId && t.sessionId !== sessionId
              ? { ...t, sessionId }
              : t,
          ),
        );
      },
      [],
    );

    const handleStatus = useCallback(
      (
        tabId: string,
        patch: Partial<
          Pick<TabState, "status" | "exitCode" | "errorMessage" | "sessionId">
        >,
      ) => {
        setTabs((prev) =>
          prev.map((t) => (t.tabId === tabId ? { ...t, ...patch } : t)),
        );
      },
      [],
    );

    const registerXterm = useCallback(
      (tabId: string, handle: XtermViewHandle | null) => {
        if (handle) {
          xtermHandles.current.set(tabId, handle);
        } else {
          xtermHandles.current.delete(tabId);
        }
      },
      [],
    );

    const registerWrite = useCallback(
      (tabId: string, write: ((data: string) => void) | null) => {
        if (write) {
          writeFns.current.set(tabId, write);
        } else {
          writeFns.current.delete(tabId);
        }
      },
      [],
    );

    useImperativeHandle(
      ref,
      () => ({
        newTab: () => handleAdd(),
        closeActiveTab: () => {
          const id = activeTabIdRef.current;
          if (id) handleClose(id);
        },
        togglePinActive: () => {
          const id = activeTabIdRef.current;
          if (id) handleTogglePin(id);
        },
        openFind: () => setFindOpen(true),
        clearActive: () => {
          const id = activeTabIdRef.current;
          if (!id) return;
          xtermHandles.current.get(id)?.clear();
        },
        hasSelection: () => {
          const id = activeTabIdRef.current;
          if (!id) return false;
          return Boolean(xtermHandles.current.get(id)?.getSelection());
        },
        copySelection: async () => {
          const id = activeTabIdRef.current;
          if (!id) return;
          const text = xtermHandles.current.get(id)?.getSelection() ?? "";
          if (!text) return;
          try {
            await navigator.clipboard.writeText(text);
          } catch (error) {
            console.warn("clipboard write failed", error);
          }
        },
        isFocused: () => {
          const id = activeTabIdRef.current;
          if (!id) return false;
          const el = document.querySelector(
            `[data-tab-id="${CSS.escape(id)}"] [data-testid="terminal-xterm"]`,
          );
          return Boolean(el && el.contains(document.activeElement));
        },
        sendKeys: (data: string) => {
          const id = activeTabIdRef.current;
          if (!id) return;
          writeFns.current.get(id)?.(data);
        },
        pasteClipboard: async () => {
          const id = activeTabIdRef.current;
          if (!id) return;
          try {
            const text = await navigator.clipboard.readText();
            if (!text) return;
            writeFns.current.get(id)?.(text);
          } catch (error) {
            console.warn("clipboard read failed", error);
          }
        },
      }),
      [handleAdd, handleClose, handleTogglePin],
    );

    const tabBarTabs = useMemo(
      () =>
        tabs.map((t) => ({
          tabId: t.tabId,
          title: t.title,
          active: t.tabId === resolvedActiveId,
          pinned: t.pinned,
          status: t.status,
        })),
      [tabs, resolvedActiveId],
    );

    if (!ready) {
      return (
        <div
          className="terminal-workspace"
          data-testid="terminal-workspace"
          aria-busy="true"
        />
      );
    }

    return (
      <div className="terminal-workspace" data-testid="terminal-workspace">
        <TabBar
          tabs={tabBarTabs}
          onSelect={handleSelect}
          onClose={handleClose}
          onTogglePin={handleTogglePin}
          onAdd={handleAdd}
        />
        <div className="terminal-workspace__body">
          <div className="terminal-workspace__panes">
            {tabs.map((tab) => (
              <TerminalTabHost
                key={tab.tabId}
                tab={tab}
                active={tab.tabId === resolvedActiveId}
                settings={settings}
                findOpen={findOpen}
                findQuery={findQuery}
                onFindQueryChange={setFindQuery}
                onFindClose={() => setFindOpen(false)}
                onSessionId={handleSessionId}
                onStatus={handleStatus}
                xtermRef={registerXterm}
                writeRef={registerWrite}
              />
            ))}
          </div>
        </div>
      </div>
    );
  },
);

export default TerminalWorkspace;
