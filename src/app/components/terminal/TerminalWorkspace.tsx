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
import { saveAppStore } from "../../lib/app-store";
import { isE2eMode } from "../../lib/e2e-window";
import {
  createTabState,
  ensureActiveTab,
  type TabState,
} from "../../lib/terminal/session-manager";
import {
  pinPersistSignature,
  resolvePinnedScrollback,
  sanitizePinnedScrollback,
  shouldPersistPins,
  toPinnedRecords,
} from "../../lib/terminal/pinned-tabs";
import { listenForQuitRequest } from "../../lib/quit-flush";
import { getWindow } from "../../lib/window";
import type {
  ContextMenuPosition,
  CursorStyle,
  ParticleEffect,
  TerminalProfile,
} from "../../types";
import TabContextMenu from "../../pages/content-menus/tab-context-menu";
import SidePanel from "./SidePanel";
import StatusBar from "./StatusBar";
import TabBar from "./TabBar";
import TerminalPane from "./TerminalPane";
import type { OpenInTerminalApi } from "./explorer/FilesExplorer";
import TerminalParticleField from "./TerminalParticleField";
import type { XtermViewHandle } from "./XtermView";

const DEFAULT_PANEL_WIDTH = 260;
const PIN_SNAPSHOT_INTERVAL_MS = 5000;
/** Safety net so a tab never stays shell-less if restore never reports ready. */
const RESTORE_PTY_TIMEOUT_MS = 1500;

interface TabMenuState extends ContextMenuPosition {
  tabId: string;
}

/** Imperative API for App.tsx local shortcuts (Track D). */
export interface TerminalWorkspaceHandle {
  /** Optional cwd spawns the new shell in that directory (no typed `cd`). */
  newTab: (cwd?: string) => void;
  closeActiveTab: () => void;
  togglePinActive: () => void;
  openFind: () => void;
  clearActive: () => void;
  hasSelection: () => boolean;
  copySelection: () => Promise<void>;
  isFocused: () => boolean;
  sendKeys: (data: string) => void;
  pasteClipboard: () => Promise<void>;
  /** Active tab exists (hydrated) and can host a shell. */
  hasReadyTab: () => boolean;
  /**
   * Respawn the active tab's shell with `cwd` as the process working directory.
   * Returns false if there is no active tab.
   */
  cdActive: (path: string) => boolean;
}

export interface TerminalWorkspaceProps {
  openInTerminal?: OpenInTerminalApi;
}

interface TerminalSettingsSlice {
  fontFamily: string;
  fontSize: number;
  scrollbackLines: number;
  cursorStyle: CursorStyle;
  cursorBlink: boolean;
  particleEffect: ParticleEffect;
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
  onScrollbackReady: (tabId: string) => void;
  onSize?: (cols: number, rows: number) => void;
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
  onScrollbackReady,
  onSize,
}: TabHostProps) {
  const localXtermRef = useRef<XtermViewHandle | null>(null);
  const [size, setSize] = useState({ cols: 80, rows: 24 });
  // Restored tabs replay history into xterm first: a shell that clears the
  // screen on startup would otherwise wipe the text mid-write.
  const [restoreDone, setRestoreDone] = useState(!tab.initialScrollback);

  useEffect(() => {
    if (!tab.initialScrollback) {
      setRestoreDone(true);
      return;
    }
    setRestoreDone(false);
    const timer = setTimeout(() => {
      setRestoreDone(true);
    }, RESTORE_PTY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [tab.initialScrollback, tab.spawnKey]);

  const pty = usePtySession({
    enabled: restoreDone,
    profileId: tab.profileId,
    cwd: tab.cwd,
    spawnKey: tab.spawnKey ?? 0,
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

  useEffect(() => {
    if (active) {
      onSize?.(size.cols, size.rows);
    }
  }, [active, onSize, size.cols, size.rows]);

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
      if (active) {
        onSize?.(cols, rows);
      }
    },
    [active, onSize, pty],
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

  const handleScrollbackReady = useCallback(() => {
    setRestoreDone(true);
    onScrollbackReady(tab.tabId);
  }, [onScrollbackReady, tab.tabId]);

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
        onInitialScrollbackReady={handleScrollbackReady}
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

const TerminalWorkspace = forwardRef<
  TerminalWorkspaceHandle,
  TerminalWorkspaceProps
>(function TerminalWorkspace({ openInTerminal }, ref) {
    const { loadPinnedTabs, savePinnedTabs } = usePinnedTabs();
    const terminalSettings = useTerminalSettings();
    const settings: TerminalSettingsSlice = useMemo(
      () => ({
        fontFamily: terminalSettings.fontFamily,
        fontSize: terminalSettings.fontSize,
        scrollbackLines: terminalSettings.scrollbackLines,
        cursorStyle: terminalSettings.cursorStyle,
        cursorBlink: terminalSettings.cursorBlink,
        particleEffect: terminalSettings.particleEffect,
        defaultProfile: terminalSettings.defaultProfile,
        profiles: terminalSettings.profiles,
      }),
      [terminalSettings],
    );
    const particlesActive = !isE2eMode();
    const [tabs, setTabs] = useState<TabState[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [ready, setReady] = useState(false);
    const [findOpen, setFindOpen] = useState(false);
    const [findQuery, setFindQuery] = useState("");
    const [tabMenu, setTabMenu] = useState<TabMenuState | null>(null);
    const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
    const [panelOpen, setPanelOpen] = useState(true);
    const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
    const [terminalSize, setTerminalSize] = useState({ cols: 80, rows: 24 });

    const xtermHandles = useRef(new Map<string, XtermViewHandle>());
    const writeFns = useRef(new Map<string, (data: string) => void>());
    const lastScrollbacksRef = useRef(new Map<string, string>());
    const scrollbackReadyRef = useRef(new Set<string>());
    const lastPinSigRef = useRef<string | null>(null);
    /**
     * Authoritative persist gate. Stays false until `loadPinnedTabs` resolved
     * and its tabs were applied, so a StrictMode mount/cleanup cycle cannot
     * flush an empty `tabsRef` over good AppData.
     */
    const hydratedRef = useRef(false);
    const tabsRef = useRef(tabs);
    const activeTabIdRef = useRef(activeTabId);
    const settingsRef = useRef(settings);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [scrollbackReadyTick, setScrollbackReadyTick] = useState(0);

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
          const restored = pins.tabs.map((pin) => {
            if (pin.scrollback) {
              lastScrollbacksRef.current.set(pin.tabId, pin.scrollback);
            }
            return createTabState({
              tabId: pin.tabId,
              profileId: pin.profileId,
              title: pin.title || profileTitle(pin.profileId, slice.profiles),
              pinned: true,
              initialScrollback: pin.scrollback || undefined,
            });
          });
          const activePin =
            pins.tabs.find((p) => p.wasActive)?.tabId ??
            restored[0]?.tabId ??
            null;
          setTabs(restored);
          setActiveTabId(activePin);
          // Seed the refs now: a flush can fire before the state-sync effects
          // run, and it must never see the pre-hydration empty list.
          tabsRef.current = restored;
          activeTabIdRef.current = activePin;
        } else {
          const tab = createTabState({
            profileId: slice.defaultProfile,
            title: profileTitle(slice.defaultProfile, slice.profiles),
          });
          setTabs([tab]);
          setActiveTabId(tab.tabId);
          tabsRef.current = [tab];
          activeTabIdRef.current = tab.tabId;
        }
        hydratedRef.current = true;
        setReady(true);
      })();

      return () => {
        cancelled = true;
      };
    }, [loadPinnedTabs]);

    const persistPins = useCallback(async () => {
      if (!hydratedRef.current) {
        // Pre-hydration write (StrictMode cleanup, early unload): the live
        // list is not authoritative yet and would wipe stored pins.
        return;
      }
      const current = tabsRef.current;
      const active = activeTabIdRef.current;
      const scrollbackLimit = settingsRef.current.scrollbackLines;
      const scrollbacks = new Map<string, string>();
      for (const t of current) {
        if (!t.pinned) continue;
        const live =
          xtermHandles.current.get(t.tabId)?.getScrollbackText() ?? "";
        const text = resolvePinnedScrollback({
          live,
          lastKnown: lastScrollbacksRef.current.get(t.tabId),
          initial: t.initialScrollback,
        });
        if (live.length > 0) {
          lastScrollbacksRef.current.set(
            t.tabId,
            sanitizePinnedScrollback(live),
          );
        }
        scrollbacks.set(t.tabId, text);
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
      // Clearing the store is only intentional when we know the live tabs and
      // none of them are pinned — never when the tab list itself is empty.
      await savePinnedTabs(state, { allowEmpty: current.length > 0 });
    }, [savePinnedTabs]);

    const schedulePersist = useCallback(() => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        void persistPins();
      }, 300);
    }, [persistPins]);

    const canPersist = useCallback((tabList: TabState[]) => {
      return shouldPersistPins({
        hydrated: hydratedRef.current,
        tabs: tabList,
        readyIds: scrollbackReadyRef.current,
        handleIds: new Set(xtermHandles.current.keys()),
      });
    }, []);

    useEffect(() => {
      if (!ready) return;
      if (!canPersist(tabs)) {
        return;
      }
      const sig = pinPersistSignature(tabs, activeTabId);
      if (sig === lastPinSigRef.current) {
        return;
      }
      lastPinSigRef.current = sig;
      schedulePersist();
    }, [
      tabs,
      activeTabId,
      ready,
      schedulePersist,
      scrollbackReadyTick,
      canPersist,
    ]);

    useEffect(() => {
      if (!ready) return;
      const timer = setInterval(() => {
        if (!canPersist(tabsRef.current)) {
          return;
        }
        if (!tabsRef.current.some((t) => t.pinned)) return;
        void persistPins();
      }, PIN_SNAPSHOT_INTERVAL_MS);
      return () => clearInterval(timer);
    }, [ready, persistPins, canPersist]);

    useEffect(() => {
      const flush = () => {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        if (!hydratedRef.current) return;
        void persistPins();
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

    /** Flush every persisted surface and wait for it to hit disk. */
    const flushAll = useCallback(async () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      try {
        await persistPins();
        await saveAppStore();
      } catch (error) {
        console.warn("Failed to flush pinned tabs", error);
      }
    }, [persistPins]);

    useEffect(() => {
      let cancelled = false;
      let unlisten: (() => void) | undefined;

      void listenForQuitRequest(flushAll)
        .then((fn) => {
          if (cancelled) {
            fn();
            return;
          }
          unlisten = fn;
        })
        .catch((error: unknown) => {
          console.warn("Failed to listen for quit request", error);
        });

      return () => {
        cancelled = true;
        unlisten?.();
      };
    }, [flushAll]);

    useEffect(() => {
      const win = getWindow();
      if (!win) return;

      let cancelled = false;
      let closing = false;
      let unlisten: (() => void) | undefined;

      void win
        .onCloseRequested(async (event) => {
          // Second pass: our own close() below — let it through.
          if (closing) return;
          closing = true;
          // Hold the close so Tauri cannot race the flush promise.
          event.preventDefault();
          await flushAll();
          try {
            await win.close();
          } catch (error) {
            console.warn("Failed to close window after flush", error);
          }
        })
        .then((fn) => {
          if (cancelled) {
            fn();
            return;
          }
          unlisten = fn;
        })
        .catch((error: unknown) => {
          console.warn("Failed to listen for close requested", error);
        });

      return () => {
        cancelled = true;
        unlisten?.();
      };
    }, [flushAll]);

    const handleSelect = useCallback((tabId: string) => {
      setActiveTabId(tabId);
      setFindOpen(false);
    }, []);

    const handleAdd = useCallback((cwd?: string) => {
      const slice = settingsRef.current;
      const tab = createTabState({
        profileId: slice.defaultProfile,
        title: profileTitle(slice.defaultProfile, slice.profiles),
        cwd: cwd?.trim() || null,
        spawnKey: cwd?.trim() ? 1 : 0,
      });
      setTabs((prev) => [...prev, tab]);
      setActiveTabId(tab.tabId);
    }, []);

    const handleClose = useCallback((tabId: string) => {
      setTabMenu((menu) => (menu?.tabId === tabId ? null : menu));
      setRenamingTabId((current) => (current === tabId ? null : current));
      setTabs((prev) => {
        const next = prev.filter((t) => t.tabId !== tabId);
        xtermHandles.current.delete(tabId);
        writeFns.current.delete(tabId);
        lastScrollbacksRef.current.delete(tabId);
        scrollbackReadyRef.current.delete(tabId);
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

    const handleCloseAllUnpinned = useCallback(() => {
      setTabMenu(null);
      setTabs((prev) => {
        const closing = prev.filter((t) => !t.pinned);
        if (closing.length === 0) return prev;

        for (const tab of closing) {
          xtermHandles.current.delete(tab.tabId);
          writeFns.current.delete(tab.tabId);
          lastScrollbacksRef.current.delete(tab.tabId);
          scrollbackReadyRef.current.delete(tab.tabId);
        }

        const closedIds = new Set(closing.map((t) => t.tabId));
        setRenamingTabId((current) =>
          current && closedIds.has(current) ? null : current,
        );

        const next = prev.filter((t) => t.pinned);
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
          current && closedIds.has(current)
            ? (next[0]?.tabId ?? null)
            : current,
        );
        return next;
      });
    }, []);

    const handleTogglePin = useCallback((tabId: string) => {
      setTabs((prev) =>
        prev.map((t) => {
          if (t.tabId !== tabId) return t;
          const pinned = !t.pinned;
          if (!pinned) {
            lastScrollbacksRef.current.delete(tabId);
          } else {
            const live = xtermHandles.current.get(tabId)?.getScrollbackText();
            if (live) {
              lastScrollbacksRef.current.set(
                tabId,
                sanitizePinnedScrollback(live),
              );
            }
          }
          return { ...t, pinned };
        }),
      );
    }, []);

    const closeTabMenu = useCallback(() => {
      setTabMenu(null);
    }, []);

    const handleTabContextMenu = useCallback(
      (tabId: string, x: number, y: number) => {
        setTabMenu({ tabId, x, y });
      },
      [],
    );

    const handleStartRename = useCallback((tabId: string) => {
      setActiveTabId(tabId);
      setFindOpen(false);
      setRenamingTabId(tabId);
    }, []);

    const handleRenameCancel = useCallback(() => {
      setRenamingTabId(null);
    }, []);

    const handleRenameCommit = useCallback((tabId: string, title: string) => {
      const next = title.trim();
      setTabs((prev) =>
        prev.map((t) => {
          if (t.tabId !== tabId) return t;
          if (next.length === 0 || next === t.title) return t;
          return { ...t, title: next };
        }),
      );
      setRenamingTabId(null);
    }, []);

    useEffect(() => {
      if (!tabMenu) return;

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          closeTabMenu();
        }
      };
      const onPointerDown = (event: PointerEvent) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          closeTabMenu();
          return;
        }
        if (target.closest(".tab-context-menu")) return;
        closeTabMenu();
      };

      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("pointerdown", onPointerDown, true);
      return () => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("pointerdown", onPointerDown, true);
      };
    }, [tabMenu, closeTabMenu]);

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
          // Idempotent: re-registering the same handle must not re-render, or
          // a ref re-attach turns into an update loop.
          if (xtermHandles.current.get(tabId) === handle) return;
          xtermHandles.current.set(tabId, handle);
          setScrollbackReadyTick((n) => n + 1);
        } else {
          xtermHandles.current.delete(tabId);
        }
      },
      [],
    );

    const registerScrollbackReady = useCallback((tabId: string) => {
      if (scrollbackReadyRef.current.has(tabId)) return;
      scrollbackReadyRef.current.add(tabId);
      setScrollbackReadyTick((n) => n + 1);
    }, []);

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

    const handleTerminalSize = useCallback((cols: number, rows: number) => {
      setTerminalSize((prev) =>
        prev.cols === cols && prev.rows === rows ? prev : { cols, rows },
      );
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        newTab: (cwd?: string) => handleAdd(cwd),
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
        hasReadyTab: () => {
          const id = activeTabIdRef.current;
          if (!id) return false;
          return tabsRef.current.some((t) => t.tabId === id);
        },
        cdActive: (path: string) => {
          const id = activeTabIdRef.current;
          if (!id) return false;
          const trimmed = path.trim();
          if (!trimmed) return false;
          if (!tabsRef.current.some((t) => t.tabId === id)) return false;

          xtermHandles.current.get(id)?.clear();
          setTabs((prev) =>
            prev.map((t) =>
              t.tabId === id
                ? {
                    ...t,
                    cwd: trimmed,
                    spawnKey: (t.spawnKey ?? 0) + 1,
                    status: "running" as const,
                    exitCode: null,
                    errorMessage: undefined,
                    sessionId: null,
                    // Do not replay old scrollback into the new cwd shell.
                    initialScrollback: undefined,
                  }
                : t,
            ),
          );
          return true;
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
          renaming: t.tabId === renamingTabId,
        })),
      [tabs, resolvedActiveId, renamingTabId],
    );

    const menuTab = tabMenu
      ? tabs.find((t) => t.tabId === tabMenu.tabId)
      : undefined;

    const activeTab = tabs.find((t) => t.tabId === resolvedActiveId);
    const shellName = activeTab
      ? profileTitle(activeTab.profileId, settings.profiles)
      : settings.defaultProfile;

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
        <div className="terminal-workspace__main">
          <SidePanel
            open={panelOpen}
            width={panelWidth}
            onResize={setPanelWidth}
            openInTerminal={openInTerminal}
          />
          <div className="terminal-workspace__center">
            <TabBar
              tabs={tabBarTabs}
              onSelect={handleSelect}
              onAdd={() => handleAdd()}
              onContextMenu={handleTabContextMenu}
              onRenameCommit={handleRenameCommit}
              onRenameCancel={handleRenameCancel}
            />
            <div className="terminal-workspace__body">
              <TerminalParticleField
                className="terminal-workspace__particles"
                mode={settings.particleEffect}
                active={particlesActive}
              />
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
                    onScrollbackReady={registerScrollbackReady}
                    onSize={
                      tab.tabId === resolvedActiveId
                        ? handleTerminalSize
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        <StatusBar
          panelOpen={panelOpen}
          onTogglePanel={() => setPanelOpen((v) => !v)}
          shellName={shellName}
          cols={terminalSize.cols}
          rows={terminalSize.rows}
        />
        {tabMenu && menuTab && (
          <TabContextMenu
            x={tabMenu.x}
            y={tabMenu.y}
            pinned={menuTab.pinned}
            canCloseAll={tabs.some((t) => !t.pinned)}
            onClose={closeTabMenu}
            onRename={() => handleStartRename(tabMenu.tabId)}
            onTogglePin={() => handleTogglePin(tabMenu.tabId)}
            onCloseTab={() => handleClose(tabMenu.tabId)}
            onCloseAllTabs={handleCloseAllUnpinned}
          />
        )}
      </div>
    );
  },
);

export default TerminalWorkspace;
