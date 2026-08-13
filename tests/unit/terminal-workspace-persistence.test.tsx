import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PinnedTabsState } from "@/types";

/**
 * Reproduces the pinned-tab wipe: React StrictMode mounts the workspace,
 * tears it down, and remounts it. The teardown flush used to run with an
 * empty tab list and overwrite AppData before the restore load resolved.
 */

const store = new Map<string, unknown>();
let loadGate: Promise<void> | null = null;

const getStoreValue = vi.fn(async (key: string) => {
  if (key === "terminal.pinnedTabs" && loadGate) {
    await loadGate;
  }
  return store.get(key);
});
const setStoreValue = vi.fn((key: string, value: unknown): Promise<void> => {
  store.set(key, value);
  return Promise.resolve();
});

vi.mock("@/lib/app-store", () => ({
  getStoreValue: (key: string) => getStoreValue(key),
  setStoreValue: (key: string, value: unknown) => setStoreValue(key, value),
  saveAppStore: () => Promise.resolve(),
}));

vi.mock("@/lib/e2e-window", () => ({
  isE2eMode: () => false,
}));

vi.mock("@/lib/window", () => ({
  getWindow: () => null,
}));

vi.mock("@/lib/quit-flush", () => ({
  listenForQuitRequest: () => Promise.resolve(() => undefined),
}));

vi.mock("@/hooks/usePtySession", () => ({
  usePtySession: () => ({
    sessionId: null,
    write: () => undefined,
    resize: () => undefined,
    kill: () => Promise.resolve(),
    recreate: () => Promise.resolve(),
  }),
}));

vi.mock("@/hooks/useTerminalSettings", () => ({
  useTerminalSettings: () => ({
    fontFamily: "Terminus",
    fontSize: 14,
    scrollbackLines: 5000,
    cursorStyle: "bar",
    cursorBlink: true,
    particleEffect: "dust",
    defaultProfile: "powershell",
    profiles: [
      {
        id: "powershell",
        name: "PowerShell",
        command: "powershell.exe",
        args: [],
        startingDirectory: null,
      },
    ],
    settings: null,
  }),
}));

vi.mock("@/hooks/useFileIconSet", () => ({
  useFileIconSet: () => "catppuccin",
}));

// xterm needs a real canvas; stand in for the pane and report restore-ready.
vi.mock("@/components/terminal/TerminalPane", async () => {
  const React = await import("react");
  interface StubProps {
    initialScrollback?: string;
    onInitialScrollbackReady?: () => void;
    xtermRef: (handle: unknown) => void;
  }
  function TerminalPaneStub({
    initialScrollback,
    onInitialScrollbackReady,
    xtermRef,
  }: StubProps) {
    React.useEffect(() => {
      xtermRef({
        write: () => undefined,
        clear: () => undefined,
        fit: () => null,
        getSelection: () => "",
        getScrollbackText: () => initialScrollback ?? "",
        focus: () => undefined,
        findNext: () => undefined,
        findPrevious: () => undefined,
      });
      onInitialScrollbackReady?.();
      return () => xtermRef(null);
      // Mount-once stub, mirroring XtermView's single init effect.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return React.createElement("div", { "data-testid": "pane-stub" });
  }
  return { default: TerminalPaneStub };
});

function seed(...titles: string[]): PinnedTabsState {
  return {
    version: 1,
    tabs: titles.map((title, index) => ({
      tabId: `tab-${index}`,
      profileId: "powershell",
      title,
      scrollback: `history for ${title}`,
      wasActive: index === 0,
    })),
  };
}

function storedPins(): PinnedTabsState | undefined {
  return store.get("terminal.pinnedTabs") as PinnedTabsState | undefined;
}

async function importWorkspace() {
  const mod = await import("@/components/terminal/TerminalWorkspace");
  return mod.default;
}

describe("TerminalWorkspace pin persistence", () => {
  beforeEach(() => {
    // jsdom has no layout engine; TabBar scrolls the active tab into view.
    Element.prototype.scrollIntoView = () => undefined;
    vi.resetModules();
    store.clear();
    loadGate = null;
    getStoreValue.mockClear();
    setStoreValue.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("restores pinned tabs under StrictMode without wiping the store", async () => {
    store.set("terminal.pinnedTabs", seed("Build box", "Logs"));
    const TerminalWorkspace = await importWorkspace();

    render(
      <StrictMode>
        <TerminalWorkspace />
      </StrictMode>,
    );

    expect(await screen.findByText("Build box")).toBeInTheDocument();
    expect(screen.getByText("Logs")).toBeInTheDocument();

    await waitFor(() => {
      expect(storedPins()?.tabs).toHaveLength(2);
    });
    expect(storedPins()?.tabs.map((t) => t.title)).toEqual([
      "Build box",
      "Logs",
    ]);
    expect(storedPins()?.tabs[0]?.scrollback).toBe("history for Build box");
  });

  it("keeps stored pins when unmounted before hydration finishes", async () => {
    store.set("terminal.pinnedTabs", seed("Build box"));
    let releaseLoad!: () => void;
    loadGate = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });

    const TerminalWorkspace = await importWorkspace();
    const view = render(
      <StrictMode>
        <TerminalWorkspace />
      </StrictMode>,
    );

    // Teardown while `loadPinnedTabs` is still pending — the old flush path.
    view.unmount();
    releaseLoad();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(storedPins()?.tabs).toHaveLength(1);
    expect(setStoreValue).not.toHaveBeenCalled();
  });

  it("clears the store once the user unpins everything", async () => {
    store.set("terminal.pinnedTabs", seed("Build box"));
    const TerminalWorkspace = await importWorkspace();

    render(
      <StrictMode>
        <TerminalWorkspace />
      </StrictMode>,
    );
    expect(await screen.findByText("Build box")).toBeInTheDocument();

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByText("Build box"),
    });
    await user.click(await screen.findByRole("menuitem", { name: /unpin/i }));

    await waitFor(() => {
      expect(storedPins()?.tabs).toEqual([]);
    });
  });
});
