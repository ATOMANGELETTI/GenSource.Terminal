import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { AppInfo, AppSettings, LoggingSettings } from "../types";
import { resolveFileIconSet } from "./file-icons";
import {
  followsSystemScheme,
  resolveTheme,
  watchSystemThemeChange,
} from "./theme";

const SETTINGS_CHANGED_EVENT = "settings-changed";
const LOGGING_CHANGED_EVENT = "logging-changed";

// Tracks the last-applied settings so the system-theme watcher (registered
// once, for the lifetime of the window) can re-resolve without a stale
// closure whenever the OS light/dark preference flips.
let latestSettings: AppSettings | undefined;
let systemThemeWatcherStarted = false;

const FONT_FAMILY_MAP: Record<string, string> = {
  Terminus: "Terminus, ui-monospace, monospace",
  Ubuntu: "Ubuntu, ui-sans-serif, system-ui, sans-serif",
  "Fira Code": '"Fira Code", ui-monospace, monospace',
  "Plus Jakarta Sans":
    '"Plus Jakarta Sans Variable", "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
};

export function applySettingsToDom(settings: AppSettings): void {
  latestSettings = settings;
  ensureSystemThemeWatcher();

  const root = document.documentElement;
  root.dataset.theme = resolveTheme(settings.theme || "nord-polar-night");
  root.dataset.fileIconSet = resolveFileIconSet(settings.fileIconSet);
  root.style.setProperty(
    "--font-sans",
    resolveFontFamily(settings.fontFamily),
  );
  const size =
    Number.isFinite(settings.fontSize) && settings.fontSize > 0
      ? settings.fontSize
      : 14;
  root.style.fontSize = `${size}px`;
}

// Registered once per window; reacts to OS light/dark flips by re-resolving
// OS-aware preferences (system, frost, aurora).
function ensureSystemThemeWatcher(): void {
  if (systemThemeWatcherStarted) {
    return;
  }
  systemThemeWatcherStarted = true;

  watchSystemThemeChange(() => {
    const preference = latestSettings?.theme;
    if (!preference || !followsSystemScheme(preference)) {
      return;
    }
    document.documentElement.dataset.theme = resolveTheme(preference);
  });
}

/** Known `settings.json` `fontFamily` keys (reject arbitrary CSS injection). */
export const ALLOWED_FONT_FAMILIES = Object.freeze(
  Object.keys(FONT_FAMILY_MAP),
);

/** Resolve a settings `fontFamily` key to a CSS font stack (allowlisted only). */
export function resolveFontFamily(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return FONT_FAMILY_MAP.Terminus;
  }
  return FONT_FAMILY_MAP[trimmed] ?? FONT_FAMILY_MAP.Terminus;
}

export { FONT_FAMILY_MAP };
export { resolveFileIconSet } from "./file-icons";

export async function fetchSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings");
}

export async function fetchAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("get_app_info");
}

export async function fetchLogging(): Promise<LoggingSettings> {
  return invoke<LoggingSettings>("get_logging");
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await invoke("save_settings", { settings });
}

export async function saveLogging(settings: LoggingSettings): Promise<void> {
  await invoke("save_logging", { settings });
}

export async function initSettingsFromBackend(): Promise<AppSettings> {
  const settings = await fetchSettings();
  applySettingsToDom(settings);
  return settings;
}

export async function subscribeSettingsChanges(
  onChange?: (settings: AppSettings) => void,
): Promise<UnlistenFn> {
  return listen<AppSettings>(SETTINGS_CHANGED_EVENT, (event) => {
    applySettingsToDom(event.payload);
    onChange?.(event.payload);
  });
}

export async function subscribeLoggingChanges(
  onChange: (logging: LoggingSettings) => void,
): Promise<UnlistenFn> {
  return listen<LoggingSettings>(LOGGING_CHANGED_EVENT, (event) => {
    onChange(event.payload);
  });
}
