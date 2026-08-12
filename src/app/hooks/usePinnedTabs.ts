import { getStoreValue, setStoreValue } from "../lib/app-store";
import { isE2eMode } from "../lib/e2e-window";
import {
  PINNED_TABS_KEY,
  normalizePinnedTabsState,
} from "../lib/terminal/pinned-tabs";
import type { PinnedTabsState } from "../types";

const EMPTY_PINS: PinnedTabsState = { version: 1, tabs: [] };

/** Load pinned tabs from plugin-store (corrupt/missing → empty). */
export async function loadPinnedTabs(): Promise<PinnedTabsState> {
  if (isE2eMode()) {
    // Playwright can seed restore via `window.__E2E_PINNED_TABS__`.
    const injected = (
      window as unknown as { __E2E_PINNED_TABS__?: unknown }
    ).__E2E_PINNED_TABS__;
    if (injected !== undefined) {
      return normalizePinnedTabsState(injected);
    }
    return { ...EMPTY_PINS, tabs: [] };
  }
  try {
    const raw = await getStoreValue<unknown>(PINNED_TABS_KEY);
    return normalizePinnedTabsState(raw);
  } catch (error) {
    console.warn("Failed to load pinned tabs", error);
    return { ...EMPTY_PINS, tabs: [] };
  }
}

/** Persist pinned tabs (+ scrollback) to plugin-store only. */
export async function savePinnedTabs(state: PinnedTabsState): Promise<void> {
  if (isE2eMode()) {
    return;
  }
  await setStoreValue(PINNED_TABS_KEY, state);
}

/**
 * Hook facade for pin load/save used on launch restore and pin toggles.
 * Persistence key: `terminal.pinnedTabs` via `app-store` (not settings.json).
 */
export function usePinnedTabs() {
  return { loadPinnedTabs, savePinnedTabs };
}
