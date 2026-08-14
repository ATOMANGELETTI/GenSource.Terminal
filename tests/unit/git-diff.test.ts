import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GitDiffLine, GitFileDiff } from "@/types/git-scm";

const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => invoke(cmd, args),
}));

async function importDiff() {
  return import("@/lib/terminal/git-diff");
}

function line(
  kind: GitDiffLine["kind"],
  text: string,
  extra?: Partial<GitDiffLine>,
): GitDiffLine {
  return { kind, text, ...extra };
}

function sampleDiff(overrides?: Partial<GitFileDiff>): GitFileDiff {
  return {
    path: "src/app/App.tsx",
    absolutePath: "C:\\work\\src\\app\\App.tsx",
    status: "modified",
    side: "unstaged",
    binary: false,
    truncated: false,
    additions: 1,
    deletions: 1,
    oldLabel: "HEAD",
    newLabel: "Working Tree",
    lines: [
      line("equal", "import React from 'react';", { oldLine: 1, newLine: 1 }),
      line("delete", "const a = 1;", { oldLine: 2 }),
      line("insert", "const a = 2;", { newLine: 2 }),
    ],
    ...overrides,
  };
}

describe("git-diff helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    invoke.mockReset();
  });

  it("gitFileDiff invokes git_file_diff with path, filePath, and side", async () => {
    const diff = sampleDiff();
    invoke.mockResolvedValue(diff);
    const { gitFileDiff } = await importDiff();

    const result = await gitFileDiff("C:\\work", "src/app/App.tsx", "staged");

    expect(invoke).toHaveBeenCalledWith("git_file_diff", {
      path: "C:\\work",
      filePath: "src/app/App.tsx",
      side: "staged",
    });
    expect(result).toEqual(diff);
  });

  it("diffSideFromSection maps staged vs working-tree sections", async () => {
    const { diffSideFromSection } = await importDiff();
    expect(diffSideFromSection("staged")).toBe("staged");
    expect(diffSideFromSection("changes")).toBe("unstaged");
    expect(diffSideFromSection("unstaged")).toBe("unstaged");
    expect(diffSideFromSection("conflicted")).toBe("unstaged");
  });

  it("languageFromPath maps common extensions", async () => {
    const { languageFromPath } = await importDiff();
    expect(languageFromPath("src/app/App.tsx")).toBe("typescript");
    expect(languageFromPath("src-tauri/src/lib.rs")).toBe("rust");
    expect(languageFromPath("other/configs/settings.json")).toBe("json");
    expect(languageFromPath("README.md")).toBe("markdown");
    expect(languageFromPath("src/app/styles/index.css")).toBe("css");
    expect(languageFromPath("script.ps1")).toBe("powershell");
    expect(languageFromPath("Dockerfile")).toBe("dockerfile");
    expect(languageFromPath("notes")).toBe("plaintext");
  });

  it("assembleUnifiedDocument joins line text without +/- prefixes", async () => {
    const { assembleUnifiedDocument } = await importDiff();
    const lines = [
      line("equal", "keep"),
      line("delete", "gone"),
      line("insert", "new"),
    ];
    expect(assembleUnifiedDocument(lines)).toEqual({
      text: "keep\ngone\nnew",
      lines,
    });
  });

  it("isCleanDiff is true when there are no insert or delete lines", async () => {
    const { isCleanDiff } = await importDiff();
    expect(isCleanDiff(sampleDiff({ lines: [], additions: 0, deletions: 0 }))).toBe(
      true,
    );
    expect(
      isCleanDiff(
        sampleDiff({
          lines: [line("equal", "same", { oldLine: 1, newLine: 1 })],
          additions: 0,
          deletions: 0,
        }),
      ),
    ).toBe(true);
    expect(isCleanDiff(sampleDiff())).toBe(false);
    expect(isCleanDiff(sampleDiff({ binary: true, lines: [] }))).toBe(false);
    expect(isCleanDiff(null)).toBe(false);
  });

  it("formatDiffLineNumber uses old on delete, new on insert, both on equal", async () => {
    const { formatDiffLineNumber } = await importDiff();
    expect(formatDiffLineNumber(line("delete", "x", { oldLine: 4 }))).toBe("4");
    expect(formatDiffLineNumber(line("insert", "y", { newLine: 9 }))).toBe("9");
    expect(
      formatDiffLineNumber(line("equal", "z", { oldLine: 2, newLine: 5 })),
    ).toBe("2 5");
    expect(
      formatDiffLineNumber(line("equal", "z", { oldLine: 3, newLine: 3 })),
    ).toBe("3");
  });

  it("changeHunkStarts returns 1-based starts of insert/delete runs", async () => {
    const { changeHunkStarts } = await importDiff();
    expect(
      changeHunkStarts([
        line("equal", "a"),
        line("delete", "b"),
        line("insert", "c"),
        line("equal", "d"),
        line("insert", "e"),
      ]),
    ).toEqual([2, 5]);
  });

  it("dedupes diff tabs by repoRoot + path + side", async () => {
    const { createDiffTabState, diffTabKey, findDiffTab } = await importDiff();
    const first = createDiffTabState({
      repoRoot: "C:\\work\\",
      path: "src\\app\\App.tsx",
      absolutePath: "C:\\work\\src\\app\\App.tsx",
      side: "unstaged",
      status: "modified",
    });
    expect(first.title).toBe("App.tsx");
    expect(diffTabKey("C:\\work", "src/app/App.tsx", "unstaged")).toBe(
      diffTabKey("C:\\work\\", "src\\app\\App.tsx", "unstaged"),
    );
    expect(
      findDiffTab([first], "C:/work", "src/app/App.tsx", "unstaged")?.tabId,
    ).toBe(first.tabId);
    expect(findDiffTab([first], "C:/work", "src/app/App.tsx", "staged")).toBe(
      undefined,
    );
  });

  it("charOffsetToUtf16 maps scalar offsets past non-BMP characters", async () => {
    const { charOffsetToUtf16, highlightToMonacoColumns } = await importDiff();
    const text = "a😀b";
    expect(charOffsetToUtf16(text, 0)).toBe(0);
    expect(charOffsetToUtf16(text, 1)).toBe(1);
    expect(charOffsetToUtf16(text, 2)).toBe(3);
    expect(charOffsetToUtf16(text, 3)).toBe(4);
    expect(highlightToMonacoColumns(text, 1, 2)).toEqual({
      startColumn: 2,
      endColumn: 4,
    });
    expect(highlightToMonacoColumns("hello", 1, 4)).toEqual({
      startColumn: 2,
      endColumn: 5,
    });
  });

  it("isMissingDiffError matches Rust file-not-found strings", async () => {
    const { isMissingDiffError } = await importDiff();
    expect(isMissingDiffError("file not found: src/gone.ts")).toBe(true);
    expect(isMissingDiffError("cannot diff a directory: src")).toBe(false);
    expect(isMissingDiffError("Failed to load diff")).toBe(false);
  });

  it("ensureActiveWorkspaceTab prefers the current id across both lists", async () => {
    const { ensureActiveWorkspaceTab } = await importDiff();
    const terminals = [{ tabId: "term-1" }];
    const diffs = [{ tabId: "diff-1" }];
    expect(ensureActiveWorkspaceTab(terminals, diffs, "diff-1")).toBe("diff-1");
    expect(ensureActiveWorkspaceTab(terminals, diffs, "missing")).toBe("term-1");
    expect(ensureActiveWorkspaceTab([], diffs, null)).toBe("diff-1");
    expect(ensureActiveWorkspaceTab([], [], null)).toBeNull();
  });
});
