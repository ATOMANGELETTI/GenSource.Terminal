import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GitOpenFolderResult, GitStatusResult } from "@/types/git-scm";

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

async function importHelpers() {
  return import("@/lib/terminal/git-scm");
}

describe("git-scm helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    store.clear();
    setStoreValue.mockClear();
    getStoreValue.mockClear();
  });

  it("folderDisplayName returns the last path segment", async () => {
    const { folderDisplayName } = await importHelpers();
    expect(folderDisplayName("C:\\Users\\dev\\project")).toBe("project");
    expect(folderDisplayName("C:\\Users\\dev\\project\\")).toBe("project");
    expect(folderDisplayName("C:\\")).toBe("C:\\");
    expect(folderDisplayName("/home/dev/repo")).toBe("repo");
  });

  it("resolveScmPanelState maps empty / init / repo", async () => {
    const { resolveScmPanelState } = await importHelpers();
    const notRepo: GitOpenFolderResult = {
      folderPath: "C:\\work",
      root: "C:\\work",
      isRepo: false,
    };
    const repo: GitOpenFolderResult = {
      folderPath: "C:\\work",
      root: "C:\\work",
      isRepo: true,
      branch: "main",
      head: "abcdef0",
    };

    expect(resolveScmPanelState(null, null)).toBe("empty");
    expect(resolveScmPanelState("C:\\work", null)).toBe("init");
    expect(resolveScmPanelState("C:\\work", notRepo)).toBe("init");
    expect(resolveScmPanelState("C:\\work", repo)).toBe("repo");
  });

  it("canCommit requires staged files and a message", async () => {
    const { canCommit } = await importHelpers();
    expect(canCommit("", 1)).toBe(false);
    expect(canCommit("  ", 1)).toBe(false);
    expect(canCommit("fix", 0)).toBe(false);
    expect(canCommit("fix", 2)).toBe(true);
  });

  it("changesSectionEntries merges unstaged and untracked", async () => {
    const { changesSectionEntries, emptyStatus } = await importHelpers();
    const status: GitStatusResult = {
      ...emptyStatus(),
      unstaged: [
        {
          path: "a.ts",
          absolutePath: "C:\\work\\a.ts",
          status: "modified",
        },
      ],
      untracked: [
        {
          path: "b.ts",
          absolutePath: "C:\\work\\b.ts",
          status: "untracked",
        },
      ],
      staged: [
        {
          path: "c.ts",
          absolutePath: "C:\\work\\c.ts",
          status: "added",
        },
      ],
    };
    expect(changesSectionEntries(status).map((e) => e.path)).toEqual([
      "a.ts",
      "b.ts",
    ]);
    expect(changesSectionEntries(null)).toEqual([]);
  });

  it("autoStagePaths returns unstaged and untracked only", async () => {
    const { autoStagePaths, emptyStatus, SCM_CHANGED_EVENT } =
      await importHelpers();
    const status: GitStatusResult = {
      ...emptyStatus(),
      unstaged: [
        {
          path: "dirty.ts",
          absolutePath: "C:\\work\\dirty.ts",
          status: "modified",
        },
      ],
      untracked: [
        {
          path: "new.ts",
          absolutePath: "C:\\work\\new.ts",
          status: "untracked",
        },
      ],
      staged: [
        {
          path: "ready.ts",
          absolutePath: "C:\\work\\ready.ts",
          status: "added",
        },
      ],
      conflicted: [
        {
          path: "conflict.ts",
          absolutePath: "C:\\work\\conflict.ts",
          status: "conflict",
        },
      ],
    };

    expect(autoStagePaths(status)).toEqual(["dirty.ts", "new.ts"]);
    expect(autoStagePaths(null)).toEqual([]);
    expect(autoStagePaths(emptyStatus())).toEqual([]);
    expect(SCM_CHANGED_EVENT).toBe("scm-changed");
  });

  it("changeStatusLabel maps statuses", async () => {
    const { changeStatusLabel } = await importHelpers();
    expect(changeStatusLabel("modified")).toBe("M");
    expect(changeStatusLabel("untracked")).toBe("U");
    expect(changeStatusLabel("conflict")).toBe("!");
    expect(changeStatusLabel("typeChange")).toBe("T");
    expect(changeStatusLabel("intentToAdd")).toBe("A");
  });

  it("emptyStatus uses conflicted bucket", async () => {
    const { emptyStatus } = await importHelpers();
    expect(emptyStatus()).toEqual({
      staged: [],
      unstaged: [],
      untracked: [],
      conflicted: [],
    });
  });

  it("persists and clears scm folder path", async () => {
    const { loadScmFolderPath, saveScmFolderPath, SCM_FOLDER_KEY } =
      await importHelpers();

    await saveScmFolderPath("C:\\repo");
    expect(store.get(SCM_FOLDER_KEY)).toBe("C:\\repo");
    expect(await loadScmFolderPath()).toBe("C:\\repo");

    await saveScmFolderPath("  ");
    expect(store.get(SCM_FOLDER_KEY)).toBeNull();
    expect(await loadScmFolderPath()).toBeNull();
  });
});
