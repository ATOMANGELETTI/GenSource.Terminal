/**
 * Opaque AppData key-value persistence via `@tauri-apps/plugin-store`.
 *
 * Use this for app-managed state (caches, last-used values, non-user-facing
 * flags). Do **not** load or save `other/configs/*` through the store — those
 * remain human-editable JSONC files handled by the Rust config module
 * (`get_settings`, file watcher, etc.).
 *
 * The store file is written under the OS AppData directory as `app-state.json`
 * (plugin default path resolution).
 */

import { load, type Store } from "@tauri-apps/plugin-store";

const STORE_PATH = "app-state.json";

let storePromise: Promise<Store> | undefined;

/** Returns the shared AppData-backed store (loaded once, then reused). */
export async function getAppStore(): Promise<Store> {
  storePromise ??= load(STORE_PATH, { autoSave: true });
  return storePromise;
}

/** Read a typed value, or `undefined` when the key is missing. */
export async function getStoreValue<T>(key: string): Promise<T | undefined> {
  const store = await getAppStore();
  return store.get<T>(key);
}

/** Write a value (auto-saved when `autoSave` is enabled). */
export async function setStoreValue(
  key: string,
  value: unknown,
): Promise<void> {
  const store = await getAppStore();
  await store.set(key, value);
}

/** Remove a key; returns whether it existed. */
export async function deleteStoreValue(key: string): Promise<boolean> {
  const store = await getAppStore();
  return store.delete(key);
}

/** Flush pending changes to disk immediately. */
export async function saveAppStore(): Promise<void> {
  const store = await getAppStore();
  await store.save();
}
