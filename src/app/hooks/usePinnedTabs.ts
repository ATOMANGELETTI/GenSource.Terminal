import { getStoreValue, setStoreValue } from "../lib/app-store";
import { isE2eMode } from "../lib/e2e-window";
import {
  PINNED_TABS_KEY,
  normalizePinnedTabsState,
  shouldWritePinnedState,
} from "../lib/terminal/pinned-tabs";
import type { PinnedTabsState } from "../types";

const EMPTY_PINS: PinnedTabsState = { version: 1, tabs: [] };

/** Serializes store writes so a slow older save cannot land after a newer one. */
let writeQueue: Promise<void> = Promise.resolve();
let writeSeq = 0;

export interface SavePinnedTabsOptions {
  /**
   * Permit replacing stored pins with an empty list. Callers must only set
   * this once hydration finished and the live tab list really has no pins.
   */
  allowEmpty?: boolean;
}

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

/**
 * Persist pinned tabs (+ scrollback) to plugin-store only. Writes are queued
 * in call order, superseded snapshots are dropped, and an empty list never
 * overwrites stored pins unless `allowEmpty` is set.
 */
export async function savePinnedTabs(
  state: PinnedTabsState,
  options: SavePinnedTabsOptions = {},
): Promise<void> {
  if (isE2eMode()) {
    return;
  }

  const seq = ++writeSeq;
  const run = writeQueue.then(async () => {
    if (seq !== writeSeq) {
      // A newer full snapshot is already queued; this one is stale.
      return;
    }
    try {
      if (state.tabs.length === 0) {
        const stored = normalizePinnedTabsState(
          await getStoreValue<unknown>(PINNED_TABS_KEY),
        );
        if (
          !shouldWritePinnedState({
            next: state,
            stored,
            allowEmpty: options.allowEmpty,
          })
        ) {
          console.warn(
            "Refused to overwrite stored pinned tabs with an empty list",
          );
          return;
        }
      }
      await setStoreValue(PINNED_TABS_KEY, state);
    } catch (error) {
      // Never reject: callers fire this from unload/close paths.
      console.warn("Failed to save pinned tabs", error);
    }
  });

  writeQueue = run;
  await run;
}

/**
 * Hook facade for pin load/save used on launch restore and pin toggles.
 * Persistence key: `terminal.pinnedTabs` via `app-store` (not settings.json).
 */
export function usePinnedTabs() {
  return { loadPinnedTabs, savePinnedTabs };
}
