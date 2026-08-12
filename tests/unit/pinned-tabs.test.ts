import { describe, expect, it } from "vitest";
import {
  normalizePinnedTabsState,
  truncateScrollback,
  toPinnedRecords,
  PINNED_TABS_KEY,
} from "@/lib/terminal/pinned-tabs";
import type { TabState } from "@/lib/terminal/session-manager";

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
