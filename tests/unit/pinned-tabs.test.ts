import { describe, expect, it } from "vitest";
import {
  areRestoredScrollbacksReady,
  normalizePinnedTabsState,
  pinPersistSignature,
  resolvePinnedScrollback,
  sanitizePinnedScrollback,
  shouldPersistPins,
  shouldWritePinnedState,
  truncateScrollback,
  toPinnedRecords,
  PINNED_TABS_KEY,
} from "@/lib/terminal/pinned-tabs";
import type { TabState } from "@/lib/terminal/session-manager";
import type { PinnedTabsState } from "@/types";

describe("pinned-tabs", () => {
  it("exposes store key", () => {
    expect(PINNED_TABS_KEY).toBe("terminal.pinnedTabs");
  });

  it("truncates scrollback to last N lines", () => {
    const text = ["a", "b", "c", "d", "e"].join("\n");
    expect(truncateScrollback(text, 3)).toBe("c\nd\ne");
  });

  it("serializes only pinned tabs and at most one wasActive", () => {
    const tabs: TabState[] = [
      {
        tabId: "1",
        sessionId: "s1",
        profileId: "powershell",
        title: "PowerShell",
        pinned: true,
        status: "running",
      },
      {
        tabId: "2",
        sessionId: "s2",
        profileId: "cmd",
        title: "CMD",
        pinned: false,
        status: "running",
      },
      {
        tabId: "3",
        sessionId: "s3",
        profileId: "powershell",
        title: "PowerShell",
        pinned: true,
        status: "running",
      },
    ];
    const scrollbacks = new Map([
      ["1", "one"],
      ["3", "three"],
    ]);
    const state = toPinnedRecords(tabs, "3", scrollbacks, 5000);
    expect(state.version).toBe(1);
    expect(state.tabs).toHaveLength(2);
    expect(state.tabs.map((t) => t.tabId)).toEqual(["1", "3"]);
    expect(state.tabs.filter((t) => t.wasActive)).toHaveLength(1);
    expect(state.tabs.find((t) => t.tabId === "3")?.wasActive).toBe(true);
  });

  it("persists custom renamed titles for pinned tabs", () => {
    const tabs: TabState[] = [
      {
        tabId: "1",
        sessionId: "s1",
        profileId: "powershell",
        title: "Build box",
        pinned: true,
        status: "running",
      },
      {
        tabId: "2",
        sessionId: "s2",
        profileId: "cmd",
        title: "Scratch",
        pinned: false,
        status: "running",
      },
    ];
    const state = toPinnedRecords(tabs, "1", new Map([["1", "hi"]]), 100);
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0]?.title).toBe("Build box");
  });

  it("treats corrupt payload as empty", () => {
    expect(normalizePinnedTabsState(null).tabs).toEqual([]);
    expect(normalizePinnedTabsState({ version: 99, tabs: [] }).tabs).toEqual(
      [],
    );
    expect(normalizePinnedTabsState({ version: 1, tabs: "nope" }).tabs).toEqual(
      [],
    );
  });
});

describe("sanitizePinnedScrollback", () => {
  it("clears idle-only buffers to empty", () => {
    expect(sanitizePinnedScrollback("❯\n\n❯\n")).toBe("");
    expect(sanitizePinnedScrollback("❯")).toBe("");
    expect(sanitizePinnedScrollback("PS C:\\>")).toBe("");
    expect(sanitizePinnedScrollback("DUSTI@msi-laptop ❯ ~ ❯")).toBe("");
    expect(sanitizePinnedScrollback("\n\n  \n")).toBe("");
  });

  it("clears nord powerline row-1 prompts (U+E0B0 separators)", () => {
    const row1 = " DUSTI@msi-laptop \uE0B0 ~ \uE0B0";
    expect(sanitizePinnedScrollback(row1)).toBe("");
    expect(
      sanitizePinnedScrollback(
        [row1, row1, row1, row1, row1].join("\n"),
      ),
    ).toBe("");
    expect(
      sanitizePinnedScrollback(`${row1}\n❯\n${row1}\n`),
    ).toBe("");
  });

  it("keeps command text after a prompt marker", () => {
    expect(sanitizePinnedScrollback("❯ git status")).toBe("❯ git status");
    expect(sanitizePinnedScrollback("$ ls -la")).toBe("$ ls -la");
  });

  it("preserves real output and strips trailing idle prompts", () => {
    const input = [
      "❯ git status",
      "On branch main",
      "nothing to commit",
      "",
      "❯",
      "DUSTI@host ❯ ~ ❯",
    ].join("\n");
    expect(sanitizePinnedScrollback(input)).toBe(
      ["❯ git status", "On branch main", "nothing to commit"].join("\n"),
    );
  });

  it("strips nord powerline row-1 before real command output", () => {
    const row1 = " DUSTI@msi-laptop \uE0B0 ~ \uE0B0";
    const input = [row1, "❯ npm", "Usage:", "npm install"].join("\n");
    expect(sanitizePinnedScrollback(input)).toBe(
      ["❯ npm", "Usage:", "npm install"].join("\n"),
    );
  });

  it("clears stacked prompts on normalize", () => {
    const state = normalizePinnedTabsState({
      version: 1,
      tabs: [
        {
          tabId: "1",
          profileId: "powershell",
          title: "Pinned",
          scrollback: "❯\n\nPS C:\\>\nuser@host ❯ ~ ❯",
          wasActive: true,
        },
      ],
    });
    expect(state.tabs[0]?.scrollback).toBe("");
  });

  it("does not persist blank or prompt-only text via toPinnedRecords", () => {
    const tabs: TabState[] = [
      {
        tabId: "1",
        sessionId: "s1",
        profileId: "powershell",
        title: "Pinned",
        pinned: true,
        status: "running",
      },
    ];
    const state = toPinnedRecords(
      tabs,
      "1",
      new Map([["1", "❯\n\nPS C:\\>"]]),
      5000,
    );
    expect(state.tabs[0]?.scrollback).toBe("");
  });

  it("serializes sanitized real IO without trailing idle prompts", () => {
    const tabs: TabState[] = [
      {
        tabId: "1",
        sessionId: "s1",
        profileId: "powershell",
        title: "Pinned",
        pinned: true,
        status: "running",
      },
    ];
    const state = toPinnedRecords(
      tabs,
      "1",
      new Map([
        [
          "1",
          "❯ echo hi\nhi\n❯",
        ],
      ]),
      5000,
    );
    expect(state.tabs[0]?.scrollback).toBe("❯ echo hi\nhi");
  });
});

describe("resolvePinnedScrollback", () => {
  it("prefers non-empty live text", () => {
    expect(
      resolvePinnedScrollback({
        live: "from-xterm",
        lastKnown: "cached",
        initial: "restored",
      }),
    ).toBe("from-xterm");
  });

  it("falls back to lastKnown when live is empty", () => {
    expect(
      resolvePinnedScrollback({
        live: "",
        lastKnown: "cached-history",
        initial: "restored",
      }),
    ).toBe("cached-history");
  });

  it("falls back to initial when live and lastKnown are empty", () => {
    expect(
      resolvePinnedScrollback({
        live: "",
        lastKnown: undefined,
        initial: "pin scrollback\nline 2",
      }),
    ).toBe("pin scrollback\nline 2");
  });

  it("never replaces known history with empty", () => {
    const lastKnown = "good history";
    const merged = resolvePinnedScrollback({
      live: null,
      lastKnown,
      initial: lastKnown,
    });
    expect(merged).toBe(lastKnown);
    expect(merged).not.toBe("");
  });
});

describe("restore early-persist gate", () => {
  it("blocks until tabs with initialScrollback report ready", () => {
    const tabs = [
      { tabId: "a", initialScrollback: "history A" },
      { tabId: "b" },
    ];
    expect(areRestoredScrollbacksReady(tabs, new Set())).toBe(false);
    expect(areRestoredScrollbacksReady(tabs, new Set(["a"]))).toBe(true);
    expect(
      areRestoredScrollbacksReady(tabs, new Set(["a"]), new Set()),
    ).toBe(false);
    expect(
      areRestoredScrollbacksReady(tabs, new Set(["a"]), new Set(["a"])),
    ).toBe(true);
  });

  it("is ready immediately when no tab has restore text", () => {
    const tabs = [{ tabId: "fresh" }, { tabId: "also-fresh" }];
    expect(areRestoredScrollbacksReady(tabs, new Set())).toBe(true);
  });

  it("simulates restore → early persist with missing handle keeps initial", () => {
    const restored: TabState = {
      tabId: "pin-1",
      sessionId: null,
      profileId: "powershell",
      title: "Pinned",
      pinned: true,
      status: "running",
      initialScrollback: "prior session output",
    };
    const lastKnown = new Map([["pin-1", restored.initialScrollback!]]);
    // Missing xterm handle → live empty; merge must keep restore text.
    const scrollback = resolvePinnedScrollback({
      live: "",
      lastKnown: lastKnown.get(restored.tabId),
      initial: restored.initialScrollback,
    });
    const state = toPinnedRecords(
      [restored],
      restored.tabId,
      new Map([[restored.tabId, scrollback]]),
      5000,
    );
    expect(state.tabs[0]?.scrollback).toBe("prior session output");
  });

  it("skips every persist path before hydration finishes", () => {
    // StrictMode mount → cleanup: the live tab list is still empty here.
    expect(
      shouldPersistPins({
        hydrated: false,
        tabs: [],
        readyIds: new Set(),
        handleIds: new Set(),
      }),
    ).toBe(false);

    // Even a fully populated list must wait for hydration.
    expect(
      shouldPersistPins({
        hydrated: false,
        tabs: [{ tabId: "a" }],
        readyIds: new Set(["a"]),
        handleIds: new Set(["a"]),
      }),
    ).toBe(false);
  });

  it("persists after hydration once restore text is written", () => {
    const tabs = [{ tabId: "a", initialScrollback: "history A" }];
    expect(
      shouldPersistPins({
        hydrated: true,
        tabs,
        readyIds: new Set(),
        handleIds: new Set(),
      }),
    ).toBe(false);
    expect(
      shouldPersistPins({
        hydrated: true,
        tabs,
        readyIds: new Set(["a"]),
        handleIds: new Set(["a"]),
      }),
    ).toBe(true);
  });

  it("allows an empty snapshot after hydration when no tab is pinned", () => {
    expect(
      shouldPersistPins({
        hydrated: true,
        tabs: [{ tabId: "unpinned" }],
        readyIds: new Set(),
        handleIds: new Set(),
      }),
    ).toBe(true);
  });

  it("ignores sessionId-only changes in pinPersistSignature", () => {
    const base = [
      {
        tabId: "1",
        pinned: true,
        title: "Shell",
        profileId: "powershell",
      },
    ];
    const before = pinPersistSignature(base, "1");
    const afterSession = pinPersistSignature([{ ...base[0] }], "1");
    expect(before).toBe(afterSession);

    const afterRename = pinPersistSignature(
      [{ ...base[0], title: "Build" }],
      "1",
    );
    expect(afterRename).not.toBe(before);
  });
});

describe("shouldWritePinnedState", () => {
  const stored: PinnedTabsState = {
    version: 1,
    tabs: [
      {
        tabId: "1",
        profileId: "powershell",
        title: "Pinned",
        scrollback: "history",
        wasActive: true,
      },
    ],
  };
  const empty: PinnedTabsState = { version: 1, tabs: [] };

  it("refuses to clear stored pins without allowEmpty", () => {
    expect(shouldWritePinnedState({ next: empty, stored })).toBe(false);
  });

  it("clears stored pins when the caller allows empty", () => {
    expect(
      shouldWritePinnedState({ next: empty, stored, allowEmpty: true }),
    ).toBe(true);
  });

  it("always writes a non-empty snapshot", () => {
    expect(shouldWritePinnedState({ next: stored, stored: empty })).toBe(true);
  });

  it("allows empty over empty", () => {
    expect(shouldWritePinnedState({ next: empty, stored: empty })).toBe(true);
  });
});
