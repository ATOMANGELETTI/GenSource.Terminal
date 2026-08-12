import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PinnedTabsState } from "@/types";

const store = new Map<string, unknown>();
const setStoreValue = vi.fn((key: string, value: unknown): Promise<void> => {
  store.set(key, value);
  return Promise.resolve();
});
const getStoreValue = vi.fn((key: string): Promise<unknown> =>
  Promise.resolve(store.get(key)),
);

vi.mock("@/lib/app-store", () => ({
  getStoreValue: (key: string) => getStoreValue(key),
  setStoreValue: (key: string, value: unknown) => setStoreValue(key, value),
}));

vi.mock("@/lib/e2e-window", () => ({
  isE2eMode: () => false,
}));

function pins(...ids: string[]): PinnedTabsState {
  return {
    version: 1,
    tabs: ids.map((tabId, index) => ({
      tabId,
      profileId: "powershell",
      title: `Tab ${tabId}`,
      scrollback: `history ${tabId}`,
      wasActive: index === 0,
    })),
  };
}

const EMPTY: PinnedTabsState = { version: 1, tabs: [] };

async function importModule() {
  return import("@/hooks/usePinnedTabs");
}

function stored(): PinnedTabsState | undefined {
  return store.get("terminal.pinnedTabs") as PinnedTabsState | undefined;
}

describe("savePinnedTabs", () => {
  beforeEach(() => {
    vi.resetModules();
    store.clear();
    setStoreValue.mockClear();
    getStoreValue.mockClear();
  });

  it("does not let a pre-hydration empty flush wipe stored pins", async () => {
    const { savePinnedTabs } = await importModule();

    await savePinnedTabs(pins("a", "b"));
    expect(stored()?.tabs).toHaveLength(2);

    // StrictMode cleanup flush: empty snapshot, no explicit allowEmpty.
    await savePinnedTabs(EMPTY);

    expect(stored()?.tabs).toHaveLength(2);
  });

  it("clears stored pins when the user unpinned everything", async () => {
    const { savePinnedTabs } = await importModule();

    await savePinnedTabs(pins("a"));
    await savePinnedTabs(EMPTY, { allowEmpty: true });

    expect(stored()?.tabs).toEqual([]);
  });

  it("writes an empty snapshot when nothing is stored yet", async () => {
    const { savePinnedTabs } = await importModule();

    await savePinnedTabs(EMPTY);

    expect(stored()?.tabs).toEqual([]);
  });

  it("skips a snapshot superseded before it reached the store", async () => {
    const { savePinnedTabs } = await importModule();

    const first = savePinnedTabs(pins("a"));
    const second = savePinnedTabs(pins("a", "b"));
    await Promise.all([first, second]);

    expect(setStoreValue).toHaveBeenCalledTimes(1);
    expect(stored()?.tabs.map((t) => t.tabId)).toEqual(["a", "b"]);
  });

  it("keeps the newest snapshot when an older write is still in flight", async () => {
    const { savePinnedTabs } = await importModule();

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    setStoreValue.mockImplementationOnce(async (key, value) => {
      await gate;
      store.set(key, value);
    });

    const inFlight = savePinnedTabs(pins("a", "b", "c"));
    // Queued behind the slow write, then superseded by a newer snapshot.
    const stale = savePinnedTabs(pins("a"));
    const newest = savePinnedTabs(pins("a", "b", "c", "d"));
    release();
    await Promise.all([inFlight, stale, newest]);

    expect(stored()?.tabs.map((t) => t.tabId)).toEqual(["a", "b", "c", "d"]);
  });
});
