import { getCurrentWindow } from "@tauri-apps/api/window";

import type { AppInfo, AppSettings } from "../types";

export type AppWindowLabel = "main" | "splash" | "tray-menu" | "context-menu";

const KNOWN_LABELS = new Set<string>([
  "main",
  "splash",
  "tray-menu",
  "context-menu",
]);

/** Fixture identity when Vite e2e has no Tauri backend. */
export const E2E_APP_INFO: AppInfo = {
  name: "gensource-terminal",
  productName: "GenSource Terminal",
  version: "0.1.0",
  description: "AI-Native Terminal Application",
  publisher: "GenSource",
  codename: "terminal",
  edition: 2026,
};

export const E2E_DEFAULT_SETTINGS: AppSettings = {
  theme: "nord-polar-night",
  fontFamily: "Terminus",
  fontSize: 14,
  particleEffect: "dust",
  startMinimized: false,
  autostart: false,
  alwaysOnTop: false,
  defaultProfile: "powershell",
  scrollbackLines: 5000,
  cursorStyle: "bar",
  cursorBlink: true,
  fileIconSet: "catppuccin",
  profiles: [
    {
      id: "powershell",
      name: "PowerShell",
      command: "powershell.exe",
      args: ["-NoLogo"],
      startingDirectory: null,
    },
    {
      id: "cmd",
      name: "CMD",
      command: "cmd.exe",
      args: [],
      startingDirectory: null,
    },
  ],
};

/**
 * Playwright / Vite harness: `?window=splash|tray-menu|context-menu|main`
 * selects the secondary-window tree without requiring a live Tauri WebView.
 */
export function readWindowQueryParam(
  search = typeof window !== "undefined" ? window.location.search : "",
): AppWindowLabel | null {
  const value = new URLSearchParams(search).get("window");
  if (value && KNOWN_LABELS.has(value)) {
    return value as AppWindowLabel;
  }
  return null;
}

/** `?e2e=1` freezes splash animation and enables other deterministic fixtures. */
export function isE2eMode(
  search = typeof window !== "undefined" ? window.location.search : "",
): boolean {
  const value = new URLSearchParams(search).get("e2e");
  return value === "1" || value === "true";
}

/**
 * Resolve which React tree to mount: query override → Tauri label → main.
 * Never throws in a plain browser (required for Vite Playwright).
 */
export function resolveWindowLabel(): AppWindowLabel {
  const fromQuery = readWindowQueryParam();
  if (fromQuery) {
    return fromQuery;
  }

  try {
    const label = getCurrentWindow().label;
    if (KNOWN_LABELS.has(label)) {
      return label as AppWindowLabel;
    }
  } catch {
    // Not running inside Tauri (Vite e2e / plain browser).
  }

  return "main";
}
