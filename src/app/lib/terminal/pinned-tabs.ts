import type { PinnedTabRecord, PinnedTabsState } from "../../types";
import type { TabState } from "./session-manager";

/** Opaque plugin-store key for pinned tabs + scrollback (not settings.json). */
export const PINNED_TABS_KEY = "terminal.pinnedTabs";

const EMPTY: PinnedTabsState = { version: 1, tabs: [] };

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
        scrollbacks.get(tab.tabId) ?? "",
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
      scrollback: item.scrollback,
      wasActive,
    });
  }

  return { version: 1, tabs };
}
