import type { PinnedTabRecord, PinnedTabsState } from "../../types";
import type { TabState } from "./session-manager";

/** Opaque plugin-store key for pinned tabs + scrollback (not settings.json). */
export const PINNED_TABS_KEY = "terminal.pinnedTabs";

const EMPTY: PinnedTabsState = { version: 1, tabs: [] };

/** Shell markers plus Nord powerline separators (U+E0B0/E0B1 from nord-powerline.ps1). */
const PROMPT_MARKERS = ["❯", "$", "#", "%", ">", "\uE0B0", "\uE0B1"] as const;

/**
 * True for blank lines and idle shell prompts with no command text after the
 * last prompt marker (e.g. `❯`, `PS C:\>`, `user@host ❯ ~ ❯`).
 */
export function isPromptOnlyLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return true;
  }

  let lastMarkerEnd = -1;
  for (const marker of PROMPT_MARKERS) {
    const idx = trimmed.lastIndexOf(marker);
    if (idx !== -1) {
      const end = idx + marker.length;
      if (end > lastMarkerEnd) {
        lastMarkerEnd = end;
      }
    }
  }

  if (lastMarkerEnd === -1) {
    return false;
  }

  return trimmed.slice(lastMarkerEnd).trim().length === 0;
}

/**
 * Drop blank and prompt-only lines so pinned tabs only persist real IO.
 * Returns `""` when nothing remains (skip restore write; fresh PTY prompt only).
 */
export function sanitizePinnedScrollback(text: string): string {
  if (!text) {
    return "";
  }
  const survivors = text.split("\n").filter((line) => !isPromptOnlyLine(line));
  return survivors.length === 0 ? "" : survivors.join("\n");
}

/** Keep only the last `maxLines` lines of scrollback text. */
export function truncateScrollback(text: string, maxLines: number): string {
  if (maxLines <= 0) {
    return "";
  }
  const lines = text.split("\n");
  if (lines.length <= maxLines) {
    return text;
  }
  return lines.slice(-maxLines).join("\n");
}

/**
 * Prefer live xterm text, then last known good, then restore `initialScrollback`.
 * Never returns empty when a non-empty fallback exists (avoids wipe-on-restore).
 */
export function resolvePinnedScrollback(options: {
  live?: string | null;
  lastKnown?: string | null;
  initial?: string | null;
}): string {
  const live = options.live ?? "";
  if (live.length > 0) {
    return live;
  }
  const lastKnown = options.lastKnown ?? "";
  if (lastKnown.length > 0) {
    return lastKnown;
  }
  return options.initial ?? "";
}

/** Pin-relevant fields only — ignores sessionId / status churn. */
export function pinPersistSignature(
  tabs: Array<{
    tabId: string;
    pinned: boolean;
    title: string;
    profileId: string;
  }>,
  activeTabId: string | null,
): string {
  return JSON.stringify({
    activeTabId,
    tabs: tabs.map((t) => ({
      tabId: t.tabId,
      pinned: t.pinned,
      title: t.title,
      profileId: t.profileId,
    })),
  });
}

/**
 * True once every tab with restore text has an xterm handle and has finished
 * its initial write. Tabs without `initialScrollback` do not block.
 */
export function areRestoredScrollbacksReady(
  tabs: Array<{ tabId: string; initialScrollback?: string }>,
  readyIds: ReadonlySet<string>,
  handleIds?: ReadonlySet<string>,
): boolean {
  for (const tab of tabs) {
    if (tab.initialScrollback && tab.initialScrollback.length > 0) {
      if (!readyIds.has(tab.tabId)) {
        return false;
      }
      if (handleIds && !handleIds.has(tab.tabId)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Single gate shared by every persist path (debounce, interval, visibility,
 * unload, effect cleanup, window close). Writing before hydration finishes is
 * what wiped AppData under StrictMode, so `hydrated` is mandatory.
 */
export function shouldPersistPins(options: {
  hydrated: boolean;
  tabs: Array<{ tabId: string; initialScrollback?: string }>;
  readyIds: ReadonlySet<string>;
  handleIds?: ReadonlySet<string>;
}): boolean {
  if (!options.hydrated) {
    return false;
  }
  return areRestoredScrollbacksReady(
    options.tabs,
    options.readyIds,
    options.handleIds,
  );
}

/**
 * Store-level guard: an empty snapshot may only replace stored pins when the
 * caller explicitly allows it (user unpinned everything after hydration).
 */
export function shouldWritePinnedState(options: {
  next: PinnedTabsState;
  stored: PinnedTabsState;
  allowEmpty?: boolean;
}): boolean {
  if (options.next.tabs.length > 0) {
    return true;
  }
  if (options.allowEmpty) {
    return true;
  }
  return options.stored.tabs.length === 0;
}

/**
 * Serialize live tab state into store shape: pinned tabs only, unpinned
 * discarded, at most one `wasActive`.
 */
export function toPinnedRecords(
  tabs: TabState[],
  activeTabId: string | null,
  scrollbacks: Map<string, string>,
  scrollbackLines: number,
): PinnedTabsState {
  const pinned = tabs.filter((t) => t.pinned);
  let markedActive = false;

  const records: PinnedTabRecord[] = pinned.map((tab) => {
    const wasActive =
      !markedActive && activeTabId !== null && tab.tabId === activeTabId;
    if (wasActive) {
      markedActive = true;
    }
    return {
      tabId: tab.tabId,
      profileId: tab.profileId,
      title: tab.title,
      scrollback: truncateScrollback(
        sanitizePinnedScrollback(scrollbacks.get(tab.tabId) ?? ""),
        scrollbackLines,
      ),
      wasActive,
    };
  });

  return { version: 1, tabs: records };
}

function isPinnedTabRecord(value: unknown): value is PinnedTabRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const r = value as Record<string, unknown>;
  return (
    typeof r.tabId === "string" &&
    typeof r.profileId === "string" &&
    typeof r.title === "string" &&
    typeof r.scrollback === "string" &&
    typeof r.wasActive === "boolean"
  );
}

/** Coerce store payloads into a safe `PinnedTabsState` (corrupt → empty). */
export function normalizePinnedTabsState(raw: unknown): PinnedTabsState {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY, tabs: [] };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1 || !Array.isArray(obj.tabs)) {
    return { ...EMPTY, tabs: [] };
  }

  const tabs: PinnedTabRecord[] = [];
  let sawActive = false;
  for (const item of obj.tabs) {
    if (!isPinnedTabRecord(item)) {
      continue;
    }
    const wasActive = item.wasActive && !sawActive;
    if (wasActive) {
      sawActive = true;
    }
    tabs.push({
      tabId: item.tabId,
      profileId: item.profileId,
      title: item.title,
      scrollback: sanitizePinnedScrollback(item.scrollback),
      wasActive,
    });
  }

  return { version: 1, tabs };
}
